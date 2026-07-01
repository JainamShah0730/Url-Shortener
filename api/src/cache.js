import Redis from "ioredis";

const redis = new Redis(process.env.REDIS_URL || "redis://redis:6379", {
    maxRetriesPerRequest: 3,
    retryStrategy: (times) => Math.min(times * 50, 2000),
})

redis.on("error", (err) => console.error("Redis error:", err.message))
redis.on("connect", () => console.log("Redis connected"))

const TTL = parseInt(process.env.CACHE_TTL || "3600")

export const setUrl = async (code, data) => {
    await redis.set(`url:${code}`, JSON.stringify(data), 'EX', TTL)
}

export const getUrl = async (code) => {
    const cached = await redis.get(`url:${code}`)
    return cached ? JSON.parse(cached) : null

}

export const deleteUrl = async (code) => {
    await redis.del(`url:${code}`)
}

export default redis