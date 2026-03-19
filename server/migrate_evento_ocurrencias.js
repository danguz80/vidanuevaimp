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
    await client.query(`
      CREATE TABLE IF NOT EXISTS evento_ocurrencias (
        id            SERIAL PRIMARY KEY,
        evento_id     INT  NOT NULL REFERENCES eventos(id) ON DELETE CASCADE,
        fecha         DATE NOT NULL,
        coordinador_id INT  REFERENCES miembros(id) ON DELETE SET NULL,
        predicador_id  INT  REFERENCES miembros(id) ON DELETE SET NULL,
        UNIQUE(evento_id, fecha)
      );
    `);
    console.log("✅ Tabla evento_ocurrencias creada (o ya existía).");
  } finally {
    client.release();
    await pool.end();
  }
}

migrate().catch(e => { console.error("❌ Error en migración:", e.message); process.exit(1); });
