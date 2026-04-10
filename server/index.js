import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import { subDays } from "date-fns";
import pkg from "pg";
import axios from "axios";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import crypto from "crypto";
import nodemailer from "nodemailer";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

import { v2 as cloudinary } from "cloudinary";
import { OAuth2Client } from "google-auth-library";

const googleClient = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);
import { sendDonationReceipt, saveDonation, sendCashDonationReceipt } from "./emailService.js";

// ✅ Cargar .env lo antes posible
dotenv.config();

// ✅ Configurar cloudinary después de cargar variables
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

const { Pool, types } = pkg;

// TIMESTAMP WITHOUT TIME ZONE (OID 1114) → retorna string ISO sin Z.
// Evita que pg convierta a Date usando la tz local del servidor,
// lo que causaría desfase al serializar como UTC en JSON.
types.setTypeParser(1114, val => val ? val.replace(' ', 'T') : val);

const app = express();
app.use(
  cors({
    origin: [
      "https://vidanuevaimp.com", 
      "http://localhost:5173",
      /^https:\/\/.*\.app\.github\.dev$/  // Permite todos los dominios de Codespaces
    ],
    methods: ["GET", "POST", "PUT", "DELETE"],
    credentials: true,
  })
);
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true, limit: "10mb" }));

const pool = new Pool({
  user: process.env.PGUSER,
  host: process.env.PGHOST,
  database: process.env.PGDATABASE,
  password: process.env.PGPASSWORD,
  port: parseInt(process.env.PGPORT),
  ssl: {
    rejectUnauthorized: false, // necesario en Render
  },
});

// Middleware para verificar token JWT
const authenticateToken = (req, res, next) => {
  const authHeader = req.headers["authorization"];
  const token = authHeader && authHeader.split(" ")[1]; // Bearer TOKEN

  if (!token) {
    return res.status(401).json({ error: "Token no proporcionado" });
  }

  jwt.verify(token, process.env.JWT_SECRET, (err, user) => {
    if (err) {
      return res.status(403).json({ error: "Token inválido o expirado" });
    }
    req.user = user;
    next();
  });
};

// Endpoint de login
app.post("/api/auth/login", async (req, res) => {
  const { username, password } = req.body;

  if (!username || !password) {
    return res.status(400).json({ error: "Usuario y contraseña requeridos" });
  }

  try {
    const client = await pool.connect();
    const result = await client.query("SELECT * FROM usuarios WHERE username = $1", [username]);
    client.release();

    if (result.rows.length === 0) {
      return res.status(401).json({ error: "Credenciales inválidas" });
    }

    const user = result.rows[0];
    const validPassword = await bcrypt.compare(password, user.password_hash);

    if (!validPassword) {
      return res.status(401).json({ error: "Credenciales inválidas" });
    }

    // Generar token JWT
    const token = jwt.sign(
      { id: user.id, username: user.username },
      process.env.JWT_SECRET,
      { expiresIn: "24h" }
    );

    res.json({ token, username: user.username });
  } catch (error) {
    console.error("Error en login:", error.message);
    res.status(500).json({ error: "Error al iniciar sesión" });
  }
});

// Endpoint para verificar token
app.get("/api/auth/verify", authenticateToken, (req, res) => {
  res.json({ valid: true, user: req.user });
});

// GET /api/auth/mis-roles — roles del admin logueado
app.get("/api/auth/mis-roles", authenticateToken, async (req, res) => {
  const { id } = req.user;
  try {
    const miembroCheck = await pool.query("SELECT id FROM miembros WHERE id = $1", [id]);
    if (miembroCheck.rows.length > 0) {
      const rolesRes = await pool.query("SELECT rol FROM miembro_roles WHERE miembro_id = $1", [id]);
      const roles = rolesRes.rows.map(r => r.rol);
      if (roles.length === 0) roles.push("admin");
      return res.json({ roles });
    }
    return res.json({ roles: ["admin"] });
  } catch (err) {
    console.error("Error mis-roles:", err.message);
    res.status(500).json({ error: "Error al obtener roles" });
  }
});

// Middleware de acceso a secretaría (admin, Pastor, Obispo, Secretario)
const requireSecretariaAccess = async (req, res, next) => {
  const { id } = req.user;
  try {
    const miembroCheck = await pool.query("SELECT id FROM miembros WHERE id = $1", [id]);
    if (miembroCheck.rows.length === 0) return next(); // usuario sistema → acceso total
    const rolesRes = await pool.query(
      "SELECT rol FROM miembro_roles WHERE miembro_id = $1 AND rol = ANY($2::text[])",
      [id, ["admin", "Pastor", "Obispo", "Secretario"]]
    );
    if (rolesRes.rows.length > 0) return next();
    return res.status(403).json({ error: "No tienes permiso para acceder a esta sección" });
  } catch (err) {
    console.error("Error requireSecretariaAccess:", err.message);
    res.status(500).json({ error: "Error de autorización" });
  }
};

// ──────────────────────────────────────────────
// AUTH MIEMBROS (portal de miembros)
// ──────────────────────────────────────────────

// Middleware para autenticar token de miembro
const authenticateMiembro = (req, res, next) => {
  const authHeader = req.headers["authorization"];
  const token = authHeader && authHeader.split(" ")[1];
  if (!token) return res.status(401).json({ error: "Token requerido" });
  jwt.verify(token, process.env.JWT_SECRET, (err, payload) => {
    if (err || payload.tipo !== "miembro") return res.status(403).json({ error: "Acceso denegado" });
    req.miembro = payload;
    next();
  });
};

// Login miembro: POST /api/miembros/login
app.post("/api/miembros/login", async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) return res.status(400).json({ error: "Email y contraseña requeridos" });

  try {
    const result = await pool.query(
      "SELECT id, nombre, apellido, foto_url, email, password_hash FROM miembros WHERE LOWER(email) = LOWER($1)",
      [email.trim()]
    );
    if (result.rows.length === 0) return res.status(401).json({ error: "Credenciales inválidas" });

    const miembro = result.rows[0];
    if (!miembro.password_hash) return res.status(401).json({ error: "Cuenta no configurada, contacta al administrador" });

    const valid = await bcrypt.compare(password, miembro.password_hash);
    if (!valid) return res.status(401).json({ error: "Credenciales inválidas" });

    const rolesRes = await pool.query("SELECT rol FROM miembro_roles WHERE miembro_id = $1", [miembro.id]);
    const roles = rolesRes.rows.map(r => r.rol);
    const esAdmin = roles.includes("admin");

    const token = jwt.sign(
      { id: miembro.id, nombre: miembro.nombre, apellido: miembro.apellido, tipo: "miembro" },
      process.env.JWT_SECRET,
      { expiresIn: "7d" }
    );

    let adminToken = null;
    if (esAdmin) {
      adminToken = jwt.sign(
        { id: miembro.id, username: `${miembro.nombre} ${miembro.apellido}` },
        process.env.JWT_SECRET,
        { expiresIn: "7d" }
      );
    }

    res.json({
      token,
      adminToken,
      miembro: {
        id: miembro.id,
        nombre: miembro.nombre,
        apellido: miembro.apellido,
        foto_url: miembro.foto_url,
        email: miembro.email,
        esAdmin,
      },
    });
  } catch (err) {
    console.error("Error login miembro:", err.message);
    res.status(500).json({ error: "Error al iniciar sesión" });
  }
});

// Obtener mi perfil: GET /api/miembros/me
app.get("/api/miembros/me", authenticateMiembro, async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT m.id, m.nombre, m.apellido, m.foto_url, m.email, m.celular,
              m.fecha_nacimiento, m.direccion, m.estado, m.notas, m.acerca_de_mi,
              COALESCE(json_agg(mr.rol) FILTER (WHERE mr.rol IS NOT NULL), '[]') AS roles
       FROM miembros m
       LEFT JOIN miembro_roles mr ON mr.miembro_id = m.id
       WHERE m.id = $1
       GROUP BY m.id`,
      [req.miembro.id]
    );
    if (result.rows.length === 0) return res.status(404).json({ error: "Miembro no encontrado" });
    res.json(result.rows[0]);
  } catch (err) {
    console.error("Error GET /api/miembros/me:", err.message);
    res.status(500).json({ error: "Error al obtener perfil" });
  }
});

// Cambiar contraseña: PUT /api/miembros/me/password
app.put("/api/miembros/me/password", authenticateMiembro, async (req, res) => {
  const { passwordActual, passwordNuevo } = req.body;
  if (!passwordActual || !passwordNuevo) return res.status(400).json({ error: "Faltan datos" });
  if (passwordNuevo.length < 6) return res.status(400).json({ error: "La contraseña debe tener al menos 6 caracteres" });

  try {
    const result = await pool.query("SELECT password_hash FROM miembros WHERE id = $1", [req.miembro.id]);
    const miembro = result.rows[0];
    const valid = await bcrypt.compare(passwordActual, miembro.password_hash);
    if (!valid) return res.status(401).json({ error: "Contraseña actual incorrecta" });

    const newHash = await bcrypt.hash(passwordNuevo, 10);
    await pool.query("UPDATE miembros SET password_hash = $1 WHERE id = $2", [newHash, req.miembro.id]);
    res.json({ ok: true });
  } catch (err) {
    console.error("Error cambiar password miembro:", err.message);
    res.status(500).json({ error: "Error al cambiar contraseña" });
  }
});

// POST /api/miembros/me/foto-perfil — miembro cambia su propia foto (máx 1MB)
app.post("/api/miembros/me/foto-perfil", authenticateMiembro, async (req, res) => {
  const { imagen_base64 } = req.body;
  if (!imagen_base64) return res.status(400).json({ error: "Imagen requerida" });

  const base64Data = imagen_base64.replace(/^data:image\/\w+;base64,/, "");
  if (base64Data.length > 1437773) {
    return res.status(413).json({ error: "La imagen supera el límite de 1 MB" });
  }

  const mimeMatch = imagen_base64.match(/^data:(image\/(?:jpeg|png|webp|gif));base64,/);
  if (!mimeMatch) return res.status(400).json({ error: "Formato de imagen no permitido (usa JPG, PNG o WebP)" });
  const ext = mimeMatch[1].split("/")[1].replace("jpeg", "jpg");

  try {
    const __dirname = path.dirname(fileURLToPath(import.meta.url));
    const fotosDir = path.join(__dirname, "../client/public/fotos_perfil");
    if (!fs.existsSync(fotosDir)) fs.mkdirSync(fotosDir, { recursive: true });

    const dbClient = await pool.connect();
    const miembroId = req.miembro.id;

    const miembroRes = await dbClient.query("SELECT nombre, apellido, foto_url FROM miembros WHERE id=$1", [miembroId]);
    if (miembroRes.rows.length === 0) { dbClient.release(); return res.status(404).json({ error: "Miembro no encontrado" }); }

    const { nombre, apellido, foto_url: fotoAnterior } = miembroRes.rows[0];

    const normalizar = (str) =>
      (str || "")
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .replace(/[^a-zA-Z0-9]/g, "")
        .toLowerCase();

    const parteNombre   = nombre.trim().split(/\s+/);
    const parteApellido = apellido.trim().split(/\s+/);

    const inicialNombre  = normalizar(parteNombre[0])[0] || "x";
    const primerApellido = normalizar(parteApellido[0]) || "miembro";
    const inicialSegundo = parteApellido[1] ? (normalizar(parteApellido[1])[0] || "") : "";

    const baseNombre = `${inicialNombre}${primerApellido}`;

    const conflicto = await dbClient.query(
      `SELECT id FROM miembros WHERE id <> $1 AND foto_url LIKE $2`,
      [miembroId, `/fotos_perfil/${baseNombre}.%`]
    );

    const baseFinal = conflicto.rows.length > 0 && inicialSegundo
      ? `${baseNombre}${inicialSegundo}`
      : baseNombre;
    const fileName = `${baseFinal}.${ext}`;

    if (fotoAnterior && fotoAnterior.startsWith("/fotos_perfil/")) {
      const archivoAnterior = path.join(fotosDir, path.basename(fotoAnterior));
      if (fs.existsSync(archivoAnterior)) fs.unlinkSync(archivoAnterior);
    }
    const filePathFinal = path.join(fotosDir, fileName);
    if (fs.existsSync(filePathFinal)) fs.unlinkSync(filePathFinal);

    fs.writeFileSync(filePathFinal, Buffer.from(base64Data, "base64"));

    const foto_url = `/fotos_perfil/${fileName}`;
    await dbClient.query("UPDATE miembros SET foto_url=$1 WHERE id=$2", [foto_url, miembroId]);
    dbClient.release();

    res.json({ foto_url });
  } catch (error) {
    console.error("Error al guardar foto de perfil (miembro):", error);
    res.status(500).json({ error: "Error al guardar foto" });
  }
});

// PUT /api/miembros/me/acerca-de-mi — miembro actualiza su descripción personal
app.put("/api/miembros/me/acerca-de-mi", authenticateMiembro, async (req, res) => {
  const { acerca_de_mi } = req.body;
  const texto = (acerca_de_mi || "").trim();
  const palabras = texto ? texto.split(/\s+/).filter(Boolean) : [];
  if (palabras.length > 100) {
    return res.status(400).json({ error: "El texto no puede superar las 100 palabras" });
  }
  try {
    await pool.query(
      "UPDATE miembros SET acerca_de_mi = $1 WHERE id = $2",
      [texto || null, req.miembro.id]
    );
    res.json({ ok: true });
  } catch (err) {
    console.error("Error acerca_de_mi:", err.message);
    res.status(500).json({ error: "Error al guardar" });
  }
});

// ── Disponibilidad / Bloqueo de fechas ─────────────────────────────────────

// GET /api/miembros/me/disponibilidad — periodos bloqueados del miembro autenticado
app.get("/api/miembros/me/disponibilidad", authenticateMiembro, async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT id, fecha_inicio::date AS fecha_inicio, fecha_fin::date AS fecha_fin, motivo
       FROM disponibilidad_bloqueada
       WHERE miembro_id = $1
       ORDER BY fecha_inicio ASC`,
      [req.miembro.id]
    );
    res.json(result.rows);
  } catch (err) {
    console.error("Error GET disponibilidad:", err.message);
    res.status(500).json({ error: "Error al obtener disponibilidad" });
  }
});

