import { Router } from "express"
import { nanoid } from "nanoid"
import { query } from "../db.js"
import { getUrl, setUrl, deleteUrl } from "../cache.js"
import { createHash } from "crypto"

const router = Router()

const isValidUrl = (str) => {
    try {
        const url = new URL(str)
        return url.protocol === "http:" || url.protocol === "https:"
    } catch {
        return false;
    }
}

const hashIp = (ip) =>
    createHash("sha256").update(ip + "salt_value_here").digest("hex").slice(0, 16)

router.post("/", async (req, res) => {
    const { url, custom_code, expires_in_days, click_limit, title } = req.body
    const userId = req.user.userId

    if (!url || !isValidUrl(url)) {
        return res.status(400).json({ error: "A valid URL is required" })

    }

    const code = custom_code?.trim() || nanoid(7)

    if (custom_code && !/^[a-zA-Z0-9_-]{3,30}$/.test(custom_code)) {
        return res.status(400).json({ error: "Custom code must be 3-20 alphanumeric chars" })
    }

    const expiresAt = expires_in_days
        ? new Date(Date.now() + expires_in_days * 86400000) : null

    try {
        const result = await query(
            `INSERT INTO urls (short_code, original_url, title, user_id, expires_at, click_limit)
            VALUES($1, $2, $3, $4, $5, $6)
            RETURNING id, short_code, original_url, title, created_at, expires_at, click_limit`,
            [code, url, title || null, userId, expiresAt, click_limit || null]
        )

        const row = result.rows[0]
        await setUrl(code, row)

        return res.status(201).json({
            ...row,
            short_url: `${process.env.BASE_URL || ""}/${row.short_code}`,
        })
    } catch (err) {
        if (err.code === "23505") {
            return res.status(409).json({ error: "That short code is already taken" })
        }
        console.error(err)
        return res.status(500).json({ error: "Failed to create short URL" })
    }
})


router.get("/", async (req, res) => {
    const { page = 1, limit = 20, search } = req.query;
    const offset = (page - 1) * limit;
    const userId = req.user.userId;

    try {
        let whereClause = "WHERE user_id = $3";
        const params = [parseInt(limit), parseInt(offset), userId]

        if (search) {
            params.push(`%${search}%`)
            whereClause += `AND (original_url ILIKE $${params.length} OR short_code ILIKE $${params.length})`
        }

        const countResult = await query(
            `SELECT COUNT(*) FROM url_stats WHERE user_id = $1` + (search ? ` AND (original_url ILIKE $2 OR short_code ILIKE $2)` : ""),
            search ? [userId, `%${search}%`] : [userId]
        )

        const result = await query(
            `SELECT * FROM url_stats ${whereClause}
            ORDER BY created_at DESC
            LIMIT $1 OFFSET $2`,
            params
        )

        return res.json({
            urls: result.rows,
            total: parseInt(countResult.rows[0].count),
            page: parseInt(page),
            pages: Math.ceil(countResult.rows[0].count / limit),

        })

    } catch (err) {
        console.error(err)
        return res.status(500).json({ error: "Failed to fetch URLs" })
    }
})



router.delete("/:code", async (req, res) => {
    const { code } = req.params;
    const userId = req.user.userId

    try {
        const result = await query(
            "DELETE FROM urls WHERE short_code = $1 AND user_id = $2 RETURNING id",
            [code, userId]
        )

        if (!result.rows.length) {
            return res.status(404).json({ error: "URL not found or access denied" })
        }


        await deleteUrl(code)
        return res.json({ message: "Delete successfully" })
    } catch (err) {
        console.error(err)
        return res.status(500).json({ error: "failed to delete" })
    }
})


export const handleRedirect = async (req, res) => {
    const { code } = req.params;


    try {
        let urlData = await getUrl(code)

        if (!urlData) {
            const result = await query(
                "SELECT * FROM urls WHERE short_code = $1 AND is_active = true",
                [code]
            )

            if (!result.rows.length) {
                return res.status(404).send("<h2>404 - Short URL not found </h2>")

            }

            urlData = result.rows[0]
            await setUrl(code, urlData)
        }
        if (urlData.click_limit) {
            const countResult = await query(
                "SELECT COUNT(*) FROM analytics WHERE url_id =$1",
                [urlData.id]
            )
            if (parseInt(countResult.rows[0].count) >= urlData.click_limit) {
                return res.status(410).send("<h2> This link has reached its click limit .</h2>")
            }
        }

        const ip = req.headers["x-forwarded-for"]?.split(",")[0] || req.ip;
        query(
            `INSERT INTO analytics (url_id, ip_hash, user_agent, referer)
        VALUES($1, $2, $3, $4)`,
            [urlData.id, hashIp(ip), req.headers["user-agent"], req.headers["referer"] || null]
        ).catch(console.error)
        return res.redirect(301, urlData.original_url)
    } catch (err) {
        console.error(err)
        return res.status(500).send("Server error")
    }
}

export default router