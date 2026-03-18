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
import transbankSdk from "transbank-sdk";

const { WebpayPlus, Options, Environment, IntegrationCommerceCodes, IntegrationApiKeys } = transbankSdk;

import { v2 as cloudinary } from "cloudinary";
import { sendDonationReceipt, saveDonation } from "./emailService.js";

// ✅ Cargar .env lo antes posible
dotenv.config();

// ✅ Configurar cloudinary después de cargar variables
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

const { Pool } = pkg;

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
app.use(express.json());
app.use(express.urlencoded({ extended: true })); // Necesario para recibir el POST de retorno de Webpay

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

// ========================
// � WEBPAY
// ========================

const webpayTx = new WebpayPlus.Transaction(
  process.env.TBK_COMMERCE_CODE && process.env.TBK_API_KEY
    ? new Options(process.env.TBK_COMMERCE_CODE, process.env.TBK_API_KEY, Environment.Production)
    : new Options(IntegrationCommerceCodes.WEBPAY_PLUS, IntegrationApiKeys.WEBPAY, Environment.Integration)
);

// Iniciar transacción Webpay
app.post("/api/webpay/init", async (req, res) => {
  const { amount, fondoId, email } = req.body;
  const clp = parseInt(amount);

  if (!clp || clp < 1) {
    return res.status(400).json({ error: "Monto inválido" });
  }

  const buyOrder = `DON-${Date.now()}`;
  const sessionId = `sess-${Date.now()}`;
  const backendUrl = process.env.BACKEND_URL || "https://iglesia-backend.onrender.com";
  const returnUrl = `${backendUrl}/api/webpay/return`;

  try {
    const response = await webpayTx.create(buyOrder, sessionId, clp, returnUrl);

    await pool.query(
      `INSERT INTO webpay_pending (buy_order, session_id, amount, fondo_id, email)
       VALUES ($1, $2, $3, $4, $5)
       ON CONFLICT (buy_order) DO NOTHING`,
      [buyOrder, sessionId, clp, fondoId || 1, email || null]
    );

    res.json({ url: response.url, token: response.token });
  } catch (error) {
    console.error("Error Webpay init:", error);
    res.status(500).json({ error: "Error al iniciar pago Webpay" });
  }
});

// Retorno desde Webpay (Transbank hace POST a esta URL)
app.post("/api/webpay/return", async (req, res) => {
  const token = req.body.token_ws;
  const tbkToken = req.body.TBK_TOKEN; // cancelación
  const frontendUrl = process.env.FRONTEND_URL || "https://vidanuevaimp.com";

  // Cancelado por el usuario
  if (!token && tbkToken) {
    await pool.query("DELETE FROM webpay_pending WHERE session_id IS NOT NULL AND created_at < NOW() - INTERVAL '30 minutes'").catch(() => {});
    return res.redirect(`${frontendUrl}/donacion?webpay=cancelado`);
  }

  if (!token) {
    return res.redirect(`${frontendUrl}/donacion?webpay=error`);
  }

  try {
    const response = await webpayTx.commit(token);

    if (response.response_code === 0) {
      const pending = await pool.query(
        "SELECT * FROM webpay_pending WHERE buy_order = $1",
        [response.buy_order]
      );

      if (pending.rows.length > 0) {
        const p = pending.rows[0];
        const payerName = response.card_detail?.card_number
          ? `Tarjeta ****${response.card_detail.card_number}`
          : "Webpay";

        await pool.query(
          `INSERT INTO donaciones (order_id, email, payer_name, amount_clp, amount_usd, fondo_id, fecha)
           VALUES ($1, $2, $3, $4, 0, $5, NOW())
           ON CONFLICT (order_id) DO NOTHING`,
          [response.buy_order, p.email, payerName, p.amount, p.fondo_id]
        );
        await pool.query("DELETE FROM webpay_pending WHERE buy_order = $1", [response.buy_order]);
      }

      return res.redirect(`${frontendUrl}/donacion?webpay=exito&monto=${response.amount}`);
    } else {
      return res.redirect(`${frontendUrl}/donacion?webpay=rechazado`);
    }
  } catch (error) {
    console.error("Error Webpay return:", error);
    return res.redirect(`${frontendUrl}/donacion?webpay=error`);
  }
});

// ========================

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
    const result = await pool.query(`
      SELECT
        f.id,
        f.nombre,
        f.descripcion,
        CASE
          WHEN f.meta IS NULL THEN NULL
          ELSE ROUND(
            LEAST(
              COALESCE(SUM(d.amount_clp), 0) / f.meta * 100,
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
    console.error("Error al obtener progreso de fondos:", error);
    res.status(500).json({ error: "Error al obtener fondos" });
  }
});

// GET admin: fondos con montos reales (protegido)
app.get("/api/fondos", authenticateToken, async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT
        f.id,
        f.nombre,
        f.descripcion,
        f.meta,
        COALESCE(SUM(d.amount_clp), 0) AS total_recaudado,
        COUNT(d.id) AS cantidad_donaciones,
        CASE
          WHEN f.meta IS NULL THEN NULL
          ELSE ROUND(
            LEAST(
              COALESCE(SUM(d.amount_clp), 0) / f.meta * 100,
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
      `SELECT id, order_id, payer_name, email, amount_clp, amount_usd, fecha
       FROM donaciones WHERE fondo_id = $1 ORDER BY fecha DESC`,
      [id]
    );
    res.json(result.rows);
  } catch (error) {
    console.error("Error al obtener donaciones del fondo:", error);
    res.status(500).json({ error: "Error al obtener donaciones" });
  }
});

// --- Endpoint para procesar donaciones y enviar comprobante ---
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


// --- Iniciar servidor ---
const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
  console.log(`Servidor corriendo en http://localhost:${PORT}`);
});

