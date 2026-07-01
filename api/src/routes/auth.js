import { Router } from "express"
import bcrypt from "bcrypt"
import jwt from "jsonwebtoken"
import { query } from "../db.js"
import { JWT_SECRET } from "../middleware/auth.js"


const router = Router()
const SALT_ROUNDS = 12


router.post("/register", async (req, res) => {
    const { email, password } = req.body

    if (!email || !password) {
        return res.status(400).json({ error: "Email and password are requried" })

    }

    if (password.length < 8) {
        return res.status(400).json({ error: "password must be at least 8 characters" })
    }
    if (!email.includes("@")) {
        return res.status(400).json({ error: "invalid email" })
    }

    try {
        const password_hash = await bcrypt.hash(password, SALT_ROUNDS)

        const result = await query(
            `INSERT INTO users(email, password_hash)
            VALUES($1, $2)
            RETURNING id, email, created_at`,
            [email.toLowerCase(), password_hash]
        )

        const user = result.rows[0]

        const token = jwt.sign(
            { userId: user.id, email: user.email },
            JWT_SECRET,
            { expiresIn: "7d" }
        )

        return res.status(201).json({
            message: "Account created",
            token,
            user: { id: user.id, email: user.email }
        })
    } catch (err) {
        if (err.code === "23505") {
            return res.status(409).json({ error: "Email already registered" })
        }
        console.error(err)
        return res.status(500).json({ error: "Registration failed" })
    }
})

router.post("/login", async (req, res) => {
    const { email, password } = req.body

    if (!email || !password) {
        return res.status(400).json({
            error: "Email and password are required"
        })
    }

    try {
        const result = await query(
            "SELECT* FROM users WHERE email =$1",
            [email.toLowerCase().trim()]
        )
        if (!result.rows.length) {
            return res.status(401).json({
                error: "Invalid email or password"
            })
        }
        const user = result.rows[0]

        const valid = await bcrypt.compare(password, user.password_hash)

        if (!valid) {
            return res.status(401).json({ error: "Inavlid email or password" })
        }

        const token = jwt.sign(
            { userId: user.id, email: user.email },
            JWT_SECRET,
            { expiresIn: "7d" }

        )
        return res.json({
            message: "Login successful",
            token,
            user: { id: user.id, email: user.email }
        })
    } catch (err) {
        console.error(err)
        return res.status(500).json({ error: "Login failed" })
    }

})

export default router