import jwt from "jsonwebtoken"
import fs from 'fs'

const JWT_SECRET = fs.existsSync("/run/secrets/jwt_secret")
    ? fs.readFileSync("/run/secrets/jwt_secret", "utf8").trim()
    : process.env.JWT_SECRET

export const authenticate = (req, res, next) => {
    const authHeader = req.headers["authorization"]
    const token = authHeader?.split(" ")[1]

    if (!token) {
        return res.status(401).json({ error: " No token provided  " })
    }

    try {
        const decoded = jwt.verify(token, JWT_SECRET)
        req.user = decoded
        next()
    } catch (err) {
        return res.status(401).json({ error: "Invalid or expired token" })

    }
}

export { JWT_SECRET }