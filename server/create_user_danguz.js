import bcrypt from "bcryptjs";
import pkg from "pg";

const { Pool } = pkg;

// Cadena de conexión directa
const pool = new Pool({
  connectionString: "postgresql://iglesia_db_o0d2_user:8XOeStmCnE8YrqtqR6Q8hIXpO7awAhdV@dpg-d0aidrer433s73fo2obg-a.oregon-postgres.render.com/iglesia_db_o0d2",
  ssl: {
    rejectUnauthorized: false,
  },
});

async function createUser() {
  const client = await pool.connect();
  
  try {
    // Crear tabla usuarios si no existe
    console.log("📋 Verificando/creando tabla usuarios...");
    await client.query(`
      CREATE TABLE IF NOT EXISTS usuarios (
        id SERIAL PRIMARY KEY,
        username VARCHAR(50) UNIQUE NOT NULL,
        password_hash VARCHAR(255) NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
    console.log("✅ Tabla usuarios lista");

    const username = "danguz80@outlook.com";
    const password = "20062006-Aa";
    const passwordHash = await bcrypt.hash(password, 10);

    console.log("\n🔐 Creando usuario...");
    console.log("Usuario:", username);
    console.log("Password hash:", passwordHash);

    await client.query(
      `INSERT INTO usuarios (username, password_hash) 
       VALUES ($1, $2) 
       ON CONFLICT (username) DO UPDATE 
       SET password_hash = EXCLUDED.password_hash`,
      [username, passwordHash]
    );

    console.log("\n✅ Usuario creado/actualizado exitosamente");
    console.log("\n📝 Credenciales de acceso:");
    console.log("Usuario:", username);
    console.log("Contraseña:", password);
    
  } catch (error) {
    console.error("❌ Error:", error.message);
  } finally {
    client.release();
    await pool.end();
  }
}

createUser();
