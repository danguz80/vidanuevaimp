import express from "express";
import cors from "cors";
import axios from "axios";
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
  user: process.env.PGUSER || "danielguzmansagredo",
  host: "localhost",
  database: process.env.PGDATABASE || "iglesia",
  password: process.env.PGPASSWORD || "",
  port: parseInt(process.env.PGPORT) || 5433,
});

// --- API obtener últimos sermones ---
app.get("/api/sermones", async (req, res) => {
  try {
    const apiKey = process.env.YOUTUBE_API_KEY;
    const channelId = "UC_WG17ojWZJfyxGtMI45Cjw";

    const response = await axios.get("https://www.googleapis.com/youtube/v3/search", {
      params: {
        part: "snippet",
        channelId,
        maxResults: 50,
        order: "date",
        type: "video",
        key: apiKey,
      },
    });

    const sundayVideos = response.data.items
      .filter((item) => {
        const title = item.snippet.title.toLowerCase();
        return title.includes("domingo") || title.includes("culto dominical");
      })
      .slice(0, 10)
      .map((item) => {
        const publishedAt = new Date(item.snippet.publishedAt);

        // Ajuste horario Chile (UTC-4)
        publishedAt.setHours(publishedAt.getHours() - 4);

        const dayOfWeek = publishedAt.getDay(); // 0 = domingo
        const sundayBefore = new Date(publishedAt);
        sundayBefore.setDate(publishedAt.getDate() - dayOfWeek);

        return {
          title: item.snippet.title,
          videoId: item.id.videoId,
          publishedAt: publishedAt.toISOString(),
          sundayDate: sundayBefore.toISOString().split("T")[0],
          thumbnail: item.snippet.thumbnails?.high?.url || "",
        };
      });

    const client = await pool.connect();
    const result = await client.query(
      "SELECT video_id, start_time, titulo, fecha_publicacion, sunday_date, thumbnail FROM sermones"
    );
    client.release();

    const startTimeMap = {};
    result.rows.forEach(({ video_id, start_time, titulo, fecha_publicacion, sunday_date, thumbnail }) => {
      startTimeMap[video_id] = { start_time, titulo, fecha_publicacion, sunday_date, thumbnail };
    });

    const finalVideos = sundayVideos
      .sort((a, b) => new Date(b.sundayDate) - new Date(a.sundayDate))
      .slice(0, 3)
      .map((video) => ({
        title: startTimeMap[video.videoId]?.titulo || video.title,
        videoId: video.videoId,
        publishedAt: startTimeMap[video.videoId]?.fecha_publicacion || video.publishedAt,
        sundayDate: startTimeMap[video.videoId]?.sunday_date || video.sundayDate,
        thumbnail: startTimeMap[video.videoId]?.thumbnail || video.thumbnail,
        start: startTimeMap[video.videoId]?.start_time || 0,
      }));

    res.json(finalVideos);
  } catch (error) {
    console.error("Error al obtener los videos:", error.message);
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
