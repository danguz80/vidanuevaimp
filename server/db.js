// server/db.js
import pkg from 'pg';
const { Pool } = pkg;
import dotenv from 'dotenv';
dotenv.config();

// pg lee automáticamente PGHOST, PGPORT, PGUSER, PGPASSWORD, PGDATABASE del entorno.
// Render PostgreSQL requiere SSL en conexiones externas.
const pool = new Pool({
  ssl: process.env.PGHOST && !process.env.PGHOST.includes('localhost')
    ? { rejectUnauthorized: false }
    : false,
});

export default pool;