// POST /api/miembros/me/disponibilidad — bloquear un periodo
app.post("/api/miembros/me/disponibilidad", authenticateMiembro, async (req, res) => {
  const { fecha_inicio, fecha_fin, motivo } = req.body;
  if (!fecha_inicio) return res.status(400).json({ error: "La fecha de inicio es requerida" });
  const fin = fecha_fin || fecha_inicio; // si no hay fin, es un solo día
  if (fin < fecha_inicio) return res.status(400).json({ error: "La fecha fin no puede ser anterior al inicio" });
  try {
    const result = await pool.query(
      `INSERT INTO disponibilidad_bloqueada (miembro_id, fecha_inicio, fecha_fin, motivo)
       VALUES ($1, $2, $3, $4)
       RETURNING id, fecha_inicio::date AS fecha_inicio, fecha_fin::date AS fecha_fin, motivo`,
      [req.miembro.id, fecha_inicio, fin, motivo?.trim() || null]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error("Error POST disponibilidad:", err.message);
    res.status(500).json({ error: "Error al guardar periodo" });
  }
});

// DELETE /api/miembros/me/disponibilidad/:id — eliminar un periodo (solo el propio)
app.delete("/api/miembros/me/disponibilidad/:id", authenticateMiembro, async (req, res) => {
  try {
    const result = await pool.query(
      "DELETE FROM disponibilidad_bloqueada WHERE id = $1 AND miembro_id = $2 RETURNING id",
      [req.params.id, req.miembro.id]
    );
    if (result.rows.length === 0)
      return res.status(404).json({ error: "Periodo no encontrado" });
    res.json({ ok: true });
  } catch (err) {
    console.error("Error DELETE disponibilidad:", err.message);
    res.status(500).json({ error: "Error al eliminar periodo" });
  }
});

// GET /api/miembros/disponibilidad-bloqueada?fecha=YYYY-MM-DD
// Devuelve IDs de miembros NO disponibles en la fecha indicada (para admin)
app.get("/api/miembros/disponibilidad-bloqueada", authenticateToken, async (req, res) => {
  const { fecha } = req.query;
  if (!fecha) return res.status(400).json({ error: "Se requiere ?fecha=YYYY-MM-DD" });
  try {
    const result = await pool.query(
      `SELECT DISTINCT miembro_id
       FROM disponibilidad_bloqueada
       WHERE $1::date BETWEEN fecha_inicio AND fecha_fin`,
      [fecha]
    );
    res.json(result.rows.map(r => r.miembro_id));
  } catch (err) {
    console.error("Error disponibilidad-bloqueada:", err.message);
    res.status(500).json({ error: "Error al consultar disponibilidad" });
  }
});

// GET /api/miembros/me/compromisos — lista plana de compromisos futuros del miembro
app.get("/api/miembros/me/compromisos", authenticateMiembro, async (req, res) => {
  const miembroId = req.miembro.id;
  try {
    // Eventos base donde es coordinador o predicador (no encargado)
    const evRes = await pool.query(`
      SELECT e.id, e.titulo, e.color, e.lugar, e.recurrencia, e.dia_semana,
             e.fecha_inicio::text AS fecha_inicio, e.fecha_fin::text AS fecha_fin, e.tipo,
             CASE
               WHEN e.coordinador_id = $1 THEN 'Coordinador'
               WHEN e.predicador_id  = $1 THEN 'Predicador'
             END AS rol_base
      FROM eventos e
      WHERE e.coordinador_id = $1 OR e.predicador_id = $1
      ORDER BY e.fecha_inicio ASC
    `, [miembroId]);

    // Ocurrencias específicas futuras donde es coordinador o predicador (no encargado)
    const ocRes = await pool.query(`
      SELECT oc.evento_id, oc.fecha::text AS fecha,
             e.titulo, e.color, e.lugar,
             CASE
               WHEN oc.coordinador_id = $1 THEN 'Coordinador'
               WHEN oc.predicador_id  = $1 THEN 'Predicador'
             END AS rol
      FROM evento_ocurrencias oc
      JOIN eventos e ON e.id = oc.evento_id
      WHERE (oc.coordinador_id = $1 OR oc.predicador_id = $1)
        AND oc.fecha >= CURRENT_DATE
      ORDER BY oc.fecha ASC
    `, [miembroId]);

    // Portería del mes
    const portRes = await pool.query(`
      SELECT anio, mes FROM portero_mes WHERE miembro_id = $1 ORDER BY anio ASC, mes ASC
    `, [miembroId]);

    // Fechas donde el miembro fue explícitamente removido via null-override (reset de mes)
    // Son filas en evento_ocurrencias donde él era base pero le pusieron coord/pred = NULL
    const nullOverrideRes = await pool.query(`
      SELECT oc.evento_id, oc.fecha::text AS fecha
      FROM evento_ocurrencias oc
      JOIN eventos e ON e.id = oc.evento_id
      WHERE (e.coordinador_id = $1 OR e.predicador_id = $1)
        AND oc.coordinador_id IS NULL
        AND oc.predicador_id  IS NULL
        AND oc.fecha >= CURRENT_DATE
    `, [miembroId]);

    const nullOverrideSet = new Set(nullOverrideRes.rows.map(r => `${r.evento_id}_${r.fecha}`));

    // ── Calcular lista plana de próximos compromisos (próximos 90 días) ──────
    const hoy = new Date();
    hoy.setHours(0, 0, 0, 0);
    const limite = new Date(hoy);
    limite.setDate(limite.getDate() + 90);

    // Usar Map keyed por "eventoId_fecha" para deduplicar (ocurrencia override tiene prioridad)
    const proximosMap = new Map();

    // Primero ocurrencias específicas (ya filtradas >= hoy en la query)
    for (const oc of ocRes.rows) {
      const key = `${oc.evento_id}_${oc.fecha}`;
      proximosMap.set(key, {
        evento_id: oc.evento_id,
        titulo: oc.titulo,
        fecha: oc.fecha,
        rol: oc.rol,
        color: oc.color || '#3B82F6',
        lugar: oc.lugar || '',
      });
    }

    // Luego expandir eventos base recurrentes (sin sobreescribir ocurrencias ya puestas,
    // y saltando fechas donde el miembro fue removido via null-override)
    for (const ev of evRes.rows) {
      const addFecha = (fecha) => {
        const key = `${ev.id}_${fecha}`;
        if (proximosMap.has(key)) return;       // ya tiene override con asignación
        if (nullOverrideSet.has(key)) return;   // fue removido explícitamente (reset)
        proximosMap.set(key, {
          evento_id: ev.id,
          titulo: ev.titulo,
          fecha,
          rol: ev.rol_base,
          color: ev.color || '#3B82F6',
          lugar: ev.lugar || '',
        });
      };

      if (!ev.recurrencia || ev.recurrencia === 'ninguna') {
        if (ev.fecha_inicio) {
          const f = new Date(ev.fecha_inicio + 'T00:00:00');
          if (f >= hoy && f <= limite) addFecha(ev.fecha_inicio.slice(0, 10));
        }
      } else if (ev.recurrencia === 'semanal') {
        const ds = ev.dia_semana ?? (ev.fecha_inicio ? new Date(ev.fecha_inicio + 'T00:00:00').getDay() : 0);
        let d = new Date(hoy);
        while (d.getDay() !== ds) d.setDate(d.getDate() + 1);
        while (d <= limite) {
          addFecha(d.toISOString().slice(0, 10));
          d.setDate(d.getDate() + 7);
        }
      } else if (ev.recurrencia === 'quincenal') {
        const ds = ev.dia_semana ?? (ev.fecha_inicio ? new Date(ev.fecha_inicio + 'T00:00:00').getDay() : 0);
        let d = new Date(hoy);
        while (d.getDay() !== ds) d.setDate(d.getDate() + 1);
        let cnt = 0;
        while (d <= limite) {
          if (cnt % 2 === 0) addFecha(d.toISOString().slice(0, 10));
          d.setDate(d.getDate() + 7);
          cnt++;
        }
      } else if (ev.recurrencia === 'mensual' && ev.fecha_inicio) {
        const dayOfMonth = new Date(ev.fecha_inicio + 'T00:00:00').getDate();
        let d = new Date(hoy.getFullYear(), hoy.getMonth(), dayOfMonth);
        if (d < hoy) d = new Date(hoy.getFullYear(), hoy.getMonth() + 1, dayOfMonth);
        while (d <= limite) {
          addFecha(d.toISOString().slice(0, 10));
          d = new Date(d.getFullYear(), d.getMonth() + 1, dayOfMonth);
        }
      }
    }

    const proximos = Array.from(proximosMap.values())
      .sort((a, b) => a.fecha.localeCompare(b.fecha));

    res.json({ proximos, portero: portRes.rows });
  } catch (err) {
    console.error("Error GET compromisos:", err.message);
    res.status(500).json({ error: "Error al obtener compromisos" });
  }
});

// Login miembro con Google: POST /api/miembros/auth/google
app.post("/api/miembros/auth/google", async (req, res) => {
  const { credential } = req.body;
  if (!credential) return res.status(400).json({ error: "Token de Google requerido" });

  try {
    const ticket = await googleClient.verifyIdToken({
      idToken: credential,
      audience: process.env.GOOGLE_CLIENT_ID,
    });
    const payload = ticket.getPayload();
    const emailGoogle = payload.email;

    if (!payload.email_verified) {
      return res.status(401).json({ error: "El email de Google no está verificado" });
    }

    const result = await pool.query(
      "SELECT id, nombre, apellido, foto_url, email FROM miembros WHERE LOWER(email) = LOWER($1)",
      [emailGoogle]
    );

    if (result.rows.length === 0) {
      return res.status(401).json({ error: "Tu cuenta de Google no está registrada como miembro. Contacta al administrador." });
    }

    const miembro = result.rows[0];

    const rolesRes = await pool.query("SELECT rol FROM miembro_roles WHERE miembro_id = $1", [miembro.id]);
    const roles = rolesRes.rows.map(r => r.rol);
    const esAdmin = roles.includes("admin");

    const token = jwt.sign(
      { id: miembro.id, nombre: miembro.nombre, apellido: miembro.apellido, tipo: "miembro" },
      process.env.JWT_SECRET,
      { expiresIn: "7d" }
    );

    let adminToken = null;
    if (esAdmin) {
      adminToken = jwt.sign(
        { id: miembro.id, username: `${miembro.nombre} ${miembro.apellido}` },
        process.env.JWT_SECRET,
        { expiresIn: "7d" }
      );
    }

    res.json({
      token,
      adminToken,
      miembro: {
        id: miembro.id,
        nombre: miembro.nombre,
        apellido: miembro.apellido,
        foto_url: miembro.foto_url,
        email: miembro.email,
        esAdmin,
      },
    });
  } catch (err) {
    console.error("Error Google login miembro:", err.message);
    res.status(500).json({ error: "Error al verificar cuenta de Google" });
  }
});

// Endpoint: solicitar recuperación de contraseña
app.post("/api/auth/forgot-password", async (req, res) => {
  const { email } = req.body;
  if (!email) return res.status(400).json({ error: "Email requerido" });

  try {
    const result = await pool.query("SELECT * FROM usuarios WHERE email = $1", [email]);
    // Responder siempre igual para no revelar si el email existe
    if (result.rows.length === 0) {
      return res.json({ message: "Si el email existe, recibirás un enlace de recuperación." });
    }

    const user = result.rows[0];
    // Token aleatorio seguro
    const token = crypto.randomBytes(32).toString("hex");
    const expires = new Date(Date.now() + 60 * 60 * 1000); // 1 hora

    await pool.query(
      "UPDATE usuarios SET reset_token = $1, reset_token_expires = $2 WHERE id = $3",
      [token, expires, user.id]
    );

    const resetUrl = `${process.env.FRONTEND_URL || "https://vidanuevaimp.com"}/reset-password?token=${token}`;

    // Enviar email
    const transporter = nodemailer.createTransport({
      service: "gmail",
      auth: { user: process.env.EMAIL_USER, pass: process.env.EMAIL_PASSWORD },
    });

    try {
      await transporter.sendMail({
        from: `"Iglesia Vida Nueva" <${process.env.EMAIL_USER}>`,
        to: email,
        subject: "Recuperación de contraseña - Panel Admin",
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 520px; margin: auto; padding: 32px; border: 1px solid #e5e7eb; border-radius: 8px;">
            <h2 style="color: #1d4ed8;">Recuperación de Contraseña</h2>
            <p>Recibimos una solicitud para restablecer la contraseña de tu cuenta de administrador.</p>
            <p>Haz clic en el botón para crear una nueva contraseña. El enlace expira en <strong>1 hora</strong>.</p>
            <div style="text-align: center; margin: 32px 0;">
              <a href="${resetUrl}" style="background-color:#1d4ed8;color:#fff;padding:12px 28px;border-radius:6px;text-decoration:none;font-weight:bold;">
                Restablecer Contraseña
              </a>
            </div>
            <p style="font-size:12px;color:#9ca3af;">Si no solicitaste esto, ignora este mensaje. Tu contraseña no cambiará.</p>
            <hr style="border:none;border-top:1px solid #e5e7eb;margin-top:24px;" />
            <p style="font-size:11px;color:#9ca3af;text-align:center;">Iglesia Misión Pentecostés Templo Vida Nueva</p>
          </div>
        `,
      });
    } catch (emailError) {
      // El email falló pero el token ya fue guardado — loguear y continuar
      console.error("Error al enviar email de recuperación:", emailError.message);
      // En desarrollo, mostrar el enlace en consola como fallback
      console.log("🔗 Enlace de recuperación (fallback):", resetUrl);
    }

    res.json({ message: "Si el email existe, recibirás un enlace de recuperación." });
  } catch (error) {
    console.error("Error en forgot-password:", error);
    res.status(500).json({ error: "Error al procesar la solicitud" });
  }
});

// Endpoint: restablecer contraseña con token
app.post("/api/auth/reset-password", async (req, res) => {
  const { token, newPassword } = req.body;
  if (!token || !newPassword) return res.status(400).json({ error: "Token y nueva contraseña requeridos" });
  if (newPassword.length < 8) return res.status(400).json({ error: "La contraseña debe tener al menos 8 caracteres" });

  try {
    const result = await pool.query(
      "SELECT * FROM usuarios WHERE reset_token = $1 AND reset_token_expires > NOW()",
      [token]
    );

    if (result.rows.length === 0) {
      return res.status(400).json({ error: "Token inválido o expirado" });
    }

    const user = result.rows[0];
    const passwordHash = await bcrypt.hash(newPassword, 10);

    await pool.query(
      "UPDATE usuarios SET password_hash = $1, reset_token = NULL, reset_token_expires = NULL WHERE id = $2",
      [passwordHash, user.id]
    );

    res.json({ message: "Contraseña restablecida exitosamente" });
  } catch (error) {
    console.error("Error en reset-password:", error);
    res.status(500).json({ error: "Error al restablecer contraseña" });
  }
});

// ========================
// 📝 ENDPOINTS EXISTENTES
// ========================


// --- Nuevo endpoint para agregar sermón manualmente ---
app.post("/api/sermones", authenticateToken, async (req, res) => {
  const { videoId, title, thumbnail, start, publishedAt, sundayDate } = req.body;

  if (!videoId) {
    return res.status(400).json({ error: "videoId es requerido" });
  }

  try {
    const client = await pool.connect();
    const result = await client.query(
      `INSERT INTO sermones (video_id, titulo, thumbnail, start_time, fecha_publicacion, sunday_date)
       VALUES ($1, $2, $3, $4, $5, $6)
       ON CONFLICT (video_id) DO UPDATE SET
         titulo = EXCLUDED.titulo,
         thumbnail = EXCLUDED.thumbnail,
         start_time = EXCLUDED.start_time,
         fecha_publicacion = EXCLUDED.fecha_publicacion,
         sunday_date = EXCLUDED.sunday_date
       RETURNING *`,
      [videoId, title || "", thumbnail || "", start || 0, publishedAt || new Date(), sundayDate || new Date()]
    );
    client.release();

    res.status(201).json(result.rows[0]);
  } catch (error) {
    console.error("Error al insertar/actualizar sermón:", error);
    res.status(500).json({ error: "Error del servidor" });
  }
});


// --- API obtener últimos sermones ---
// Reemplazar el app.get("/api/sermones") para evitar usar la API de YouTube:

app.get("/api/sermones", async (req, res) => {
  try {
    const client = await pool.connect();
    const result = await client.query(
      "SELECT video_id, start_time, titulo, fecha_publicacion, sunday_date, thumbnail FROM sermones ORDER BY sunday_date DESC LIMIT 3"
    );
    client.release();

    const videos = result.rows.map((row) => ({
      videoId: row.video_id,
      title: row.titulo,
      publishedAt: row.fecha_publicacion,
      sundayDate: row.sunday_date,
      thumbnail: row.thumbnail,
      start: row.start_time || 0,
    }));

    res.json(videos);
  } catch (error) {
    console.error("Error al obtener videos desde base de datos:", error);
    res.status(500).json({ error: "Error al obtener videos" });
  }
});

// --- API actualizar sermón ---
app.put("/api/sermones/:videoId", authenticateToken, async (req, res) => {
  const { videoId } = req.params;
  const { start, title, fecha_publicacion, sunday_date, thumbnail } = req.body;

  try {
    const client = await pool.connect();
    await client.query(
      `INSERT INTO sermones (video_id, start_time, titulo, fecha_publicacion, sunday_date, thumbnail)
       VALUES ($1, $2, $3, $4, $5, $6)
       ON CONFLICT (video_id) DO UPDATE 
       SET start_time = $2, titulo = $3, fecha_publicacion = $4, sunday_date = $5, thumbnail = $6`,
      [videoId, start, title, fecha_publicacion, sunday_date, thumbnail]
    );
    client.release();

    res.json({ message: "Sermón actualizado correctamente" });
  } catch (error) {
    console.error("Error al actualizar sermón:", error.message);
    res.status(500).json({ error: "No se pudo actualizar el sermón" });
  }
});

// --- API eliminar sermón ---
app.delete("/api/sermones/:videoId", authenticateToken, async (req, res) => {
  const { videoId } = req.params;

  try {
    const client = await pool.connect();
    await client.query("DELETE FROM sermones WHERE video_id = $1", [videoId]);
    client.release();

    res.json({ message: "Video eliminado correctamente" });
  } catch (error) {
    console.error("Error al eliminar video:", error.message);
    res.status(500).json({ error: "Error al eliminar el video" });
  }
});

// --- API enviar mensaje de contacto ---
app.post("/api/contacto", async (req, res) => {
  const { nombre, correo, mensaje } = req.body;

  if (!nombre || !correo || !mensaje) {
    return res.status(400).json({ error: "Faltan campos obligatorios" });
  }

  try {
    const client = await pool.connect();
    await client.query(
      "INSERT INTO mensajes (nombre, correo, mensaje) VALUES ($1, $2, $3)",
      [nombre, correo, mensaje]
    );
    client.release();

    res.json({ message: "Mensaje enviado correctamente" });
  } catch (error) {
    console.error("Error al enviar mensaje:", error);
    res.status(500).json({ error: "Error al enviar el mensaje" });
  }
});

// --- API obtener mensajes contacto ---
app.get("/api/contacto", async (req, res) => {
  try {
    const client = await pool.connect();
    const result = await client.query("SELECT * FROM mensajes ORDER BY fecha DESC");
    client.release();

    res.json(result.rows);
  } catch (error) {
    console.error("Error al obtener mensajes:", error);
    res.status(500).json({ error: "Error al obtener los mensajes" });
  }
});

// --- API admin mensajes ---
app.get("/api/mensajes", async (req, res) => {
  try {
    const client = await pool.connect();
    const result = await client.query("SELECT * FROM mensajes ORDER BY fecha DESC");
    client.release();

    res.json(result.rows);
  } catch (error) {
    console.error("Error al obtener mensajes:", error.message);
    res.status(500).json({ error: "Error al obtener los mensajes" });
  }
});

app.put("/api/mensajes/:id", authenticateToken, async (req, res) => {
  const { id } = req.params;

  try {
    const client = await pool.connect();
    await client.query("UPDATE mensajes SET respondido = true WHERE id = $1", [id]);
    client.release();

    res.json({ message: "Mensaje marcado como respondido" });
  } catch (error) {
    console.error("Error al marcar como respondido:", error.message);
    res.status(500).json({ error: "Error al actualizar el mensaje" });
  }
});

app.delete("/api/mensajes/:id", authenticateToken, async (req, res) => {
  const { id } = req.params;

  try {
    const client = await pool.connect();
    await client.query("DELETE FROM mensajes WHERE id = $1", [id]);
    client.release();

    res.json({ message: "Mensaje eliminado correctamente" });
  } catch (error) {
    console.error("Error al eliminar mensaje:", error.message);
    res.status(500).json({ error: "Error al eliminar el mensaje" });
  }
});

// RUTA: server/index.js

// --- API obtener slides activos del Hero ---
app.get("/api/hero", async (req, res) => {
  try {
    const client = await pool.connect();
    const result = await client.query(
      "SELECT * FROM hero_slides WHERE active = true ORDER BY created_at DESC"
    );
    client.release();

    res.json(result.rows);
  } catch (error) {
    console.error("Error al obtener slides:", error.message);
    res.status(500).json({ error: "Error al obtener slides" });
  }
});

// --- API para crear un nuevo slide ---
app.post("/api/hero", authenticateToken, async (req, res) => {
  const {
    image_url,
    title,
    subtitle,
    title_effect,
    subtitle_effect,
    font_size_title,
    font_size_subtitle,
    color_title,
    color_subtitle,
    slide_duration
  } = req.body;

  try {
    const client = await pool.connect();
    await client.query(
      `INSERT INTO hero_slides (
        image_url, title, subtitle,
        title_effect, subtitle_effect,
        font_size_title, font_size_subtitle,
        color_title, color_subtitle, slide_duration
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
      [
        image_url,
        title,
        subtitle,
        title_effect || "fade-right",
        subtitle_effect || "fade-left",
        font_size_title || "text-3xl",
        font_size_subtitle || "text-xl",
        color_title || "#ffffff",
        color_subtitle || "#ffffff",
        slide_duration || 5000
      ]
    );
    client.release();
    res.status(201).json({ message: "Slide creado correctamente" });
  } catch (error) {
    console.error("Error al agregar slide:", error.message);
    res.status(500).json({ error: "Error al crear slide" });
  }
});


// --- API para actualizar un slide ---
app.put("/api/hero/:id", authenticateToken, async (req, res) => {
  const { id } = req.params;
  const {
    title,
    subtitle,
    title_effect,
    subtitle_effect,
    font_size_title,
    font_size_subtitle,
    color_title,
    color_subtitle,
    slide_duration
  } = req.body;

  try {
    const client = await pool.connect();
    await client.query(
      `UPDATE hero_slides
       SET title = $1,
           subtitle = $2,
           title_effect = $3,
           subtitle_effect = $4,
           font_size_title = $5,
           font_size_subtitle = $6,
           color_title = $7,
           color_subtitle = $8,
           slide_duration = $9
       WHERE id = $10`,
      [
        title,
        subtitle,
        title_effect || "fade-right",
        subtitle_effect || "fade-left",
        font_size_title || "text-3xl",
        font_size_subtitle || "text-xl",
        color_title || "#ffffff",
        color_subtitle || "#ffffff",
        slide_duration || 5000,
        id
      ]
    );
    client.release();
    res.json({ message: "Slide actualizado correctamente" });
  } catch (error) {
    console.error("Error al actualizar slide:", error.message);
    res.status(500).json({ error: "Error al actualizar slide" });
  }
});


// --- API para eliminar un slide ---
app.delete("/api/hero/:id", authenticateToken, async (req, res) => {
  const { id } = req.params;
  try {
    const client = await pool.connect();
    await client.query("DELETE FROM hero_slides WHERE id = $1", [id]);
    client.release();
    res.json({ message: "Slide eliminado correctamente" });
  } catch (error) {
    console.error("Error al eliminar slide:", error.message);
    res.status(500).json({ error: "Error al eliminar slide" });
  }
});

// --- API obtener IDs de eventos en el Hero ---
app.get("/api/hero/eventos-ids", authenticateToken, async (req, res) => {
  try {
    const client = await pool.connect();
    const result = await client.query(
      "SELECT evento_id FROM hero_slides WHERE evento_id IS NOT NULL"
    );
    client.release();
    res.json(result.rows.map(r => r.evento_id));
  } catch (err) {
    console.error("Error al obtener hero evento ids:", err.message);
    res.status(500).json({ error: "Error al obtener ids" });
  }
});

// --- API agregar evento al Hero (crea slide automáticamente) ---
app.post("/api/hero/from-evento/:id", authenticateToken, async (req, res) => {
  const { id } = req.params;
  const client = await pool.connect();
  try {
    const existing = await client.query(
      "SELECT id FROM hero_slides WHERE evento_id = $1", [id]
    );
    if (existing.rows.length > 0)
      return res.status(409).json({ error: "El evento ya está en el Hero" });

    const ev = await client.query("SELECT * FROM eventos WHERE id = $1", [id]);
    if (ev.rows.length === 0)
      return res.status(404).json({ error: "Evento no encontrado" });
    const evento = ev.rows[0];

    const fechaStr = evento.fecha_inicio
      ? new Date(evento.fecha_inicio).toLocaleDateString("es-CL", {
          weekday: "long", day: "numeric", month: "long"
        })
      : "";
    const subtitle = [fechaStr, evento.lugar].filter(Boolean).join(" · ");

    const result = await client.query(
      `INSERT INTO hero_slides
         (image_url, title, subtitle, title_effect, subtitle_effect,
          font_size_title, font_size_subtitle, color_title, color_subtitle,
          slide_duration, evento_id)
       VALUES ($1,$2,$3,'fade-right','fade-left','text-3xl','text-xl','#ffffff','#ffffff',5000,$4)
       RETURNING id`,
      [evento.imagen_url || "", evento.titulo, subtitle, id]
    );
    res.status(201).json({ id: result.rows[0].id });
  } catch (err) {
    console.error("Error al agregar evento al Hero:", err.message);
    res.status(500).json({ error: "Error al agregar al Hero" });
  } finally {
    client.release();
  }
});

// --- API quitar evento del Hero ---
app.delete("/api/hero/from-evento/:id", authenticateToken, async (req, res) => {
  const { id } = req.params;
  const client = await pool.connect();
  try {
    await client.query("DELETE FROM hero_slides WHERE evento_id = $1", [id]);
    res.json({ success: true });
  } catch (err) {
    console.error("Error al quitar evento del Hero:", err.message);
    res.status(500).json({ error: "Error al quitar del Hero" });
  } finally {
    client.release();
  }
});

// --- API para verificar transmisión en vivo de YouTube ---
let liveStreamCache = null;
let liveStreamCacheTimestamp = 0;
const LIVE_STREAM_CACHE_DURATION = 10 * 60 * 1000; // 10 minutos
let liveStreamQuotaBackoffUntil = 0;

// Modo especial: permite detección fuera de horario (eventos especiales)
let specialModeUntil = 0; // timestamp hasta cuando está activo el modo especial

/**
 * Determina si estamos dentro de la ventana horaria de transmisión regular.
 * Jueves 18:30–22:00 y Domingos 11:00–14:00, horario Chile (America/Santiago).
 */
function isInLiveWindow() {
  const now = new Date();
  // Obtener hora local de Santiago de Chile
  const santiago = new Intl.DateTimeFormat("es-CL", {
    timeZone: "America/Santiago",
    weekday: "long",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).formatToParts(now);

  const weekday = santiago.find((p) => p.type === "weekday")?.value?.toLowerCase();
  const hour = parseInt(santiago.find((p) => p.type === "hour")?.value ?? "0", 10);
  const minute = parseInt(santiago.find((p) => p.type === "minute")?.value ?? "0", 10);
  const totalMinutes = hour * 60 + minute;

  if (weekday === "jueves") {
    // 18:30 a 22:00
    return totalMinutes >= 18 * 60 + 30 && totalMinutes <= 22 * 60;
  }
  if (weekday === "domingo") {
    // 11:00 a 14:00
    return totalMinutes >= 11 * 60 && totalMinutes <= 14 * 60;
  }
  return false;
}

// GET estado de transmisión
app.get("/api/youtube/live-status", async (req, res) => {
  const now = Date.now();
  const specialActive = now < specialModeUntil;
  const inWindow = isInLiveWindow();

  // Fuera de ventana y sin modo especial → no consumir cuota
  if (!inWindow && !specialActive) {
    return res.json({ isLive: false, inWindow: false, specialMode: false });
  }

  // Si la cuota está agotada, devolver el último caché
  if (now < liveStreamQuotaBackoffUntil) {
    console.warn("[YouTube] Cuota agotada, usando caché hasta", new Date(liveStreamQuotaBackoffUntil).toISOString());
    return res.json(liveStreamCache || { isLive: false, message: "Cuota de YouTube agotada temporalmente" });
  }

  // Retornar caché si es válido
  if (liveStreamCache && now - liveStreamCacheTimestamp < LIVE_STREAM_CACHE_DURATION) {
    return res.json({ ...liveStreamCache, inWindow, specialMode: specialActive });
  }

  try {
    const YOUTUBE_API_KEY = process.env.YOUTUBE_API_KEY;
    const CHANNEL_ID = process.env.YOUTUBE_CHANNEL_ID;

    if (!YOUTUBE_API_KEY || !CHANNEL_ID) {
      return res.json({ isLive: false, message: "YouTube API no configurada" });
    }

    const response = await axios.get(
      "https://www.googleapis.com/youtube/v3/search",
      {
        params: {
          part: "snippet",
          channelId: CHANNEL_ID,
          eventType: "live",
          type: "video",
          key: YOUTUBE_API_KEY,
        },
      }
    );

    if (response.data.items && response.data.items.length > 0) {
      const liveVideo = response.data.items[0];
      liveStreamCache = {
        isLive: true,
        videoId: liveVideo.id.videoId,
        title: liveVideo.snippet.title,
        description: liveVideo.snippet.description,
        thumbnail: liveVideo.snippet.thumbnails.high.url,
      };
    } else {
      liveStreamCache = { isLive: false };
    }

    liveStreamCacheTimestamp = now;
    res.json({ ...liveStreamCache, inWindow, specialMode: specialActive });
  } catch (error) {
    const status = error.response?.status;
    const reason = error.response?.data?.error?.errors?.[0]?.reason;
    if (status === 403 && (reason === "quotaExceeded" || reason === "dailyLimitExceeded")) {
      liveStreamQuotaBackoffUntil = now + 2 * 60 * 60 * 1000;
      console.error(`[YouTube] CUOTA AGOTADA. Suspendiendo consultas hasta ${new Date(liveStreamQuotaBackoffUntil).toISOString()}`);
    } else {
      console.error("[YouTube] Error al verificar transmisión en vivo:", error.message, { status, reason });
    }
    res.json({ isLive: false, error: error.message });
  }
});

// POST activar modo especial (solo admins autenticados)
app.post("/api/youtube/special-mode", authenticateToken, (req, res) => {
  const hours = Math.min(parseInt(req.body?.hours ?? 4, 10), 12); // máx 12h
  specialModeUntil = Date.now() + hours * 60 * 60 * 1000;
  liveStreamCache = null; // forzar consulta inmediata
  liveStreamCacheTimestamp = 0;
  console.log(`[YouTube] Modo especial activado por ${req.user?.username} hasta ${new Date(specialModeUntil).toISOString()}`);
  res.json({ success: true, specialModeUntil, hours });
});

// DELETE desactivar modo especial (solo admins autenticados)
app.delete("/api/youtube/special-mode", authenticateToken, (req, res) => {
  specialModeUntil = 0;
  liveStreamCache = { isLive: false };
  console.log(`[YouTube] Modo especial desactivado por ${req.user?.username}`);
  res.json({ success: true });
});

// GET estado del modo especial (solo admins)
app.get("/api/youtube/special-mode", authenticateToken, (req, res) => {
  const now = Date.now();
  const active = now < specialModeUntil;
  res.json({ active, specialModeUntil: active ? specialModeUntil : null });
});

// --- API para obtener fotos públicas desde Flickr ---
let cachedFotos = null;
let cacheTimestamp = 0;

app.get("/api/flickr/fotos", async (req, res) => {
  const now = Date.now();

  // Si hay caché y no han pasado más de 10 minutos
  if (cachedFotos && now - cacheTimestamp < 10 * 60 * 1000) {
    return res.json(cachedFotos);
  }

  try {
    const response = await axios.get("https://www.flickr.com/services/rest/", {
      params: {
        method: "flickr.people.getPublicPhotos",
        api_key: process.env.FLICKR_API_KEY,
        user_id: "202745080@N05",
        format: "json",
        nojsoncallback: 1,
        per_page: 20,
        extras: "url_b",
      },
    });

    const fotos = response.data.photos.photo.map((photo) => ({
      id: photo.id,
      title: photo.title,
      url: photo.url_b || `https://live.staticflickr.com/${photo.server}/${photo.id}_${photo.secret}_b.jpg`,
    }));

    // Guardar en caché
    cachedFotos = fotos;
    cacheTimestamp = now;

    res.json(fotos);
  } catch (error) {
    console.error("Error al obtener fotos de Flickr:", error.message);
    res.status(500).json({ error: "No se pudo obtener fotos de Flickr" });
  }
});

app.get("/api/galeria", async (req, res) => {
  const client = await pool.connect();
  try {
    const { pagina, anio } = req.query;
    const pageNumber = parseInt(pagina, 10) || 1;

    const indexResult = await client.query(
      "SELECT data FROM galeria_index ORDER BY created_at DESC LIMIT 1"
    );

    if (indexResult.rows.length === 0) {
      return res.status(404).json({ error: "Índice no encontrado" });
    }

    const { paginas } = indexResult.rows[0].data;
    let targetPage;

    if (anio) {
      // Buscar la primera página que contenga el año solicitado
      targetPage = paginas.find((p) => p.anios.includes(anio));
    } else {
      // Buscar por número de página
      targetPage = paginas[pageNumber - 1];
    }

    if (!targetPage) {
      return res.status(404).json({ error: "Página no encontrada" });
    }

    const result = await cloudinary.search
      .expression("folder:galeria_iglesia")
      .with_field("context")
      .with_field("metadata")  // 👈 ESTO ES CLAVE
      .sort_by("public_id", "asc")
      .max_results(50)
      .next_cursor(targetPage.cursor || undefined)
      .execute();

    const fotos = result.resources.map((r) => {
      const fecha = r.context?.custom?.fecha_toma || r.context?.fecha_toma || "sin_fecha";

      return {
        url: r.secure_url,
        titulo: r.public_id.split("/").pop(),
        fecha_toma: fecha,
        context: r.context || {},
      };
    });



    console.log("✅ Fotos cargadas:", fotos.map(f => f.fecha_toma));

    res.json({ fotos });
  } catch (error) {
    console.error("❌ Error en GET /api/galeria:", error.message);
    res.status(500).json({ error: "Error al obtener galería" });
  } finally {
    client.release();
  }
});

app.get("/api/galeria/index", async (req, res) => {
  const client = await pool.connect();
  try {
    const result = await client.query(
      "SELECT data FROM galeria_index ORDER BY created_at DESC LIMIT 1"
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: "Índice no encontrado" });
    }

    res.json(result.rows[0].data);
  } catch (error) {
    console.error("❌ Error al obtener índice de galería:", error.message);
    res.status(500).json({ error: "Error al obtener índice" });
  } finally {
    client.release();
  }
});
console.log("✅ POST /api/galeria/index registrado");

app.post("/api/galeria/index", async (req, res) => {
  const client = await pool.connect();
  try {
    const paginas = [];
    const aniosSet = new Set();

    let next_cursor = undefined;
    let pagina = 0;
    const limite = 50;

    do {
      const result = await cloudinary.search
        .expression("folder:galeria_iglesia")
        .with_field("context")
        .sort_by("public_id", "asc")
        .max_results(limite)
        .next_cursor(next_cursor)
        .execute();

      const aniosPagina = new Set();
      const cursor = pagina === 0 ? null : next_cursor;

      for (const r of result.resources) {
        let anio = r.context?.custom?.fecha_toma?.substring(0, 4);

        if (!anio) {
          // Intentar extraer el año desde el nombre del archivo
          const nombre = r.public_id.split("/").pop(); // ej. 2011-05-20_IMG_0318
          const match = nombre.match(/^(\d{4})-/);
          if (match) {
            anio = match[1];
          }
        }

        if (anio) {
          aniosPagina.add(anio);
          aniosSet.add(anio);
        }
      }

      paginas.push({
        cursor,
        anios: [...aniosPagina],
      });

      next_cursor = result.next_cursor;
      pagina++;
    } while (next_cursor);

    const index = {
      totalPaginas: paginas.length,
      anios: [...aniosSet].sort((a, b) => b - a),
      paginas,
    };

    await client.query("INSERT INTO galeria_index (data) VALUES ($1)", [index]);

    res.json({ message: "Índice creado correctamente", index });
  } catch (error) {
    console.error("❌ Error al generar índice:", error.message);
    res.status(500).json({ error: "Error al generar índice de galería" });
  } finally {
    client.release();
  }
});

app.get("/api/test-cloudinary", async (req, res) => {
  try {
    const result = await cloudinary.search
      .expression("folder:galeria_iglesia")
      .sort_by("public_id", "asc")
      .max_results(1)
      .execute();

    res.json(result.resources);
  } catch (error) {
    console.error("❌ Error en test Cloudinary:", error);
    res.status(500).json({ error: error.message });
  }
});


// ========================
// 💰 FONDOS Y DONACIONES
// ========================

// GET público: fondos con % de cumplimiento (sin montos)
app.get("/api/fondos/progreso", async (req, res) => {
  try {
    // Auto-anular efectivo pendiente con más de 7 días
    await pool.query(
      `UPDATE donaciones SET estado = 'anulado'
       WHERE metodo_pago = 'efectivo' AND estado = 'pendiente'
         AND fecha < NOW() - INTERVAL '7 days'`
    ).catch(() => {});

    const result = await pool.query(`
      SELECT
        f.id,
        f.nombre,
        f.descripcion,
        CASE
          WHEN f.meta IS NULL THEN NULL
          ELSE ROUND(
            LEAST(
              COALESCE(SUM(CASE WHEN d.estado = 'confirmado' THEN d.amount_clp ELSE 0 END), 0) / f.meta * 100,
              100
            ), 1
          )
        END AS porcentaje,
        CASE
          WHEN f.meta IS NULL THEN NULL
          ELSE ROUND(
            LEAST(
              COALESCE(SUM(CASE WHEN d.estado IN ('confirmado','pendiente') THEN d.amount_clp ELSE 0 END), 0) / f.meta * 100,
              100
            ), 1
          )
        END AS porcentaje_contable
      FROM fondos f
      LEFT JOIN donaciones d ON d.fondo_id = f.id
      WHERE f.activo = TRUE
      GROUP BY f.id, f.nombre, f.descripcion, f.meta
      ORDER BY f.id
    `);
    res.json(result.rows);
  } catch (error) {
    console.error("Error al obtener progreso de fondos:", error);
    res.status(500).json({ error: "Error al obtener fondos" });
  }
});

// GET admin: fondos con montos reales (protegido)
app.get("/api/fondos", authenticateToken, async (req, res) => {
  try {
    // Auto-anular efectivo pendiente con más de 7 días
    await pool.query(
      `UPDATE donaciones SET estado = 'anulado'
       WHERE metodo_pago = 'efectivo' AND estado = 'pendiente'
         AND fecha < NOW() - INTERVAL '7 days'`
    ).catch(() => {});

    const result = await pool.query(`
      SELECT
        f.id,
        f.nombre,
        f.descripcion,
        f.meta,
        COALESCE(SUM(CASE WHEN d.estado = 'confirmado' THEN d.amount_clp ELSE 0 END), 0) AS total_disponible,
        COALESCE(SUM(CASE WHEN d.estado = 'pendiente' THEN d.amount_clp ELSE 0 END), 0) AS total_pendiente,
        COALESCE(SUM(CASE WHEN d.estado IN ('confirmado','pendiente') THEN d.amount_clp ELSE 0 END), 0) AS total_contable,
        COUNT(CASE WHEN d.estado != 'anulado' THEN 1 END) AS cantidad_donaciones,
        CASE
          WHEN f.meta IS NULL THEN NULL
          ELSE ROUND(
            LEAST(
              COALESCE(SUM(CASE WHEN d.estado = 'confirmado' THEN d.amount_clp ELSE 0 END), 0) / f.meta * 100,
              100
            ), 1
          )
        END AS porcentaje
      FROM fondos f
      LEFT JOIN donaciones d ON d.fondo_id = f.id
      WHERE f.activo = TRUE
      GROUP BY f.id, f.nombre, f.descripcion, f.meta
      ORDER BY f.id
    `);
    res.json(result.rows);
  } catch (error) {
    console.error("Error al obtener fondos:", error);
    res.status(500).json({ error: "Error al obtener fondos" });
  }
});

// PUT admin: actualizar meta de un fondo (protegido)
app.put("/api/fondos/:id/meta", authenticateToken, async (req, res) => {
  const { id } = req.params;
  const { meta } = req.body;

  if (!meta || isNaN(meta) || parseFloat(meta) <= 0) {
    return res.status(400).json({ error: "Meta inválida" });
  }

  try {
    const result = await pool.query(
      "UPDATE fondos SET meta = $1, updated_at = NOW() WHERE id = $2 RETURNING *",
      [parseFloat(meta), id]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ error: "Fondo no encontrado" });
    }
    res.json(result.rows[0]);
  } catch (error) {
    console.error("Error al actualizar meta:", error);
    res.status(500).json({ error: "Error al actualizar meta" });
  }
});

// GET admin: detalle de donaciones por fondo (protegido)
app.get("/api/fondos/:id/donaciones", authenticateToken, async (req, res) => {
  const { id } = req.params;
  try {
    const result = await pool.query(
      `SELECT id, order_id, payer_name, nombre_donante, email, amount_clp, amount_usd, fecha, metodo_pago, estado
       FROM donaciones WHERE fondo_id = $1 ORDER BY fecha DESC`,
      [id]
    );
    res.json(result.rows);
  } catch (error) {
    console.error("Error al obtener donaciones del fondo:", error);
    res.status(500).json({ error: "Error al obtener donaciones" });
  }
});

// --- Endpoint para procesar donaciones PayPal y enviar comprobante ---
app.post("/api/donaciones", async (req, res) => {
  const { orderId, email, payerName, amountCLP, amountUSD, fondoId } = req.body;

  if (!orderId || !amountCLP || !amountUSD) {
    return res.status(400).json({ 
      error: "orderId, amountCLP y amountUSD son requeridos" 
    });
  }

  try {
    const donation = await saveDonation(pool, {
      orderId,
      email: email || null,
      payerName: payerName || null,
      amountCLP: parseFloat(amountCLP),
      amountUSD: parseFloat(amountUSD),
      fondoId: fondoId || 1
    });

    // Obtener nombre del fondo para el comprobante
    let fondoNombre = "Ofrendas";
    try {
      const fondoResult = await pool.query("SELECT nombre FROM fondos WHERE id = $1", [fondoId || 1]);
      if (fondoResult.rows.length > 0) fondoNombre = fondoResult.rows[0].nombre;
    } catch (_) {}

    let emailSent = false;
    if (email) {
      try {
        await sendDonationReceipt({
          orderId,
          email,
          payerName: payerName || 'Anónimo',
          amountCLP: parseFloat(amountCLP),
          amountUSD: parseFloat(amountUSD),
          fondoNombre
        });
        emailSent = true;
      } catch (emailError) {
        console.error("Error al enviar email:", emailError);
      }
    }

    res.status(201).json({ 
      success: true,
      donation,
      emailSent 
    });
  } catch (error) {
    console.error("Error al procesar donación:", error);
    res.status(500).json({ error: "Error al procesar donación" });
  }
});

// --- Endpoint para donaciones en EFECTIVO ---
app.post("/api/donaciones/efectivo", async (req, res) => {
  const { nombreDonante, email, amountCLP, fondoId } = req.body;

  if (!nombreDonante || !amountCLP) {
    return res.status(400).json({ error: "Nombre y monto son requeridos" });
  }

  const monto = parseFloat(amountCLP);
  if (isNaN(monto) || monto < 1000) {
    return res.status(400).json({ error: "Monto mínimo: $1.000 CLP" });
  }

  const orderId = `EFE-${Date.now()}`;

  try {
    const insertResult = await pool.query(
      `INSERT INTO donaciones
         (order_id, email, payer_name, nombre_donante, amount_clp, amount_usd, fondo_id, fecha, metodo_pago, estado)
       VALUES ($1, $2, $3, $4, $5, 0, $6, NOW(), 'efectivo', 'pendiente')
       RETURNING *`,
      [orderId, email || null, nombreDonante, nombreDonante, monto, fondoId || 1]
    );
    const donation = insertResult.rows[0];

    // Obtener nombre del fondo
    let fondoNombre = "Ofrendas";
    try {
      const fr = await pool.query("SELECT nombre FROM fondos WHERE id = $1", [fondoId || 1]);
      if (fr.rows.length > 0) fondoNombre = fr.rows[0].nombre;
    } catch (_) {}

    // Enviar comprobante PDF por correo
    try {
      await sendCashDonationReceipt({
        orderId,
        payerName: nombreDonante,
        amountCLP: monto,
        fondoNombre,
        fecha: new Date(),
        email: email || null,
      });
    } catch (emailError) {
      console.error("Error al enviar comprobante efectivo:", emailError);
    }

    res.status(201).json({ success: true, donation, orderId });
  } catch (error) {
    console.error("Error al registrar donación efectivo:", error);
    res.status(500).json({ error: "Error al registrar la donación" });
  }
});

// --- Confirmar donación en efectivo (admin) ---
app.put("/api/donaciones/:id/confirmar", authenticateToken, async (req, res) => {
  const { id } = req.params;
  try {
    const result = await pool.query(
      `UPDATE donaciones SET estado = 'confirmado' WHERE id = $1 AND metodo_pago = 'efectivo' RETURNING *`,
      [id]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ error: "Donación no encontrada o no es de tipo efectivo" });
    }
    res.json({ success: true, donation: result.rows[0] });
  } catch (error) {
    console.error("Error al confirmar donación:", error);
    res.status(500).json({ error: "Error al confirmar donación" });
  }
});

