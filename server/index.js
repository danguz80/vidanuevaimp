import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import { subDays } from "date-fns";
import pkg from "pg";

const { Pool } = pkg;
dotenv.config();

const app = express();
app.use(cors());
app.use(express.json());

const PORT = process.env.PORT || 3001;

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



// --- Nuevo endpoint para agregar sermón manualmente ---
app.post("/api/sermones", async (req, res) => {
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
app.put("/api/sermones/:videoId", async (req, res) => {
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
app.delete("/api/sermones/:videoId", async (req, res) => {
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

app.put("/api/mensajes/:id", async (req, res) => {
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

app.delete("/api/mensajes/:id", async (req, res) => {
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

// --- Iniciar servidor ---
app.listen(PORT, () => {
  console.log(`Servidor corriendo en http://localhost:${PORT}`);
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
app.post("/api/hero", async (req, res) => {
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
app.put("/api/hero/:id", async (req, res) => {
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
app.delete("/api/hero/:id", async (req, res) => {
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
