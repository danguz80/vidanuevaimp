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
      CREATE TABLE IF NOT EXISTS miembros (
        id SERIAL PRIMARY KEY,
        nombre VARCHAR(100) NOT NULL,
        apellido VARCHAR(100) NOT NULL,
        foto_url TEXT,
        fecha_nacimiento DATE,
        celular VARCHAR(30),
        email VARCHAR(150),
        direccion TEXT,
        estado VARCHAR(20) DEFAULT 'activo',
        notas TEXT,
        created_at TIMESTAMP DEFAULT NOW()
      )
    `);
    console.log("✅ Tabla miembros creada");

    await client.query(`
      CREATE TABLE IF NOT EXISTS miembro_roles (
        miembro_id INTEGER REFERENCES miembros(id) ON DELETE CASCADE,
        rol VARCHAR(50) NOT NULL,
        PRIMARY KEY (miembro_id, rol)
      )
    `);
    console.log("✅ Tabla miembro_roles creada");

    await client.query(`
      CREATE TABLE IF NOT EXISTS eventos (
        id SERIAL PRIMARY KEY,
        titulo VARCHAR(200) NOT NULL,
        descripcion TEXT,
        imagen_url TEXT,
        fecha_inicio TIMESTAMP NOT NULL,
        fecha_fin TIMESTAMP,
        lugar VARCHAR(200),
        tipo VARCHAR(20) DEFAULT 'especial',
        recurrencia VARCHAR(20) DEFAULT 'ninguna',
        dia_semana INTEGER,
        encargado_id INTEGER REFERENCES miembros(id) ON DELETE SET NULL,
        color VARCHAR(20) DEFAULT '#3B82F6',
        created_at TIMESTAMP DEFAULT NOW()
      )
    `);
    console.log("✅ Tabla eventos creada");

    console.log("✅ Migración completada.");
  } catch (e) {
    console.error("❌ Error en migración:", e.message);
  } finally {
    client.release();
    await pool.end();
  }
}

migrate();