// --- Anular donación en efectivo (admin) ---
app.put("/api/donaciones/:id/anular", authenticateToken, async (req, res) => {
  const { id } = req.params;
  try {
    const result = await pool.query(
      `UPDATE donaciones SET estado = 'anulado' WHERE id = $1 AND metodo_pago = 'efectivo' RETURNING *`,
      [id]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ error: "Donación no encontrada o no es de tipo efectivo" });
    }
    res.json({ success: true, donation: result.rows[0] });
  } catch (error) {
    console.error("Error al anular donación:", error);
    res.status(500).json({ error: "Error al anular donación" });
  }
});


// =============================================
// PCO - MIEMBROS
// =============================================

// GET /api/miembros — listar todos con roles
app.get("/api/miembros", authenticateToken, async (req, res) => {
  try {
    const client = await pool.connect();
    const result = await client.query(`
      SELECT m.*, 
        COALESCE(
          json_agg(mr.rol) FILTER (WHERE mr.rol IS NOT NULL),
          '[]'
        ) AS roles
      FROM miembros m
      LEFT JOIN miembro_roles mr ON mr.miembro_id = m.id
      GROUP BY m.id
      ORDER BY m.apellido, m.nombre
    `);
    client.release();
    res.json(result.rows);
  } catch (error) {
    console.error("Error al obtener miembros:", error);
    res.status(500).json({ error: "Error al obtener miembros" });
  }
});

