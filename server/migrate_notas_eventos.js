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
    // Agregar notas al evento base (default para todas sus ocurrencias)
    await client.query(`
      ALTER TABLE eventos
      ADD COLUMN IF NOT EXISTS notas TEXT;
    `);
    console.log("✅ Columna notas agregada a eventos.");

    // Agregar notas a la tabla de overrides por fecha
    await client.query(`
      ALTER TABLE evento_ocurrencias
      ADD COLUMN IF NOT EXISTS notas TEXT;
    `);
    console.log("✅ Columna notas agregada a evento_ocurrencias.");
  } finally {
    client.release();
    await pool.end();
  }
}

migrate().catch(e => { console.error("❌ Error en migración:", e.message); process.exit(1); });
