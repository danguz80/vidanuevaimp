import pg from "pg";
import dotenv from "dotenv";
dotenv.config();
const { Pool } = pg;

const pool = new Pool({
  host: process.env.PGHOST,
  port: process.env.PGPORT || 5432,
  database: process.env.PGDATABASE,
  user: process.env.PGUSER,
  password: process.env.PGPASSWORD,
  ssl: { rejectUnauthorized: false },
});

async function migrate() {
  const client = await pool.connect();
  try {
    await client.query(`ALTER TABLE eventos ADD COLUMN IF NOT EXISTS encargado_id INT REFERENCES miembros(id) ON DELETE SET NULL;`);
    console.log("✅ encargado_id agregado a eventos.");
    await client.query(`ALTER TABLE evento_ocurrencias ADD COLUMN IF NOT EXISTS encargado_id INT REFERENCES miembros(id) ON DELETE SET NULL;`);
    console.log("✅ encargado_id agregado a evento_ocurrencias.");
  } finally {
    client.release();
    await pool.end();
  }
}

migrate().catch(e => { console.error("❌", e.message); process.exit(1); });