// GET /api/miembros/directorio — lista pública para miembros del portal
app.get("/api/miembros/directorio", authenticateMiembro, async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT m.id, m.nombre, m.apellido, m.foto_url, m.estado,
              COALESCE(json_agg(mr.rol) FILTER (WHERE mr.rol IS NOT NULL), '[]') AS roles
       FROM miembros m
       LEFT JOIN miembro_roles mr ON mr.miembro_id = m.id
       WHERE m.estado != 'inactivo'
       GROUP BY m.id
       ORDER BY m.apellido, m.nombre`
    );
    res.json(result.rows);
  } catch (err) {
    console.error("Error GET /api/miembros/directorio:", err.message);
    res.status(500).json({ error: "Error al obtener directorio" });
  }
});

// GET /api/miembros/:id/publico — perfil público para miembros del portal
app.get("/api/miembros/:id/publico", authenticateMiembro, async (req, res) => {
  try {

    const result = await pool.query(
      `SELECT m.id, m.nombre, m.apellido, m.foto_url, m.email, m.celular,
              m.fecha_nacimiento, m.direccion, m.estado, m.acerca_de_mi,
              COALESCE(json_agg(mr.rol) FILTER (WHERE mr.rol IS NOT NULL), '[]') AS roles
       FROM miembros m
       LEFT JOIN miembro_roles mr ON mr.miembro_id = m.id
       WHERE m.id = $1
       GROUP BY m.id`,
      [req.params.id]
    );
    if (result.rows.length === 0) return res.status(404).json({ error: "Miembro no encontrado" });
    res.json(result.rows[0]);
  } catch (err) {
    console.error("Error GET /api/miembros/:id/publico:", err.message);
    res.status(500).json({ error: "Error al obtener perfil" });
  }
});

// GET /api/miembros/:id — detalle de un miembro
app.get("/api/miembros/:id", authenticateToken, async (req, res) => {
  try {
    const client = await pool.connect();
    const result = await client.query(`
      SELECT m.*,
        COALESCE(
          json_agg(mr.rol) FILTER (WHERE mr.rol IS NOT NULL),
          '[]'
        ) AS roles
      FROM miembros m
      LEFT JOIN miembro_roles mr ON mr.miembro_id = m.id
      WHERE m.id = $1
      GROUP BY m.id
    `, [req.params.id]);
    client.release();
    if (result.rows.length === 0) return res.status(404).json({ error: "Miembro no encontrado" });
    res.json(result.rows[0]);
  } catch (error) {
    console.error("Error al obtener miembro:", error);
    res.status(500).json({ error: "Error al obtener miembro" });
  }
});

// POST /api/miembros — crear miembro
app.post("/api/miembros", authenticateToken, async (req, res) => {
  const { nombre, apellido, foto_url, fecha_nacimiento, celular, email, direccion, estado, notas, roles, bautizado, declaracion_fe, estado_civil, separado, nivel_discipulado } = req.body;
  if (!nombre || !apellido) return res.status(400).json({ error: "Nombre y apellido son obligatorios" });
  try {
    const client = await pool.connect();
    const result = await client.query(
      `INSERT INTO miembros (nombre, apellido, foto_url, fecha_nacimiento, celular, email, direccion, estado, notas, bautizado, declaracion_fe, estado_civil, separado, nivel_discipulado)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14) RETURNING *`,
      [nombre, apellido, foto_url || null, fecha_nacimiento || null, celular || null, email || null, direccion || null, estado || "activo", notas || null, bautizado || false, declaracion_fe || false, estado_civil || null, separado || false, nivel_discipulado || null]
    );
    const miembro = result.rows[0];
    if (Array.isArray(roles) && roles.length > 0) {
      for (const rol of roles) {
        await client.query(
          `INSERT INTO miembro_roles (miembro_id, rol) VALUES ($1, $2) ON CONFLICT DO NOTHING`,
          [miembro.id, rol]
        );
      }
    }
    client.release();
    res.status(201).json({ ...miembro, roles: roles || [] });
  } catch (error) {
    console.error("Error al crear miembro:", error);
    res.status(500).json({ error: "Error al crear miembro" });
  }
});

// PUT /api/miembros/:id — actualizar miembro
app.put("/api/miembros/:id", authenticateToken, async (req, res) => {
  const { nombre, apellido, foto_url, fecha_nacimiento, celular, email, direccion, estado, notas, roles, acerca_de_mi, bautizado, declaracion_fe, estado_civil, separado, nivel_discipulado } = req.body;
  try {
    const client = await pool.connect();
    const result = await client.query(
      `UPDATE miembros SET nombre=$1, apellido=$2, foto_url=$3, fecha_nacimiento=$4, celular=$5, 
       email=$6, direccion=$7, estado=$8, notas=$9, acerca_de_mi=$10, bautizado=$11, declaracion_fe=$12, estado_civil=$13, separado=$14, nivel_discipulado=$15 WHERE id=$16 RETURNING *`,
      [nombre, apellido, foto_url || null, fecha_nacimiento || null, celular || null, email || null, direccion || null, estado || "activo", notas || null, acerca_de_mi || null, bautizado || false, declaracion_fe || false, estado_civil || null, separado || false, nivel_discipulado || null, req.params.id]
    );
    if (result.rows.length === 0) { client.release(); return res.status(404).json({ error: "Miembro no encontrado" }); }
    if (Array.isArray(roles)) {
      await client.query("DELETE FROM miembro_roles WHERE miembro_id = $1", [req.params.id]);
      for (const rol of roles) {
        await client.query(
          `INSERT INTO miembro_roles (miembro_id, rol) VALUES ($1, $2) ON CONFLICT DO NOTHING`,
          [req.params.id, rol]
        );
      }
    }
    client.release();
    res.json({ ...result.rows[0], roles: roles || [] });
  } catch (error) {
    console.error("Error al actualizar miembro:", error);
    res.status(500).json({ error: "Error al actualizar miembro" });
  }
});

// DELETE /api/miembros/:id
app.delete("/api/miembros/:id", authenticateToken, async (req, res) => {
  try {
    const client = await pool.connect();
    await client.query("DELETE FROM miembros WHERE id = $1", [req.params.id]);
    client.release();
    res.json({ success: true });
  } catch (error) {
    console.error("Error al eliminar miembro:", error);
    res.status(500).json({ error: "Error al eliminar miembro" });
  }
});

// POST /api/miembros/:id/foto-perfil — guardar foto en client/public/fotos_perfil (máx 1MB)
app.post("/api/miembros/:id/foto-perfil", authenticateToken, async (req, res) => {
  const { imagen_base64 } = req.body;
  if (!imagen_base64) return res.status(400).json({ error: "Imagen requerida" });

  // Validar tamaño: base64 ~1.37× el original. 1MB = 1048576 bytes → base64 ≈ 1437773 chars
  const base64Data = imagen_base64.replace(/^data:image\/\w+;base64,/, "");
  if (base64Data.length > 1437773) {
    return res.status(413).json({ error: "La imagen supera el límite de 1 MB" });
  }

  // Validar mime type
  const mimeMatch = imagen_base64.match(/^data:(image\/(?:jpeg|png|webp|gif));base64,/);
  if (!mimeMatch) return res.status(400).json({ error: "Formato de imagen no permitido (usa JPG, PNG o WebP)" });
  const ext = mimeMatch[1].split("/")[1].replace("jpeg", "jpg");

  try {
    const __dirname = path.dirname(fileURLToPath(import.meta.url));
    const fotosDir = path.join(__dirname, "../client/public/fotos_perfil");
    if (!fs.existsSync(fotosDir)) fs.mkdirSync(fotosDir, { recursive: true });

    const dbClient = await pool.connect();

    // Obtener nombre y apellido del miembro
    const miembroRes = await dbClient.query("SELECT nombre, apellido, foto_url FROM miembros WHERE id=$1", [req.params.id]);
    if (miembroRes.rows.length === 0) { dbClient.release(); return res.status(404).json({ error: "Miembro no encontrado" }); }

    const { nombre, apellido, foto_url: fotoAnterior } = miembroRes.rows[0];

    // Normaliza un string: quita tildes, caracteres especiales y pone en minúsculas
    const normalizar = (str) =>
      (str || "")
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .replace(/[^a-zA-Z0-9]/g, "")
        .toLowerCase();

    const parteNombre   = nombre.trim().split(/\s+/);
    const parteApellido = apellido.trim().split(/\s+/);

    const inicialNombre    = normalizar(parteNombre[0])[0] || "x";
    const primerApellido   = normalizar(parteApellido[0]) || "miembro";
    const inicialSegundo   = parteApellido[1] ? (normalizar(parteApellido[1])[0] || "") : "";

    // Nombre base: inicialNombre + primerApellido  →  dguzman
    const baseNombre = `${inicialNombre}${primerApellido}`;

    // Comprobar si ese nombre BASE ya está en uso por OTRO miembro (sin contar al actual)
    const conflicto = await dbClient.query(
      `SELECT id FROM miembros
       WHERE id <> $1
         AND foto_url LIKE $2`,
      [req.params.id, `/fotos_perfil/${baseNombre}.%`]
    );

    // Si hay conflicto, agregar inicial del 2do apellido: dguzmans
    const baseFinal  = conflicto.rows.length > 0 && inicialSegundo
      ? `${baseNombre}${inicialSegundo}`
      : baseNombre;
    const fileName   = `${baseFinal}.${ext}`;

    // Si el propio usuario ya tenía un archivo con el nombre de colisión, también resolverlo
    // Verificar si la foto anterior de ESTE usuario usaba el nombre base sin inicial 2do
    // y ahora hay conflicto → renombrar la del otro miembro no es responsabilidad nuestra,
    // pero sí actualizar la propia.

    // Eliminar foto anterior del mismo usuario (en BD)
    if (fotoAnterior && fotoAnterior.startsWith("/fotos_perfil/")) {
      const archivoAnterior = path.join(fotosDir, path.basename(fotoAnterior));
      if (fs.existsSync(archivoAnterior)) fs.unlinkSync(archivoAnterior);
    }
    // Eliminar si ya existe el archivo destino (ej. misma persona resubiendo)
    const filePathFinal = path.join(fotosDir, fileName);
    if (fs.existsSync(filePathFinal)) fs.unlinkSync(filePathFinal);

    // Guardar nueva foto
    fs.writeFileSync(filePathFinal, Buffer.from(base64Data, "base64"));

    const foto_url = `/fotos_perfil/${fileName}`;
    await dbClient.query("UPDATE miembros SET foto_url=$1 WHERE id=$2", [foto_url, req.params.id]);
    dbClient.release();

    res.json({ foto_url });
  } catch (error) {
    console.error("Error al guardar foto de perfil:", error);
    res.status(500).json({ error: "Error al guardar foto" });
  }
});

// POST /api/miembros/:id/foto — subir foto a Cloudinary
app.post("/api/miembros/:id/foto", authenticateToken, async (req, res) => {
  const { imagen_base64 } = req.body;
  if (!imagen_base64) return res.status(400).json({ error: "Imagen requerida" });
  try {
    const uploadResult = await cloudinary.uploader.upload(imagen_base64, {
      folder: "iglesia/miembros",
      transformation: [{ width: 400, height: 400, crop: "fill", gravity: "face" }],
    });
    const client = await pool.connect();
    await client.query("UPDATE miembros SET foto_url=$1 WHERE id=$2", [uploadResult.secure_url, req.params.id]);
    client.release();
    res.json({ foto_url: uploadResult.secure_url });
  } catch (error) {
    console.error("Error al subir foto:", error);
    res.status(500).json({ error: "Error al subir foto" });
  }
});

// =============================================
// FAMILIAS
// =============================================

// GET /api/familias — listar todas las familias con sus miembros
app.get("/api/familias", authenticateToken, async (req, res) => {
  try {
    const client = await pool.connect();
    const result = await client.query(`
      SELECT f.id, f.nombre, f.created_at,
        COALESCE(
          json_agg(
            json_build_object(
              'miembro_id', m.id,
              'nombre', m.nombre,
              'apellido', m.apellido,
              'foto_url', m.foto_url,
              'parentesco', fm.parentesco
            )
          ) FILTER (WHERE m.id IS NOT NULL),
          '[]'
        ) AS miembros
      FROM familias f
      LEFT JOIN familia_miembros fm ON fm.familia_id = f.id
      LEFT JOIN miembros m ON m.id = fm.miembro_id
      GROUP BY f.id
      ORDER BY f.nombre, f.id
    `);
    client.release();
    res.json(result.rows);
  } catch (error) {
    console.error("Error al obtener familias:", error);
    res.status(500).json({ error: "Error al obtener familias" });
  }
});

// GET /api/miembros/:id/familia — familia de un miembro
app.get("/api/miembros/:id/familia", authenticateToken, async (req, res) => {
  try {
    const client = await pool.connect();
    const result = await client.query(`
      SELECT f.id, f.nombre,
        COALESCE(
          json_agg(
            json_build_object(
              'miembro_id', m.id,
              'nombre', m.nombre,
              'apellido', m.apellido,
              'foto_url', m.foto_url,
              'parentesco', fm.parentesco
            )
          ) FILTER (WHERE m.id IS NOT NULL),
          '[]'
        ) AS miembros
      FROM familia_miembros me2
      JOIN familias f ON f.id = me2.familia_id
      LEFT JOIN familia_miembros fm ON fm.familia_id = f.id
      LEFT JOIN miembros m ON m.id = fm.miembro_id
      WHERE me2.miembro_id = $1
      GROUP BY f.id
    `, [req.params.id]);
    client.release();
    res.json(result.rows);
  } catch (error) {
    console.error("Error al obtener familia del miembro:", error);
    res.status(500).json({ error: "Error al obtener familia" });
  }
});

// POST /api/familias — crear familia
app.post("/api/familias", authenticateToken, async (req, res) => {
  const { nombre, miembros } = req.body;
  try {
    const client = await pool.connect();
    const result = await client.query(
      "INSERT INTO familias (nombre) VALUES ($1) RETURNING *",
      [nombre || null]
    );
    const familia = result.rows[0];
    if (Array.isArray(miembros) && miembros.length > 0) {
      for (const { miembro_id, parentesco } of miembros) {
        await client.query(
          "INSERT INTO familia_miembros (familia_id, miembro_id, parentesco) VALUES ($1,$2,$3) ON CONFLICT DO NOTHING",
          [familia.id, miembro_id, parentesco || "otro"]
        );
      }
    }
    client.release();
    res.status(201).json(familia);
  } catch (error) {
    console.error("Error al crear familia:", error);
    res.status(500).json({ error: "Error al crear familia" });
  }
});

// PUT /api/familias/:id — actualizar nombre de familia
app.put("/api/familias/:id", authenticateToken, async (req, res) => {
  const { nombre } = req.body;
  try {
    const client = await pool.connect();
    const result = await client.query(
      "UPDATE familias SET nombre=$1 WHERE id=$2 RETURNING *",
      [nombre || null, req.params.id]
    );
    client.release();
    if (result.rows.length === 0) return res.status(404).json({ error: "Familia no encontrada" });
    res.json(result.rows[0]);
  } catch (error) {
    console.error("Error al actualizar familia:", error);
    res.status(500).json({ error: "Error al actualizar familia" });
  }
});

// DELETE /api/familias/:id — eliminar familia (no elimina miembros)
app.delete("/api/familias/:id", authenticateToken, async (req, res) => {
  try {
    const client = await pool.connect();
    await client.query("DELETE FROM familias WHERE id=$1", [req.params.id]);
    client.release();
    res.json({ success: true });
  } catch (error) {
    console.error("Error al eliminar familia:", error);
    res.status(500).json({ error: "Error al eliminar familia" });
  }
});

// POST /api/familias/:id/miembros — agregar miembro a familia
app.post("/api/familias/:id/miembros", authenticateToken, async (req, res) => {
  const { miembro_id, parentesco } = req.body;
  if (!miembro_id) return res.status(400).json({ error: "miembro_id requerido" });
  try {
    const client = await pool.connect();
    await client.query(
      "INSERT INTO familia_miembros (familia_id, miembro_id, parentesco) VALUES ($1,$2,$3) ON CONFLICT (familia_id, miembro_id) DO UPDATE SET parentesco=$3",
      [req.params.id, miembro_id, parentesco || "otro"]
    );
    client.release();
    res.json({ success: true });
  } catch (error) {
    console.error("Error al agregar miembro a familia:", error);
    res.status(500).json({ error: "Error al agregar miembro" });
  }
});

// DELETE /api/familias/:id/miembros/:miembro_id — quitar miembro de familia
app.delete("/api/familias/:id/miembros/:miembro_id", authenticateToken, async (req, res) => {
  try {
    const client = await pool.connect();
    await client.query(
      "DELETE FROM familia_miembros WHERE familia_id=$1 AND miembro_id=$2",
      [req.params.id, req.params.miembro_id]
    );
    client.release();
    res.json({ success: true });
  } catch (error) {
    console.error("Error al quitar miembro de familia:", error);
    res.status(500).json({ error: "Error al quitar miembro" });
  }
});

// =============================================
// PCO - EVENTOS
// =============================================

// =============================================
// PCO - EVENTOS
// =============================================

// GET /api/eventos/publicos — sin auth, para la página pública (zoom_link excluido)
app.get("/api/eventos/publicos", async (req, res) => {
  try {
    const client = await pool.connect();
    const result = await client.query(`
      SELECT e.id, e.titulo, e.descripcion, e.imagen_url, e.fecha_inicio, e.fecha_fin,
             e.lugar, e.tipo, e.recurrencia, e.dia_semana, e.encargado_id,
             e.coordinador_id, e.predicador_id, e.color, e.notas,
        enc.nombre AS encargado_nombre, enc.apellido AS encargado_apellido, enc.foto_url AS encargado_foto,
        c.nombre AS coordinador_nombre, c.apellido AS coordinador_apellido, c.foto_url AS coordinador_foto,
        p.nombre AS predicador_nombre,  p.apellido AS predicador_apellido,  p.foto_url AS predicador_foto,
        COALESCE(
          json_agg(
            json_build_object(
              'fecha',               oc.fecha,
              'encargado_id',        oc.encargado_id,
              'encargado_nombre',    encoc.nombre,
              'encargado_apellido',  encoc.apellido,
              'encargado_foto',      encoc.foto_url,
              'coordinador_id',      oc.coordinador_id,
              'coordinador_nombre',  cm.nombre,
              'coordinador_apellido',cm.apellido,
              'coordinador_foto',    cm.foto_url,
              'predicador_id',       oc.predicador_id,
              'predicador_nombre',   pm.nombre,
              'predicador_apellido', pm.apellido,
              'predicador_foto',     pm.foto_url,
              'notas',               oc.notas
            ) ORDER BY oc.fecha
          ) FILTER (WHERE oc.id IS NOT NULL),
          '[]'::json
        ) AS ocurrencias
      FROM eventos e
      LEFT JOIN miembros enc ON enc.id = e.encargado_id
      LEFT JOIN miembros c   ON c.id   = e.coordinador_id
      LEFT JOIN miembros p   ON p.id   = e.predicador_id
      LEFT JOIN evento_ocurrencias oc    ON oc.evento_id  = e.id
      LEFT JOIN miembros encoc ON encoc.id = oc.encargado_id
      LEFT JOIN miembros cm    ON cm.id    = oc.coordinador_id
      LEFT JOIN miembros pm    ON pm.id    = oc.predicador_id
      GROUP BY e.id, enc.nombre, enc.apellido, enc.foto_url,
                       c.nombre, c.apellido, c.foto_url,
                       p.nombre, p.apellido, p.foto_url
      ORDER BY e.fecha_inicio ASC
    `);
    client.release();
    res.json(result.rows);
  } catch (error) {
    console.error("Error al obtener eventos públicos:", error);
    res.status(500).json({ error: "Error al obtener eventos" });
  }
});

// GET /api/eventos/autenticados — igual al público pero incluye zoom_link (requiere sesión de miembro o admin)
app.get("/api/eventos/autenticados", async (req, res) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader) return res.status(401).json({ error: "No autorizado" });
    const token = authHeader.split(" ")[1];
    let payload;
    try { payload = jwt.verify(token, process.env.JWT_SECRET); } catch { return res.status(401).json({ error: "Token inválido" }); }
    if (!payload) return res.status(401).json({ error: "Token inválido" });

    const client = await pool.connect();
    const result = await client.query(`
      SELECT e.*,
        enc.nombre AS encargado_nombre, enc.apellido AS encargado_apellido, enc.foto_url AS encargado_foto,
        c.nombre AS coordinador_nombre, c.apellido AS coordinador_apellido, c.foto_url AS coordinador_foto,
        p.nombre AS predicador_nombre,  p.apellido AS predicador_apellido,  p.foto_url AS predicador_foto,
        COALESCE(
          json_agg(
            json_build_object(
              'fecha',               oc.fecha,
              'encargado_id',        oc.encargado_id,
              'encargado_nombre',    encoc.nombre,
              'encargado_apellido',  encoc.apellido,
              'encargado_foto',      encoc.foto_url,
              'coordinador_id',      oc.coordinador_id,
              'coordinador_nombre',  cm.nombre,
              'coordinador_apellido',cm.apellido,
              'coordinador_foto',    cm.foto_url,
              'predicador_id',       oc.predicador_id,
              'predicador_nombre',   pm.nombre,
              'predicador_apellido', pm.apellido,
              'predicador_foto',     pm.foto_url,
              'notas',               oc.notas
            ) ORDER BY oc.fecha
          ) FILTER (WHERE oc.id IS NOT NULL),
          '[]'::json
        ) AS ocurrencias
      FROM eventos e
      LEFT JOIN miembros enc ON enc.id = e.encargado_id
      LEFT JOIN miembros c   ON c.id   = e.coordinador_id
      LEFT JOIN miembros p   ON p.id   = e.predicador_id
      LEFT JOIN evento_ocurrencias oc    ON oc.evento_id  = e.id
      LEFT JOIN miembros encoc ON encoc.id = oc.encargado_id
      LEFT JOIN miembros cm    ON cm.id    = oc.coordinador_id
      LEFT JOIN miembros pm    ON pm.id    = oc.predicador_id
      GROUP BY e.id, enc.nombre, enc.apellido, enc.foto_url,
                       c.nombre, c.apellido, c.foto_url,
                       p.nombre, p.apellido, p.foto_url
      ORDER BY e.fecha_inicio ASC
    `);
    client.release();
    res.json(result.rows);
  } catch (error) {
    console.error("Error al obtener eventos autenticados:", error);
    res.status(500).json({ error: "Error al obtener eventos" });
  }
});

// GET /api/eventos — listar todos, con encargado, coordinador, predicador y ocurrencias por fecha
app.get("/api/eventos", authenticateToken, async (req, res) => {
  try {
    const client = await pool.connect();
    const result = await client.query(`
      SELECT e.*,
        enc.nombre AS encargado_nombre, enc.apellido AS encargado_apellido, enc.foto_url AS encargado_foto,
        c.nombre AS coordinador_nombre, c.apellido AS coordinador_apellido, c.foto_url AS coordinador_foto,
        p.nombre AS predicador_nombre,  p.apellido AS predicador_apellido,  p.foto_url AS predicador_foto,
        COALESCE(
          json_agg(
            json_build_object(
              'fecha',               oc.fecha,
              'encargado_id',        oc.encargado_id,
              'encargado_nombre',    encoc.nombre,
              'encargado_apellido',  encoc.apellido,
              'encargado_foto',      encoc.foto_url,
              'coordinador_id',      oc.coordinador_id,
              'coordinador_nombre',  cm.nombre,
              'coordinador_apellido',cm.apellido,
              'coordinador_foto',    cm.foto_url,
              'predicador_id',       oc.predicador_id,
              'predicador_nombre',   pm.nombre,
              'predicador_apellido', pm.apellido,
              'predicador_foto',     pm.foto_url,
              'notas',               oc.notas
            ) ORDER BY oc.fecha
          ) FILTER (WHERE oc.id IS NOT NULL),
          '[]'::json
        ) AS ocurrencias
      FROM eventos e
      LEFT JOIN miembros enc ON enc.id = e.encargado_id
      LEFT JOIN miembros c   ON c.id   = e.coordinador_id
      LEFT JOIN miembros p   ON p.id   = e.predicador_id
      LEFT JOIN evento_ocurrencias oc    ON oc.evento_id  = e.id
      LEFT JOIN miembros encoc ON encoc.id = oc.encargado_id
      LEFT JOIN miembros cm    ON cm.id    = oc.coordinador_id
      LEFT JOIN miembros pm    ON pm.id    = oc.predicador_id
      GROUP BY e.id, enc.nombre, enc.apellido, enc.foto_url,
                       c.nombre, c.apellido, c.foto_url,
                       p.nombre, p.apellido, p.foto_url
      ORDER BY e.fecha_inicio ASC
    `);
    client.release();
    res.json(result.rows);
  } catch (error) {
    console.error("Error al obtener eventos:", error);
    res.status(500).json({ error: "Error al obtener eventos" });
  }
});

// GET /api/eventos/:id
app.get("/api/eventos/:id", authenticateToken, async (req, res) => {
  try {
    const client = await pool.connect();
    const result = await client.query(`
      SELECT e.*,
        c.nombre AS coordinador_nombre, c.apellido AS coordinador_apellido,
        p.nombre AS predicador_nombre,  p.apellido AS predicador_apellido
      FROM eventos e
      LEFT JOIN miembros c ON c.id = e.coordinador_id
      LEFT JOIN miembros p ON p.id = e.predicador_id
      WHERE e.id = $1
    `, [req.params.id]);
    client.release();
    if (result.rows.length === 0) return res.status(404).json({ error: "Evento no encontrado" });
    res.json(result.rows[0]);
  } catch (error) {
    console.error("Error al obtener evento:", error);
    res.status(500).json({ error: "Error al obtener evento" });
  }
});

// POST /api/eventos
app.post("/api/eventos", authenticateToken, async (req, res) => {
  const { titulo, descripcion, imagen_url, fecha_inicio, fecha_fin, lugar, tipo, recurrencia, dia_semana, encargado_id, coordinador_id, predicador_id, color, notas, zoom_link } = req.body;
  if (!titulo || !fecha_inicio) return res.status(400).json({ error: "Título y fecha de inicio son obligatorios" });
  try {
    const client = await pool.connect();
    const result = await client.query(
      `INSERT INTO eventos (titulo, descripcion, imagen_url, fecha_inicio, fecha_fin, lugar, tipo, recurrencia, dia_semana, encargado_id, coordinador_id, predicador_id, color, notas, zoom_link)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15) RETURNING *`,
      [titulo, descripcion || null, imagen_url || null, fecha_inicio, fecha_fin || null, lugar || null,
       tipo || "especial", recurrencia || "ninguna", dia_semana ?? null,
       encargado_id || null, coordinador_id || null, predicador_id || null, color || "#3B82F6", notas || null, zoom_link || null]
    );
    client.release();
    res.status(201).json(result.rows[0]);
  } catch (error) {
    console.error("Error al crear evento:", error);
    res.status(500).json({ error: "Error al crear evento" });
  }
});

// PUT /api/eventos/:id
app.put("/api/eventos/:id", authenticateToken, async (req, res) => {
  const { titulo, descripcion, imagen_url, fecha_inicio, fecha_fin, lugar, tipo, recurrencia, dia_semana, encargado_id, coordinador_id, predicador_id, color, notas, zoom_link } = req.body;
  try {
    const client = await pool.connect();
    const result = await client.query(
      `UPDATE eventos SET titulo=$1, descripcion=$2, imagen_url=$3, fecha_inicio=$4, fecha_fin=$5,
       lugar=$6, tipo=$7, recurrencia=$8, dia_semana=$9, encargado_id=$10, coordinador_id=$11, predicador_id=$12, color=$13, notas=$14, zoom_link=$15
       WHERE id=$16 RETURNING *`,
      [titulo, descripcion || null, imagen_url || null, fecha_inicio, fecha_fin || null, lugar || null,
       tipo || "especial", recurrencia || "ninguna", dia_semana ?? null,
       encargado_id || null, coordinador_id || null, predicador_id || null, color || "#3B82F6", notas || null, zoom_link || null, req.params.id]
    );
    client.release();
    if (result.rows.length === 0) return res.status(404).json({ error: "Evento no encontrado" });
    res.json(result.rows[0]);
  } catch (error) {
    console.error("Error al actualizar evento:", error);
    res.status(500).json({ error: "Error al actualizar evento" });
  }
});

// DELETE /api/eventos/:id
app.delete("/api/eventos/:id", authenticateToken, async (req, res) => {
  try {
    const client = await pool.connect();
    await client.query("DELETE FROM eventos WHERE id = $1", [req.params.id]);
    client.release();
    res.json({ success: true });
  } catch (error) {
    console.error("Error al eliminar evento:", error);
    res.status(500).json({ error: "Error al eliminar evento" });
  }
});

// ---------------------------------------------------------------------------
// Portero del Mes
// ---------------------------------------------------------------------------

// GET /api/portero-mes/:anio/:mes
app.get("/api/portero-mes/:anio/:mes", authenticateToken, async (req, res) => {
  const { anio, mes } = req.params;
  try {
    const result = await pool.query(
      `SELECT pm.id, pm.anio, pm.mes, pm.miembro_id,
              m.nombre, m.apellido, m.foto_url
       FROM portero_mes pm
       LEFT JOIN miembros m ON m.id = pm.miembro_id
       WHERE pm.anio = $1 AND pm.mes = $2`,
      [parseInt(anio), parseInt(mes)]
    );
    res.json(result.rows[0] || null);
  } catch (err) {
    console.error("Error GET portero-mes:", err.message);
    res.status(500).json({ error: "Error al obtener portero del mes" });
  }
});

// PUT /api/portero-mes/:anio/:mes — upsert
app.put("/api/portero-mes/:anio/:mes", authenticateToken, async (req, res) => {
  const { anio, mes } = req.params;
  const { miembro_id } = req.body;
  try {
    const result = await pool.query(
      `INSERT INTO portero_mes (anio, mes, miembro_id)
       VALUES ($1, $2, $3)
       ON CONFLICT (anio, mes) DO UPDATE SET miembro_id = EXCLUDED.miembro_id
       RETURNING id, anio, mes, miembro_id`,
      [parseInt(anio), parseInt(mes), miembro_id || null]
    );
    // Devolver con datos del miembro
    const row = result.rows[0];
    if (row.miembro_id) {
      const m = await pool.query("SELECT nombre, apellido, foto_url FROM miembros WHERE id=$1", [row.miembro_id]);
      if (m.rows.length) Object.assign(row, m.rows[0]);
    }
    res.json(row);
  } catch (err) {
    console.error("Error PUT portero-mes:", err.message);
    res.status(500).json({ error: "Error al guardar portero del mes" });
  }
});

// DELETE /api/calendario/:anio/:mes/asignaciones — borra coordinadores, predicadores y portero del mes
// Mantiene encargados y notas de ocurrencias.
app.delete("/api/calendario/:anio/:mes/asignaciones", authenticateToken, async (req, res) => {
  const anio = parseInt(req.params.anio);
  const mes  = parseInt(req.params.mes); // 1-based
  if (!anio || !mes || mes < 1 || mes > 12) return res.status(400).json({ error: "Año/mes inválidos" });

  const toYMD = (d) =>
    `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;

  function getFechasEnMes(ev, anio, mes0) {
    const primerDia = new Date(anio, mes0, 1);
    const ultimoDia = new Date(anio, mes0 + 1, 0);
    const fechas = [];
    const inicio = ev.fecha_inicio ? new Date(String(ev.fecha_inicio).slice(0,10) + 'T00:00:00') : null;
    if (ev.tipo === 'recurrente' && ev.recurrencia && ev.recurrencia !== 'ninguna') {
      switch (ev.recurrencia) {
        case 'semanal': {
          const ds = ev.dia_semana ?? (inicio ? inicio.getDay() : 0);
          let d = new Date(anio, mes0, 1);
          while (d.getDay() !== ds) d.setDate(d.getDate() + 1);
          while (d <= ultimoDia) { fechas.push(toYMD(d)); d.setDate(d.getDate() + 7); }
          break;
        }
        case 'quincenal': {
          const ds = ev.dia_semana ?? (inicio ? inicio.getDay() : 0);
          let d = new Date(anio, mes0, 1);
          while (d.getDay() !== ds) d.setDate(d.getDate() + 1);
          let cnt = 0;
          while (d <= ultimoDia) { if (cnt % 2 === 0) fechas.push(toYMD(d)); d.setDate(d.getDate() + 7); cnt++; }
          break;
        }
        case 'mensual': {
          if (inicio) { const f = new Date(anio, mes0, inicio.getDate()); if (f >= primerDia && f <= ultimoDia) fechas.push(toYMD(f)); }
          break;
        }
        case 'anual': {
          if (inicio && inicio.getMonth() === mes0) fechas.push(toYMD(new Date(anio, mes0, inicio.getDate())));
          break;
        }
      }
    } else if (inicio && inicio.getFullYear() === anio && inicio.getMonth() === mes0) {
      fechas.push(toYMD(inicio));
    }
    return fechas;
  }

  try {
    const mes0 = mes - 1;
    const fechaInicio = toYMD(new Date(anio, mes0, 1));
    const fechaFin    = toYMD(new Date(anio, mes0 + 1, 0));

    // 1. Borrar portero del mes
    await pool.query(`DELETE FROM portero_mes WHERE anio = $1 AND mes = $2`, [anio, mes]);

    // 2. Nullear coord/pred en ocurrencias EXISTENTES del mes (conserva encargado y notas)
    await pool.query(
      `UPDATE evento_ocurrencias SET coordinador_id = NULL, predicador_id = NULL
       WHERE fecha BETWEEN $1 AND $2`,
      [fechaInicio, fechaFin]
    );

    // 3. Para eventos que tienen coordinador o predicador en el BASE, crear null-overrides
    //    por cada fecha del mes para que mergeOc anule el valor heredado del evento base.
    //    Se preserva el encargado_id del evento base en la inserción.
    //    IMPORTANTE: NO se borran estas filas - son necesarias para anular el base.
    const evRes = await pool.query(
      `SELECT id, tipo, recurrencia, dia_semana, fecha_inicio, encargado_id
       FROM eventos
       WHERE coordinador_id IS NOT NULL OR predicador_id IS NOT NULL`
    );

    for (const ev of evRes.rows) {
      const fechas = getFechasEnMes(ev, anio, mes0);
      for (const fecha of fechas) {
        await pool.query(
          `INSERT INTO evento_ocurrencias (evento_id, fecha, encargado_id, coordinador_id, predicador_id, notas)
           VALUES ($1, $2::date, $3, NULL, NULL, NULL)
           ON CONFLICT (evento_id, fecha) DO UPDATE
             SET coordinador_id = NULL,
                 predicador_id  = NULL`,
          [ev.id, fecha, ev.encargado_id ?? null]
        );
      }
    }

    res.json({ ok: true });
  } catch (err) {
    console.error("Error DELETE asignaciones mes:", err.message);
    res.status(500).json({ error: "Error al resetear asignaciones" });
  }
});

