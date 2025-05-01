// server/db.js
import pkg from 'pg';
const { Pool } = pkg;
import dotenv from 'dotenv';
dotenv.config();

const pool = new Pool({
  host: 'localhost',
  port: 5433,
  user: 'danielguzmansagredo', // asegúrate que sea tu usuario de mac
  password: '', // déjalo vacío si no tienes contraseña
  database: 'iglesia',
});

export default pool;
