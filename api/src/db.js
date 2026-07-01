import pg from 'pg';
import fs from 'fs';

const { Pool } = pg;

const readSecret = (name, envFallback) => {
  const path = `/run/secrets/${name}`;
  if (fs.existsSync(path)) return fs.readFileSync(path, 'utf8').trim();
  return process.env[envFallback] || '';
};

const pool = process.env.DATABASE_URL
  ? new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false },
  })
  : new Pool({
    host: process.env.DB_HOST || 'postgres',
    port: 5432,
    user: readSecret('db_user', 'DB_USER'),
    password: readSecret('db_password', 'DB_PASSWORD'),
    database: readSecret('db_name', 'DB_NAME'),
    max: 20,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 5000,
  });

pool.on('error', (err) => console.error('Unexpected DB error', err));
pool.on('connect', () => console.log('PostgreSQL connected'));

export const query = (text, params) => pool.query(text, params);
export default pool;