// POST /api/eventos/:id/ocurrencias — upsert encargado/coordinador/predicador/notas para una fecha específica
app.post("/api/eventos/:id/ocurrencias", authenticateToken, async (req, res) => {
  const { fecha, encargado_id, coordinador_id, predicador_id, notas } = req.body;
  if (!fecha) return res.status(400).json({ error: "La fecha es obligatoria" });
  try {
    const client = await pool.connect();
    const result = await client.query(
      `INSERT INTO evento_ocurrencias (evento_id, fecha, encargado_id, coordinador_id, predicador_id, notas)
       VALUES ($1, $2, $3, $4, $5, $6)
       ON CONFLICT (evento_id, fecha)
       DO UPDATE SET encargado_id   = EXCLUDED.encargado_id,
                     coordinador_id = EXCLUDED.coordinador_id,
                     predicador_id  = EXCLUDED.predicador_id,
                     notas          = EXCLUDED.notas
       RETURNING *`,
      [req.params.id, fecha, encargado_id || null, coordinador_id || null, predicador_id || null, notas || null]
    );
    client.release();
    res.json(result.rows[0]);
  } catch (error) {
    console.error("Error al guardar ocurrencia:", error);
    res.status(500).json({ error: "Error al guardar ocurrencia" });
  }
});

