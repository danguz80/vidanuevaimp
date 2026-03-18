import dotenv from "dotenv";
import bcrypt from "bcryptjs";
import pkg from "pg";

dotenv.config();

const { Pool } = pkg;

const pool = new Pool({
  user: process.env.PGUSER,
  host: process.env.PGHOST,
  database: process.env.PGDATABASE,
  password: process.env.PGPASSWORD,
  port: parseInt(process.env.PGPORT),
  ssl: {
    rejectUnauthorized: false,
  },
});

async function createAdminUser() {
  const client = await pool.connect();
  
  try {
    // Crear tabla usuarios si no existe
    await client.query(`
      CREATE TABLE IF NOT EXISTS usuarios (
        id SERIAL PRIMARY KEY,
        username VARCHAR(50) UNIQUE NOT NULL,
        password_hash VARCHAR(255) NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
    
    console.log("✅ Tabla 'usuarios' creada o ya existe");

    // Crear usuario admin por defecto (usuario: admin, contraseña: admin123)
    const username = "admin";
    const password = "admin123";
    const passwordHash = await bcrypt.hash(password, 10);

    await client.query(
      `INSERT INTO usuarios (username, password_hash) 
       VALUES ($1, $2) 
       ON CONFLICT (username) DO NOTHING`,
      [username, passwordHash]
    );

    console.log("✅ Usuario admin creado (usuario: admin, contraseña: admin123)");
    console.log("⚠️  IMPORTANTE: Cambia la contraseña después del primer login");
    
  } catch (error) {
    console.error("❌ Error:", error.message);
  } finally {
    client.release();
    await pool.end();
  }
}

createAdminUser();
