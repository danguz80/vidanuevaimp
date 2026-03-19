import pkg from "pg";
import dotenv from "dotenv";
dotenv.config();

const { Pool } = pkg;
const pool = new Pool({
  user: process.env.PGUSER,
  host: process.env.PGHOST,
  database: process.env.PGDATABASE,
  password: process.env.PGPASSWORD,
  port: parseInt(process.env.PGPORT),
  ssl: { rejectUnauthorized: false },
});

async function migrate() {
  const client = await pool.connect();
  try {
    await client.query(`
      ALTER TABLE eventos
        ADD COLUMN IF NOT EXISTS coordinador_id INTEGER REFERENCES miembros(id) ON DELETE SET NULL,
        ADD COLUMN IF NOT EXISTS predicador_id  INTEGER REFERENCES miembros(id) ON DELETE SET NULL
    `);
    console.log("✅ Columnas coordinador_id y predicador_id agregadas");

    // Migrar encargado_id → coordinador_id si existe el dato
    await client.query(`
      UPDATE eventos SET coordinador_id = encargado_id WHERE encargado_id IS NOT NULL AND coordinador_id IS NULL
    `);
    console.log("✅ Datos migrados de encargado_id a coordinador_id");

    await client.query(`ALTER TABLE eventos DROP COLUMN IF EXISTS encargado_id`);
    console.log("✅ Columna encargado_id eliminada");

    console.log("✅ Migración completada.");
  } catch (e) {
    console.error("❌ Error:", e.message);
  } finally {
    client.release();
    await pool.end();
  }
}

migrate();