// DELETE /api/eventos/:id/ocurrencias/:fecha — eliminar override de una fecha
app.delete("/api/eventos/:id/ocurrencias/:fecha", authenticateToken, async (req, res) => {
  try {
    const client = await pool.connect();
    await client.query(
      "DELETE FROM evento_ocurrencias WHERE evento_id = $1 AND fecha = $2",
      [req.params.id, req.params.fecha]
    );
    client.release();
    res.json({ success: true });
  } catch (error) {
    console.error("Error al eliminar ocurrencia:", error);
    res.status(500).json({ error: "Error al eliminar ocurrencia" });
  }
});

// --- Iniciar servidor ---
const PORT = process.env.PORT || 3001;

async function initFamiliasTables() {
  try {
    const client = await pool.connect();
    await client.query(`
      CREATE TABLE IF NOT EXISTS familias (
        id SERIAL PRIMARY KEY,
        nombre VARCHAR(100),
        created_at TIMESTAMPTZ DEFAULT NOW()
      );
      CREATE TABLE IF NOT EXISTS familia_miembros (
        id SERIAL PRIMARY KEY,
        familia_id INTEGER NOT NULL REFERENCES familias(id) ON DELETE CASCADE,
        miembro_id INTEGER NOT NULL REFERENCES miembros(id) ON DELETE CASCADE,
        parentesco VARCHAR(50) NOT NULL DEFAULT 'otro',
        UNIQUE (familia_id, miembro_id)
      );
      CREATE INDEX IF NOT EXISTS idx_familia_miembros_familia ON familia_miembros(familia_id);
      CREATE INDEX IF NOT EXISTS idx_familia_miembros_miembro ON familia_miembros(miembro_id);
    `);
    client.release();
    console.log("[DB] Tablas familias listas.");
  } catch (err) {
    console.error("[DB] Error al crear tablas familias:", err.message);
  }
}

// ══════════════════════════════════════════════════════════════════════════════
// MÚSICA — Google Drive API (API key pública, sin OAuth)
// ══════════════════════════════════════════════════════════════════════════════

const DRIVE_API = "https://www.googleapis.com/drive/v3";

// Extrae el folder ID de una URL de Drive o lo devuelve tal cual si ya es un ID
function extractFolderId(input) {
  const m = input.match(/\/folders\/([a-zA-Z0-9_-]+)/);
  return m ? m[1] : input.trim();
}

async function driveList(params) {
  const apiKey = process.env.GOOGLE_API_KEY;
  if (!apiKey) throw new Error("GOOGLE_API_KEY no configurada en el servidor");
  const qs = new URLSearchParams({ ...params, key: apiKey }).toString();
  const res = await fetch(`${DRIVE_API}/files?${qs}`);
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err?.error?.message || `Drive API error ${res.status}`);
  }
  return res.json();
}

