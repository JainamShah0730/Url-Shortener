import pg from "pg"
import fs from "fs"

const { Pool } = pg


const password = fs.existsSync("/run/secrets/db_password")
  ? fs.readFileSync('/run/secrets/db_password', "utf8").trim()
  : process.env.DB_PASSWORD


const user = fs.existsSync('/run/secrets/db_user')
  ? fs.readFileSync('/run/secrets/db_user', 'utf8').trim()
  : process.env.DB_USER

const database = fs.existsSync('/run/secrets/db_name')
  ? fs.readFileSync('/run/secrets/db_name', 'utf8').trim()
  : process.env.DB_NAME;


const pool = new Pool({
  host: process.env.DB_HOST || "postgres",
  port: 5432,
  user,
  password,
  database,
  max: 20,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 5000,
})

pool.on("error", (err) => {
  console.error("Unexpected error on idle client ", err)
})

pool.on("connect", () => {
  console.log("PostgreSQL connected")
})

export const query = (text, params) => pool.query(text, params)
export default pool;
