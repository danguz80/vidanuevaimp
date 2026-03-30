// Script para generar contraseñas iniciales para todos los miembros
// Password = inicial del nombre + primer apellido (sin acentos, sin espacios, en minúsculas)
// Ejemplo: Daniel Guzman Sagredo → dguzman
//          Mónica Jara → mjara

import bcrypt from "bcryptjs";
import pkg from "pg";
const { Pool } = pkg;
import dotenv from "dotenv";
dotenv.config();

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

const normalizar = (str) =>
  (str || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9]/g, "")
    .toLowerCase();

async function generarPasswords() {
  const { rows: miembros } = await pool.query(
    "SELECT id, nombre, apellido FROM miembros ORDER BY id"
  );

  console.log(`Generando passwords para ${miembros.length} miembros...\n`);

  for (const m of miembros) {
    const inicial = normalizar(m.nombre.trim()[0]);
    const primerApellido = normalizar(m.apellido.trim().split(/\s+/)[0]);
    const passwordPlano = inicial + primerApellido;
    const hash = await bcrypt.hash(passwordPlano, 10);

    await pool.query("UPDATE miembros SET password_hash = $1 WHERE id = $2", [
      hash,
      m.id,
    ]);
    console.log(`  id=${m.id} ${m.nombre} ${m.apellido} → "${passwordPlano}"`);
  }

  console.log("\n✅ Passwords generados correctamente.");
  await pool.end();
}

generarPasswords().catch((err) => {
  console.error("Error:", err);
  process.exit(1);
});
