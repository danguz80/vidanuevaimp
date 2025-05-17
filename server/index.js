import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import { subDays } from "date-fns";
import pkg from "pg";
import axios from "axios";

import { v2 as cloudinary } from "cloudinary";

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
    origin: ["https://vidanuevaimp.com"], // ✅ tu dominio real
    methods: ["GET", "POST", "PUT", "DELETE"],
    credentials: true,
  })
);
app.use(express.json());

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

//Obtener galeria de Cloudinary
// Obtener galería de Cloudinary con search.expression
app.get("/api/galeria", async (req, res) => {
  const limit = 50;
  const cursor = req.query.cursor || undefined;

  try {
    const result = await cloudinary.search
      .expression("folder:galeria_iglesia")
      .max_results(limit)
      .next_cursor(cursor)
      .with_field("context")
      .execute();

    const fotos = result.resources.map((r) => ({
      url: r.secure_url,
      titulo: r.public_id.split("/").pop(),
      fecha_toma: r.context?.custom?.fecha_toma || "sin_fecha",
    }));

    res.json({
      fotos,
      nextCursor: result.next_cursor || null,
    });
  } catch (error) {
    console.error("❌ Error en /api/galeria:", error.message);
    res.status(500).json({ error: "Error al obtener galería de fotos" });
  }
});



//Obtener index
app.get("/api/galeria/index", async (req, res) => {
  const client = await pool.connect();
  try {
    const result = await client.query(
      "SELECT data FROM galeria_index ORDER BY created_at DESC LIMIT 1"
    );
    client.release();

    if (result.rows.length === 0) {
      return res.status(404).json({ error: "Índice no encontrado" });
    }

    res.json(result.rows[0].data);
  } catch (error) {
    console.error("❌ Error al obtener índice de galería:", error.message);
    client.release();
    res.status(500).json({ error: "Error al obtener índice" });
  }
});


app.post("/api/galeria/index", async (req, res) => {
  const client = await pool.connect();
  try {
    const paginas = [];
    const aniosSet = new Set();

    let next_cursor = null;
    let pagina = 0;
    const limite = 100;

    do {
      const result = await cloudinary.search
        .expression("folder:galeria_iglesia/*")
        .sort_by("public_id", "asc")
        .max_results(limite)
        .next_cursor(next_cursor)
        .execute();

      const aniosPagina = new Set();
      const cursor = pagina === 0 ? null : next_cursor;

      for (const r of result.resources) {
        const anio = r.context?.custom?.fecha_toma?.substring(0, 4);
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
      anios: [...aniosSet].sort((a, b) => b - a),
      paginas,
    };

    await client.query("INSERT INTO galeria_index (data) VALUES ($1)", [index]);
    client.release();

    res.json({ message: "Índice creado correctamente", index });
  } catch (error) {
    console.error("❌ Error al generar índice:", error);
    client.release();
    res.status(500).json({ error: "Error al generar índice de galería" });
  }
});



// --- Iniciar servidor ---
const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
  console.log(`Servidor corriendo en http://localhost:${PORT}`);
});