// POST /api/musica/configurar — admin guarda el folder ID o URL de Google Drive
app.post("/api/musica/configurar", authenticateToken, async (req, res) => {
  const { share_url } = req.body;
  if (!share_url?.trim()) return res.status(400).json({ error: "URL o ID requerido" });
  const folderId = extractFolderId(share_url);
  try {
    await pool.query(
      `INSERT INTO configuracion (clave, valor) VALUES ('google_drive_folder_id', $1)
       ON CONFLICT (clave) DO UPDATE SET valor = EXCLUDED.valor, updated_at = NOW()`,
      [folderId]
    );
    // Limpiar clave anterior de OneDrive si existe
    await pool.query("DELETE FROM configuracion WHERE clave = 'onedrive_share_url'");
    res.json({ ok: true, folderId });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// GET /api/musica/estado
app.get("/api/musica/estado", authenticateToken, async (req, res) => {
  try {
    const r = await pool.query("SELECT valor FROM configuracion WHERE clave = 'google_drive_folder_id'");
    res.json({ configurado: r.rows.length > 0, folderId: r.rows[0]?.valor || null });
  } catch { res.json({ configurado: false }); }
});

// GET /api/musica/carpetas — subcarpetas de la carpeta raíz de Drive (o de una carpeta específica si se pasa ?folderId=X)
app.get("/api/musica/carpetas", authenticateMiembro, async (req, res) => {
  try {
    let folderId = req.query.folderId;
    if (!folderId) {
      const r = await pool.query("SELECT valor FROM configuracion WHERE clave = 'google_drive_folder_id'");
      if (!r.rows.length)
        return res.status(503).json({ error: "Música no configurada. Contacta al administrador." });
      folderId = r.rows[0].valor;
    }
    const data = await driveList({
      q: `'${folderId}' in parents and mimeType='application/vnd.google-apps.folder' and trashed=false`,
      fields: "files(id,name)",
      orderBy: "name",
      pageSize: "100",
    });
    res.json(data.files || []);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// GET /api/musica/canciones?folderId=XXX — archivos de audio en una subcarpeta
app.get("/api/musica/canciones", authenticateMiembro, async (req, res) => {
  const { folderId } = req.query;
  if (!folderId) return res.status(400).json({ error: "Parámetro 'folderId' requerido" });
  try {
    const data = await driveList({
      q: `'${folderId}' in parents and trashed=false`,
      fields: "files(id,name,mimeType,size)",
      orderBy: "name",
      pageSize: "200",
    });
    const canciones = (data.files || []).filter(
      f => f.mimeType?.startsWith("audio/") || /\.(mp3|wav|flac|m4a|aac|ogg|wma)$/i.test(f.name)
    );
    res.json(canciones);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// GET /api/musica/stream/:fileId — proxy de audio desde Google Drive (resuelve CORS)
app.get("/api/musica/stream/:fileId", authenticateMiembro, async (req, res) => {
  const apiKey = process.env.GOOGLE_API_KEY;
  if (!apiKey) return res.status(503).json({ error: "GOOGLE_API_KEY no configurada" });
  try {
    const driveRes = await fetch(
      `${DRIVE_API}/files/${req.params.fileId}?alt=media&key=${apiKey}`,
      { headers: req.headers.range ? { Range: req.headers.range } : {} }
    );
    if (!driveRes.ok) return res.status(driveRes.status).json({ error: "No se pudo obtener el audio" });
    res.status(driveRes.status);
    ["content-type", "content-length", "content-range", "accept-ranges"].forEach(h => {
      const v = driveRes.headers.get(h);
      if (v) res.setHeader(h, v);
    });
    const { Readable } = await import("node:stream");
    Readable.fromWeb(driveRes.body).pipe(res);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ── Playlists ──────────────────────────────────────────────────────────────

app.get("/api/musica/playlists", authenticateMiembro, async (req, res) => {
  try {
    const r = await pool.query(
      `SELECT p.id, p.nombre, p.created_at, COUNT(pc.id)::int AS total
       FROM playlists p
       LEFT JOIN playlist_canciones pc ON pc.playlist_id = p.id
       WHERE p.miembro_id = $1
       GROUP BY p.id ORDER BY p.created_at DESC`,
      [req.miembro.id]
    );
    res.json(r.rows);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.post("/api/musica/playlists", authenticateMiembro, async (req, res) => {
  const { nombre } = req.body;
  if (!nombre?.trim()) return res.status(400).json({ error: "Nombre requerido" });
  try {
    const r = await pool.query(
      "INSERT INTO playlists (miembro_id, nombre) VALUES ($1, $2) RETURNING *",
      [req.miembro.id, nombre.trim()]
    );
    res.json({ ...r.rows[0], total: 0 });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.put("/api/musica/playlists/:id", authenticateMiembro, async (req, res) => {
  const { nombre } = req.body;
  if (!nombre?.trim()) return res.status(400).json({ error: "Nombre requerido" });
  try {
    const r = await pool.query(
      "UPDATE playlists SET nombre = $1 WHERE id = $2 AND miembro_id = $3 RETURNING *",
      [nombre.trim(), req.params.id, req.miembro.id]
    );
    if (!r.rows.length) return res.status(404).json({ error: "No encontrada" });
    res.json(r.rows[0]);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.delete("/api/musica/playlists/:id", authenticateMiembro, async (req, res) => {
  try {
    await pool.query("DELETE FROM playlists WHERE id = $1 AND miembro_id = $2", [req.params.id, req.miembro.id]);
    res.json({ ok: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.get("/api/musica/playlists/:id/canciones", authenticateMiembro, async (req, res) => {
  try {
    const r = await pool.query(
      `SELECT pc.* FROM playlist_canciones pc
       JOIN playlists p ON p.id = pc.playlist_id
       WHERE pc.playlist_id = $1 AND p.miembro_id = $2
       ORDER BY pc.orden, pc.id`,
      [req.params.id, req.miembro.id]
    );
    res.json(r.rows);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.post("/api/musica/playlists/:id/canciones", authenticateMiembro, async (req, res) => {
  const { file_id, titulo, duracion_ms, carpeta } = req.body;
  if (!file_id || !titulo) return res.status(400).json({ error: "file_id y titulo son requeridos" });
  try {
    const pl = await pool.query(
      "SELECT id FROM playlists WHERE id = $1 AND miembro_id = $2",
      [req.params.id, req.miembro.id]
    );
    if (!pl.rows.length) return res.status(403).json({ error: "No autorizado" });
    const exists = await pool.query(
      "SELECT id FROM playlist_canciones WHERE playlist_id = $1 AND file_id = $2",
      [req.params.id, file_id]
    );
    if (exists.rows.length) return res.status(409).json({ error: "Ya está en la playlist" });
    const maxR = await pool.query(
      "SELECT COALESCE(MAX(orden), -1) + 1 AS next FROM playlist_canciones WHERE playlist_id = $1",
      [req.params.id]
    );
    const r = await pool.query(
      "INSERT INTO playlist_canciones (playlist_id, file_id, titulo, duracion_ms, orden, carpeta) VALUES ($1, $2, $3, $4, $5, $6) RETURNING *",
      [req.params.id, file_id, titulo, duracion_ms || null, maxR.rows[0].next, carpeta || null]
    );
    res.json(r.rows[0]);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.delete("/api/musica/playlists/:id/canciones/:cancionId", authenticateMiembro, async (req, res) => {
  try {
    await pool.query(
      `DELETE FROM playlist_canciones WHERE id = $1 AND playlist_id = $2
       AND (SELECT miembro_id FROM playlists WHERE id = $2) = $3`,
      [req.params.cancionId, req.params.id, req.miembro.id]
    );
    res.json({ ok: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ──────────────────────────────────────────────
// SECRETARÍA
// ──────────────────────────────────────────────

// POST /api/secretaria/eventos — crear evento
app.post("/api/secretaria/eventos", authenticateToken, requireSecretariaAccess, async (req, res) => {
  const { tipo, nombre_evento, fecha, descripcion, hora_inicio, hora_fin } = req.body;
  if (!tipo || !fecha) return res.status(400).json({ error: "Tipo y fecha son requeridos" });
  try {
    const result = await pool.query(
      `INSERT INTO secretaria_eventos (tipo, nombre_evento, fecha, descripcion, hora_inicio, hora_fin, creado_por)
       VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *`,
      [tipo, nombre_evento || null, fecha, descripcion || null, hora_inicio || null, hora_fin || null, req.user.username]
    );
    res.json(result.rows[0]);
  } catch (err) {
    console.error("Error crear secretaria_evento:", err.message);
    res.status(500).json({ error: "Error al crear evento" });
  }
});

// GET /api/secretaria/eventos?desde=&hasta= — listar por rango de fecha
app.get("/api/secretaria/eventos", authenticateToken, requireSecretariaAccess, async (req, res) => {
  const { desde, hasta } = req.query;
  try {
    let query = "SELECT * FROM secretaria_eventos";
    const params = [];
    if (desde && hasta) {
      query += " WHERE fecha BETWEEN $1 AND $2";
      params.push(desde, hasta);
    } else if (desde) {
      query += " WHERE fecha >= $1";
      params.push(desde);
    } else if (hasta) {
      query += " WHERE fecha <= $1";
      params.push(hasta);
    }
    query += " ORDER BY fecha DESC, created_at DESC";
    const result = await pool.query(query, params);
    res.json(result.rows);
  } catch (err) {
    console.error("Error listar secretaria_eventos:", err.message);
    res.status(500).json({ error: "Error al obtener eventos" });
  }
});

// PUT /api/secretaria/eventos/:id — actualizar evento
app.put("/api/secretaria/eventos/:id", authenticateToken, requireSecretariaAccess, async (req, res) => {
  const { id } = req.params;
  const { tipo, nombre_evento, fecha, descripcion, hora_inicio, hora_fin } = req.body;
  if (!tipo || !fecha) return res.status(400).json({ error: "Tipo y fecha son requeridos" });
  try {
    const result = await pool.query(
      `UPDATE secretaria_eventos
       SET tipo=$1, nombre_evento=$2, fecha=$3, descripcion=$4, hora_inicio=$5, hora_fin=$6, updated_at=NOW()
       WHERE id=$7 RETURNING *`,
      [tipo, nombre_evento || null, fecha, descripcion || null, hora_inicio || null, hora_fin || null, id]
    );
    if (result.rows.length === 0) return res.status(404).json({ error: "Evento no encontrado" });
    res.json(result.rows[0]);
  } catch (err) {
    console.error("Error actualizar secretaria_evento:", err.message);
    res.status(500).json({ error: "Error al actualizar evento" });
  }
});

// DELETE /api/secretaria/eventos/:id
app.delete("/api/secretaria/eventos/:id", authenticateToken, requireSecretariaAccess, async (req, res) => {
  const { id } = req.params;
  try {
    await pool.query("DELETE FROM secretaria_eventos WHERE id=$1", [id]);
    res.json({ ok: true });
  } catch (err) {
    console.error("Error eliminar secretaria_evento:", err.message);
    res.status(500).json({ error: "Error al eliminar evento" });
  }
});

// GET /api/secretaria/eventos/:id — detalle de evento + asistencias vinculadas (misma fecha y tipo)
app.get("/api/secretaria/eventos/:id", authenticateToken, requireSecretariaAccess, async (req, res) => {
  const { id } = req.params;
  try {
    const eventoResult = await pool.query(
      "SELECT * FROM secretaria_eventos WHERE id = $1",
      [id]
    );
    if (eventoResult.rows.length === 0)
      return res.status(404).json({ error: "Evento no encontrado" });

    const evento = eventoResult.rows[0];

    // Asistencias con misma fecha y mismo tipo de evento
    const sesionesResult = await pool.query(
      `SELECT * FROM secretaria_asistencia
       WHERE fecha = $1 AND tipo_evento = $2
       ORDER BY created_at`,
      [evento.fecha, evento.tipo]
    );

    const asistencias = [];
    if (sesionesResult.rows.length > 0) {
      const ids = sesionesResult.rows.map(s => s.id);
      const registrosResult = await pool.query(
        `SELECT r.asistencia_id, r.presente, r.nombre_visitante, m.nombre, m.apellido
         FROM secretaria_asistencia_registros r
         LEFT JOIN miembros m ON m.id = r.miembro_id
         WHERE r.asistencia_id = ANY($1::int[])
         ORDER BY r.presente DESC, m.apellido NULLS LAST, m.nombre`,
        [ids]
      );
      const regPorSesion = {};
      registrosResult.rows.forEach(r => {
        if (!regPorSesion[r.asistencia_id]) regPorSesion[r.asistencia_id] = [];
        regPorSesion[r.asistencia_id].push(r);
      });
      sesionesResult.rows.forEach(s => {
        asistencias.push({ ...s, registros: regPorSesion[s.id] || [] });
      });
    }

    // Anotaciones vinculadas al evento (personas para bautizos, defunciones, etc.)
    const anotacionesResult = await pool.query(
      `SELECT a.*, m.nombre AS miembro_nombre, m.apellido AS miembro_apellido, m.foto_url
       FROM secretaria_anotaciones a
       LEFT JOIN miembros m ON m.id = a.miembro_id
       WHERE a.evento_id = $1
       ORDER BY a.tipo, a.id`,
      [id]
    );

    res.json({ ...evento, asistencias, anotaciones: anotacionesResult.rows });
  } catch (err) {
    console.error("Error get evento detalle:", err.message);
    res.status(500).json({ error: "Error al obtener evento" });
  }
});

// POST /api/secretaria/asistencia — crear sesión de asistencia
app.post("/api/secretaria/asistencia", authenticateToken, requireSecretariaAccess, async (req, res) => {
  const { fecha, tipo_evento, nombre_evento, registros } = req.body;
  if (!fecha || !tipo_evento) return res.status(400).json({ error: "Fecha y tipo de evento requeridos" });
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const sesionResult = await client.query(
      `INSERT INTO secretaria_asistencia (fecha, tipo_evento, nombre_evento, creado_por)
       VALUES ($1, $2, $3, $4) RETURNING *`,
      [fecha, tipo_evento, nombre_evento || null, req.user.username]
    );
    const sesion = sesionResult.rows[0];
    if (Array.isArray(registros) && registros.length > 0) {
      for (const r of registros) {
        await client.query(
          `INSERT INTO secretaria_asistencia_registros
             (asistencia_id, miembro_id, nombre_visitante, registrar_como_miembro, presente)
           VALUES ($1, $2, $3, $4, $5)`,
          [
            sesion.id,
            r.miembro_id || null,
            r.nombre_visitante || null,
            r.registrar_como_miembro || false,
            r.presente !== undefined ? r.presente : true,
          ]
        );
      }
    }
    await client.query("COMMIT");
    res.json({ ok: true, sesion });
  } catch (err) {
    await client.query("ROLLBACK");
    console.error("Error crear asistencia:", err.message);
    res.status(500).json({ error: "Error al guardar asistencia" });
  } finally {
    client.release();
  }
});

// GET /api/secretaria/asistencia?desde=&hasta= — listar sesiones
app.get("/api/secretaria/asistencia", authenticateToken, requireSecretariaAccess, async (req, res) => {
  const { desde, hasta } = req.query;
  try {
    let query = "SELECT * FROM secretaria_asistencia";
    const params = [];
    if (desde && hasta) {
      query += " WHERE fecha BETWEEN $1 AND $2";
      params.push(desde, hasta);
    }
    query += " ORDER BY fecha DESC, created_at DESC";
    const result = await pool.query(query, params);
    res.json(result.rows);
  } catch (err) {
    console.error("Error listar asistencia:", err.message);
    res.status(500).json({ error: "Error al obtener registros" });
  }
});

// GET /api/secretaria/asistencia/:id — sesión con sus registros
app.get("/api/secretaria/asistencia/:id", authenticateToken, requireSecretariaAccess, async (req, res) => {
  const { id } = req.params;
  try {
    const sesionResult = await pool.query("SELECT * FROM secretaria_asistencia WHERE id=$1", [id]);
    if (sesionResult.rows.length === 0) return res.status(404).json({ error: "Sesión no encontrada" });
    const registrosResult = await pool.query(
      `SELECT r.*, m.nombre, m.apellido, m.foto_url
       FROM secretaria_asistencia_registros r
       LEFT JOIN miembros m ON m.id = r.miembro_id
       WHERE r.asistencia_id = $1
       ORDER BY m.apellido, m.nombre`,
      [id]
    );
    res.json({ ...sesionResult.rows[0], registros: registrosResult.rows });
  } catch (err) {
    console.error("Error get asistencia:", err.message);
    res.status(500).json({ error: "Error al obtener sesión" });
  }
});

// PUT /api/secretaria/asistencia/:id — actualizar sesión de asistencia
app.put("/api/secretaria/asistencia/:id", authenticateToken, requireSecretariaAccess, async (req, res) => {
  const { id } = req.params;
  const { fecha, tipo_evento, nombre_evento, registros } = req.body;
  if (!fecha || !tipo_evento) return res.status(400).json({ error: "Fecha y tipo de evento requeridos" });
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    await client.query(
      `UPDATE secretaria_asistencia SET fecha=$1, tipo_evento=$2, nombre_evento=$3 WHERE id=$4`,
      [fecha, tipo_evento, nombre_evento || null, id]
    );
    await client.query("DELETE FROM secretaria_asistencia_registros WHERE asistencia_id=$1", [id]);
    if (Array.isArray(registros) && registros.length > 0) {
      for (const r of registros) {
        await client.query(
          `INSERT INTO secretaria_asistencia_registros
             (asistencia_id, miembro_id, nombre_visitante, registrar_como_miembro, presente)
           VALUES ($1, $2, $3, $4, $5)`,
          [
            id,
            r.miembro_id || null,
            r.nombre_visitante || null,
            r.registrar_como_miembro || false,
            r.presente !== undefined ? r.presente : true,
          ]
        );
      }
    }
    await client.query("COMMIT");
    res.json({ ok: true });
  } catch (err) {
    await client.query("ROLLBACK");
    console.error("Error actualizar asistencia:", err.message);
    res.status(500).json({ error: "Error al actualizar asistencia" });
  } finally {
    client.release();
  }
});

// ── Anotaciones (cumpleaños en evento, presentaciones, declaraciones de fe, bautizos) ──

// POST /api/secretaria/anotaciones — crear anotación
app.post("/api/secretaria/anotaciones", authenticateToken, requireSecretariaAccess, async (req, res) => {
  const { evento_id, fecha, tipo, miembro_id, nombre_libre, notas, fecha_ocurrencia } = req.body;
  if (!fecha || !tipo) return res.status(400).json({ error: "Fecha y tipo son requeridos" });
  try {
    const result = await pool.query(
      `INSERT INTO secretaria_anotaciones (evento_id, fecha, tipo, miembro_id, nombre_libre, notas, creado_por, fecha_ocurrencia)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING *`,
      [evento_id || null, fecha, tipo, miembro_id || null, nombre_libre || null, notas || null, req.user.username, fecha_ocurrencia || null]
    );
    res.json(result.rows[0]);
  } catch (err) {
    console.error("Error crear anotacion:", err.message);
    res.status(500).json({ error: "Error al guardar anotación" });
  }
});

// DELETE /api/secretaria/anotaciones/:id
app.delete("/api/secretaria/anotaciones/:id", authenticateToken, requireSecretariaAccess, async (req, res) => {
  try {
    await pool.query("DELETE FROM secretaria_anotaciones WHERE id=$1", [req.params.id]);
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: "Error al eliminar anotación" });
  }
});

// GET /api/secretaria/anotaciones?desde=&hasta= — listar por rango
app.get("/api/secretaria/anotaciones", authenticateToken, requireSecretariaAccess, async (req, res) => {
  const { desde, hasta } = req.query;
  try {
    const result = await pool.query(
      `SELECT a.*, m.nombre AS miembro_nombre, m.apellido AS miembro_apellido, m.foto_url
       FROM secretaria_anotaciones a
       LEFT JOIN miembros m ON m.id = a.miembro_id
       WHERE a.fecha BETWEEN $1 AND $2
       ORDER BY a.fecha, a.tipo, a.id`,
      [desde, hasta]
    );
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: "Error al obtener anotaciones" });
  }
});

// GET /api/secretaria/anotaciones/evento/:evento_id — anotaciones de un evento
app.get("/api/secretaria/anotaciones/evento/:evento_id", authenticateToken, requireSecretariaAccess, async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT a.*, m.nombre AS miembro_nombre, m.apellido AS miembro_apellido, m.foto_url
       FROM secretaria_anotaciones a
       LEFT JOIN miembros m ON m.id = a.miembro_id
       WHERE a.evento_id = $1
       ORDER BY a.tipo, a.id`,
      [req.params.evento_id]
    );
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: "Error al obtener anotaciones del evento" });
  }
});

// GET /api/secretaria/cumpleanos?mes= — miembros con cumpleaños en ese mes (1-12)
app.get("/api/secretaria/cumpleanos", authenticateToken, requireSecretariaAccess, async (req, res) => {
  const { mes } = req.query;
  if (!mes) return res.status(400).json({ error: "Parámetro mes requerido" });
  try {
    const result = await pool.query(
      `SELECT id, nombre, apellido, fecha_nacimiento, foto_url
       FROM miembros
       WHERE estado = 'activo'
         AND EXTRACT(MONTH FROM fecha_nacimiento) = $1
       ORDER BY EXTRACT(DAY FROM fecha_nacimiento), apellido`,
      [parseInt(mes)]
    );
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: "Error al obtener cumpleaños" });
  }
});

// GET /api/secretaria/dashboard?desde=&hasta= — estadísticas para dashboard
app.get("/api/secretaria/dashboard", authenticateToken, requireSecretariaAccess, async (req, res) => {
  const { desde, hasta } = req.query;
  if (!desde || !hasta) return res.status(400).json({ error: "Parámetros desde y hasta son requeridos" });
  try {
    // ── Asistencia: stats por tipo_evento ──────────────────────────────────
    const asistStats = await pool.query(
      `SELECT
         sa.tipo_evento,
         sa.nombre_evento,
         COUNT(sa.id)::int                                              AS sesiones,
         ROUND(AVG(p.cnt))::int                                         AS promedio_presentes,
         MAX(p.cnt)::int                                                AS max_presentes,
         MIN(p.cnt)::int                                                AS min_presentes
       FROM secretaria_asistencia sa
       JOIN (
         SELECT asistencia_id, COUNT(*) FILTER (WHERE presente) AS cnt
         FROM secretaria_asistencia_registros
         GROUP BY asistencia_id
       ) p ON p.asistencia_id = sa.id
       WHERE sa.fecha BETWEEN $1 AND $2
       GROUP BY sa.tipo_evento, sa.nombre_evento
       ORDER BY sa.tipo_evento, sa.nombre_evento`,
      [desde, hasta]
    );

    // ── Eventos: stats de horario por tipo (solo tipos de culto/reunión) ──
    const eventoStats = await pool.query(
      `WITH base AS (
         SELECT tipo, nombre_evento, fecha, hora_inicio, hora_fin,
           EXTRACT(EPOCH FROM (hora_fin - hora_inicio))/60 AS dur_min
         FROM secretaria_eventos
         WHERE fecha BETWEEN $1 AND $2
           AND hora_inicio IS NOT NULL
           AND tipo = ANY(ARRAY['culto_domingo','culto_jueves','estudio_biblico',
                                'dorcas','cadena_oracion','esc_dominical','evento_especial'])
       ),
       grp AS (
         SELECT tipo, nombre_evento,
           COUNT(*)::int AS total,
           TO_CHAR(
             (EXTRACT(EPOCH FROM AVG(hora_inicio - '00:00'::time)) || ' seconds')::interval,
             'HH24:MI'
           ) AS inicio_promedio,
           MIN(hora_inicio)  AS inicio_min_val,
           MAX(hora_fin)     AS fin_max_val,
           ROUND(AVG(dur_min))::int AS duracion_prom_min,
           MIN(dur_min)::int AS dur_min_val,
           MAX(dur_min)::int AS dur_max_val
         FROM base GROUP BY tipo, nombre_evento
       ),
       e_inicio_min AS (
         SELECT DISTINCT ON (b.tipo, b.nombre_evento)
           b.tipo, b.nombre_evento, b.fecha AS fecha_inicio_min
         FROM base b
         JOIN grp g ON g.tipo = b.tipo
           AND (g.nombre_evento IS NOT DISTINCT FROM b.nombre_evento)
         WHERE b.hora_inicio = g.inicio_min_val
         ORDER BY b.tipo, b.nombre_evento, b.fecha
       ),
       e_fin_max AS (
         SELECT DISTINCT ON (b.tipo, b.nombre_evento)
           b.tipo, b.nombre_evento, b.fecha AS fecha_fin_max
         FROM base b
         JOIN grp g ON g.tipo = b.tipo
           AND (g.nombre_evento IS NOT DISTINCT FROM b.nombre_evento)
         WHERE b.hora_fin = g.fin_max_val AND b.hora_fin IS NOT NULL
         ORDER BY b.tipo, b.nombre_evento, b.fecha
       ),
       e_dur_min AS (
         SELECT DISTINCT ON (b.tipo, b.nombre_evento)
           b.tipo, b.nombre_evento, b.fecha AS fecha_dur_min
         FROM base b
         JOIN grp g ON g.tipo = b.tipo
           AND (g.nombre_evento IS NOT DISTINCT FROM b.nombre_evento)
         WHERE b.dur_min = g.dur_min_val
         ORDER BY b.tipo, b.nombre_evento, b.fecha
       ),
       e_dur_max AS (
         SELECT DISTINCT ON (b.tipo, b.nombre_evento)
           b.tipo, b.nombre_evento, b.fecha AS fecha_dur_max
         FROM base b
         JOIN grp g ON g.tipo = b.tipo
           AND (g.nombre_evento IS NOT DISTINCT FROM b.nombre_evento)
         WHERE b.dur_min = g.dur_max_val
         ORDER BY b.tipo, b.nombre_evento, b.fecha
       )
       SELECT
         g.tipo, g.nombre_evento, g.total,
         g.inicio_promedio,
         TO_CHAR(g.inicio_min_val, 'HH24:MI') AS inicio_mas_temprano,
         im.fecha_inicio_min,
         TO_CHAR(g.fin_max_val,    'HH24:MI') AS termino_mas_tarde,
         fm.fecha_fin_max,
         g.duracion_prom_min,
         g.dur_max_val AS duracion_max_min,
         dma.fecha_dur_max,
         g.dur_min_val AS duracion_min_min,
         dmi.fecha_dur_min
       FROM grp g
       LEFT JOIN e_inicio_min im  ON im.tipo  = g.tipo AND (im.nombre_evento  IS NOT DISTINCT FROM g.nombre_evento)
       LEFT JOIN e_fin_max    fm  ON fm.tipo  = g.tipo AND (fm.nombre_evento  IS NOT DISTINCT FROM g.nombre_evento)
       LEFT JOIN e_dur_min    dmi ON dmi.tipo = g.tipo AND (dmi.nombre_evento IS NOT DISTINCT FROM g.nombre_evento)
       LEFT JOIN e_dur_max    dma ON dma.tipo = g.tipo AND (dma.nombre_evento IS NOT DISTINCT FROM g.nombre_evento)
       ORDER BY g.tipo, g.nombre_evento`,
      [desde, hasta]
    );

    // ── Anotaciones del mes ────────────────────────────────────────────────
    const anotacionesResult = await pool.query(
      `SELECT a.*, m.nombre AS miembro_nombre, m.apellido AS miembro_apellido, m.foto_url
       FROM secretaria_anotaciones a
       LEFT JOIN miembros m ON m.id = a.miembro_id
       WHERE a.fecha BETWEEN $1 AND $2
       ORDER BY a.fecha, a.tipo, a.id`,
      [desde, hasta]
    );

    // ── Cumpleaños del mes (miembros activos) ──────────────────────────────
    const mesNum = parseInt(desde.split("-")[1]);
    const cumpleanosResult = await pool.query(
      `SELECT id, nombre, apellido, fecha_nacimiento, foto_url
       FROM miembros
       WHERE estado = 'activo' AND EXTRACT(MONTH FROM fecha_nacimiento) = $1
       ORDER BY EXTRACT(DAY FROM fecha_nacimiento), apellido`,
      [mesNum]
    );

    // ── Nuevos miembros del mes ────────────────────────────────────────────
    const nuevosMiembrosResult = await pool.query(
      `SELECT id, nombre, apellido, foto_url, DATE(created_at) AS fecha_ingreso
       FROM miembros
       WHERE estado = 'activo'
         AND DATE(created_at) BETWEEN $1 AND $2
       ORDER BY created_at`,
      [desde, hasta]
    );

    res.json({
      asistencia:    asistStats.rows,
      horarios:      eventoStats.rows,
      anotaciones:   anotacionesResult.rows,
      cumpleanos:    cumpleanosResult.rows,
      nuevosMiembros: nuevosMiembrosResult.rows,
    });
  } catch (err) {
    console.error("Error dashboard:", err.message);
    res.status(500).json({ error: "Error al obtener estadísticas" });
  }
});

// GET /api/secretaria/bitacora?desde=&hasta= — eventos + asistencias con registros (para PDF)
app.get("/api/secretaria/bitacora", authenticateToken, requireSecretariaAccess, async (req, res) => {
  const { desde, hasta } = req.query;
  if (!desde || !hasta) return res.status(400).json({ error: "Parámetros desde y hasta son requeridos" });
  try {
    const eventosResult = await pool.query(
      `SELECT * FROM secretaria_eventos WHERE fecha BETWEEN $1 AND $2 ORDER BY fecha, created_at`,
      [desde, hasta]
    );
    const sesionesResult = await pool.query(
      `SELECT * FROM secretaria_asistencia WHERE fecha BETWEEN $1 AND $2 ORDER BY fecha, created_at`,
      [desde, hasta]
    );
    let registrosResult = { rows: [] };
    if (sesionesResult.rows.length > 0) {
      const ids = sesionesResult.rows.map(s => s.id);
      registrosResult = await pool.query(
        `SELECT r.*, m.nombre, m.apellido
         FROM secretaria_asistencia_registros r
         LEFT JOIN miembros m ON m.id = r.miembro_id
         WHERE r.asistencia_id = ANY($1::int[])
         ORDER BY r.asistencia_id, m.apellido NULLS LAST, m.nombre`,
        [ids]
      );
    }
    const registrosPorSesion = {};
    registrosResult.rows.forEach(r => {
      if (!registrosPorSesion[r.asistencia_id]) registrosPorSesion[r.asistencia_id] = [];
      registrosPorSesion[r.asistencia_id].push(r);
    });
    const asistencias = sesionesResult.rows.map(s => ({
      ...s,
      registros: registrosPorSesion[s.id] || [],
    }));
    res.json({ eventos: eventosResult.rows, asistencias });
  } catch (err) {
    console.error("Error bitácora:", err.message);
    res.status(500).json({ error: "Error al obtener bitácora" });
  }
});

app.listen(PORT, async () => {
  console.log(`Servidor corriendo en http://localhost:${PORT}`);
  await initFamiliasTables();
  // Migración: columna evento_id en hero_slides
  try {
    await pool.query(
      "ALTER TABLE hero_slides ADD COLUMN IF NOT EXISTS evento_id INTEGER REFERENCES eventos(id) ON DELETE SET NULL"
    );
    console.log("[DB] Columna evento_id en hero_slides lista.");
  } catch (err) {
    console.error("[DB] Error al migrar hero_slides:", err.message);
  }
  // Migración: tabla disponibilidad_bloqueada
  try {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS disponibilidad_bloqueada (
        id           SERIAL PRIMARY KEY,
        miembro_id   INTEGER NOT NULL REFERENCES miembros(id) ON DELETE CASCADE,
        fecha_inicio DATE    NOT NULL,
        fecha_fin    DATE    NOT NULL,
        motivo       TEXT,
        created_at   TIMESTAMPTZ DEFAULT NOW()
      )
    `);
    await pool.query(
      "CREATE INDEX IF NOT EXISTS idx_disp_miembro ON disponibilidad_bloqueada(miembro_id)"
    );
    await pool.query(
      "CREATE INDEX IF NOT EXISTS idx_disp_fechas ON disponibilidad_bloqueada(fecha_inicio, fecha_fin)"
    );
    console.log("[DB] Tabla disponibilidad_bloqueada lista.");
  } catch (err) {
    console.error("[DB] Error al migrar disponibilidad_bloqueada:", err.message);
  }
  // Migraciones: música (configuracion, playlists, playlist_canciones)
  try {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS configuracion (
        clave      TEXT PRIMARY KEY,
        valor      TEXT NOT NULL,
        updated_at TIMESTAMPTZ DEFAULT NOW()
      )
    `);
    await pool.query(`
      CREATE TABLE IF NOT EXISTS playlists (
        id         SERIAL PRIMARY KEY,
        miembro_id INTEGER NOT NULL REFERENCES miembros(id) ON DELETE CASCADE,
        nombre     TEXT NOT NULL,
        created_at TIMESTAMPTZ DEFAULT NOW()
      )
    `);
    await pool.query(`
      CREATE TABLE IF NOT EXISTS playlist_canciones (
        id          SERIAL PRIMARY KEY,
        playlist_id INTEGER NOT NULL REFERENCES playlists(id) ON DELETE CASCADE,
        file_id     TEXT NOT NULL,
        titulo      TEXT NOT NULL,
        duracion_ms INTEGER,
        orden       INTEGER NOT NULL DEFAULT 0,
        created_at  TIMESTAMPTZ DEFAULT NOW()
      )
    `);
    await pool.query("CREATE INDEX IF NOT EXISTS idx_playlist_miembro ON playlists(miembro_id)");
    await pool.query("CREATE INDEX IF NOT EXISTS idx_playlist_canciones ON playlist_canciones(playlist_id)");
    // Migración: columna carpeta en playlist_canciones (para reproducción con enlace público)
    await pool.query(
      "ALTER TABLE playlist_canciones ADD COLUMN IF NOT EXISTS carpeta TEXT"
    );
    console.log("[DB] Tablas de música listas.");
  } catch (err) {
    console.error("[DB] Error al migrar tablas música:", err.message);
  }
  // Migración: tablas secretaría
  try {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS secretaria_eventos (
        id            SERIAL PRIMARY KEY,
        tipo          TEXT    NOT NULL,
        nombre_evento TEXT,
        fecha         DATE    NOT NULL,
        descripcion   TEXT,
        creado_por    TEXT,
        created_at    TIMESTAMPTZ DEFAULT NOW(),
        updated_at    TIMESTAMPTZ DEFAULT NOW()
      )
    `);
    await pool.query(
      "CREATE INDEX IF NOT EXISTS idx_sec_eventos_fecha ON secretaria_eventos(fecha)"
    );
    await pool.query(
      "ALTER TABLE secretaria_eventos ADD COLUMN IF NOT EXISTS nombre_evento TEXT"
    );
    await pool.query(`
      CREATE TABLE IF NOT EXISTS secretaria_asistencia (
        id            SERIAL PRIMARY KEY,
        fecha         DATE    NOT NULL,
        tipo_evento   TEXT    NOT NULL,
        nombre_evento TEXT,
        creado_por    TEXT,
        created_at    TIMESTAMPTZ DEFAULT NOW()
      )
    `);
    await pool.query(
      "CREATE INDEX IF NOT EXISTS idx_sec_asist_fecha ON secretaria_asistencia(fecha)"
    );
    await pool.query(`
      CREATE TABLE IF NOT EXISTS secretaria_asistencia_registros (
        id                     SERIAL PRIMARY KEY,
        asistencia_id          INTEGER NOT NULL REFERENCES secretaria_asistencia(id) ON DELETE CASCADE,
        miembro_id             INTEGER REFERENCES miembros(id) ON DELETE SET NULL,
        nombre_visitante       TEXT,
        registrar_como_miembro BOOLEAN DEFAULT FALSE,
        presente               BOOLEAN DEFAULT TRUE,
        created_at             TIMESTAMPTZ DEFAULT NOW()
      )
    `);
    await pool.query(
      "CREATE INDEX IF NOT EXISTS idx_sec_asist_reg ON secretaria_asistencia_registros(asistencia_id)"
    );
    console.log("[DB] Tablas secretaría listas.");
  } catch (err) {
    console.error("[DB] Error al migrar tablas secretaría:", err.message);
  }
});

