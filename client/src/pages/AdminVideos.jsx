import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";

const backendUrl = import.meta.env.VITE_BACKEND_URL;

export default function AdminVideos() {
  const [videos, setVideos] = useState([]);
  const [editing, setEditing] = useState({});
  const [nuevoVideo, setNuevoVideo] = useState({
    videoId: "",
    title: "",
    thumbnail: "",
    start: 0,
  });
  const navigate = useNavigate();

  useEffect(() => {
    fetchVideos();
  }, []);

  const fetchVideos = async () => {
    try {
      const res = await fetch(`${backendUrl}/api/sermones`);
      const data = await res.json();
      setVideos(data);
    } catch (error) {
      console.error("Error al cargar videos:", error);
    }
  };

  const handleInputChange = (videoId, field, value) => {
    setEditing((prev) => ({
      ...prev,
      [videoId]: {
        ...videos.find((v) => v.videoId === videoId),
        ...prev[videoId],
        [field]: value,
      },
    }));
  };

  const handleSave = async (videoId) => {
    const changes = editing[videoId];
    if (!changes) return;

    try {
      await fetch(`${backendUrl}/api/sermones/${videoId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          start: Number(changes.start),
          title: changes.title,
          fecha_publicacion: changes.publishedAt,
          sunday_date: changes.sundayDate,
          thumbnail: changes.thumbnail,
        }),
      });

      fetchVideos();
      setEditing((prev) => {
        const updated = { ...prev };
        delete updated[videoId];
        return updated;
      });
      alert("Video actualizado correctamente");
    } catch (error) {
      console.error("Error al guardar cambios:", error);
    }
  };

  const handleDelete = async (videoId) => {
    if (!confirm("¿Seguro que deseas eliminar este video?")) return;

    try {
      await fetch(`${backendUrl}/api/sermones/${videoId}`, {
        method: "DELETE",
      });

      fetchVideos();
      alert("Video eliminado correctamente");
    } catch (error) {
      console.error("Error al eliminar video:", error);
    }
  };

  const handleAddVideo = async () => {
    if (!nuevoVideo.videoId.trim()) {
      alert("Debes ingresar un videoId válido");
      return;
    }

    try {
      await fetch(`${backendUrl}/api/sermones`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          videoId: nuevoVideo.videoId,
          title: nuevoVideo.title,
          thumbnail: nuevoVideo.thumbnail,
          start: Number(nuevoVideo.start),
          fecha_publicacion: new Date().toISOString(),
          sunday_date: new Date().toISOString().split("T")[0],
        }),
      });

      setNuevoVideo({ videoId: "", title: "", thumbnail: "", start: 0 });
      fetchVideos();
      alert("Video agregado correctamente");
    } catch (err) {
      console.error("Error al agregar video:", err);
      alert("Ocurrió un error al agregar el video");
    }
  };

  const formatearFecha = (isoDate) => {
    if (!isoDate) return "";
    const [year, month, day] = isoDate.split("-").map(Number);
    const date = new Date(Date.UTC(year, month - 1, day));
    return date.toLocaleDateString("es-CL", {
      weekday: "long",
      year: "numeric",
      month: "long",
      day: "numeric",
      timeZone: "UTC",
    });
  };

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <h1 className="text-2xl font-bold text-center mb-6">
        Administrar Videos de Sermones
      </h1>

      <div className="flex justify-center mb-6">
        <button
          onClick={() => navigate("/admin")}
          className="bg-gray-700 text-white px-6 py-2 rounded hover:bg-gray-800 transition"
        >
          Volver al Panel de Administración
        </button>
      </div>

      <div className="mb-10 max-w-xl mx-auto">
        <h3 className="text-lg font-semibold mb-2 text-center">
          Agregar nuevo video manualmente
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
          <input
            type="text"
            placeholder="Video ID (YouTube)"
            className="border p-2 rounded"
            value={nuevoVideo.videoId}
            onChange={(e) =>
              setNuevoVideo({ ...nuevoVideo, videoId: e.target.value })
            }
          />
          <input
            type="text"
            placeholder="Título"
            className="border p-2 rounded"
            value={nuevoVideo.title}
            onChange={(e) =>
              setNuevoVideo({ ...nuevoVideo, title: e.target.value })
            }
          />
          <input
            type="text"
            placeholder="Thumbnail (URL)"
            className="border p-2 rounded"
            value={nuevoVideo.thumbnail}
            onChange={(e) =>
              setNuevoVideo({ ...nuevoVideo, thumbnail: e.target.value })
            }
          />
          <input
            type="number"
            placeholder="Inicio (segundos)"
            className="border p-2 rounded"
            value={nuevoVideo.start}
            onChange={(e) =>
              setNuevoVideo({ ...nuevoVideo, start: e.target.value })
            }
          />
        </div>
        <div className="mt-4 text-center">
          <button
            className="bg-green-600 text-white px-6 py-2 rounded hover:bg-green-700"
            onClick={handleAddVideo}
          >
            Agregar Video
          </button>
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full table-auto border-collapse text-sm text-left">
          <thead className="bg-gray-200">
            <tr>
              <th className="px-4 py-2">Fecha</th>
              <th className="px-4 py-2">Título</th>
              <th className="px-4 py-2">Miniatura</th>
              <th className="px-4 py-2 text-center">Inicio (seg)</th>
              <th className="px-4 py-2 text-center">Guardar</th>
              <th className="px-4 py-2 text-center">Eliminar</th>
            </tr>
          </thead>
          <tbody>
            {videos.map((video) => {
              const edit = editing[video.videoId] || {};
              return (
                <tr key={video.videoId} className="border-t text-center">
                  <td className="px-4 py-2 whitespace-nowrap">
                    {formatearFecha(video.sundayDate)}
                  </td>
                  <td className="px-4 py-2">
                    <input
                      type="text"
                      className="border p-1 w-full"
                      value={edit.title ?? video.title}
                      onChange={(e) =>
                        handleInputChange(video.videoId, "title", e.target.value)
                      }
                    />
                  </td>
                  <td className="px-4 py-2">
                    <input
                      type="text"
                      className="border p-1 w-full"
                      value={edit.thumbnail ?? video.thumbnail ?? ""}
                      onChange={(e) =>
                        handleInputChange(video.videoId, "thumbnail", e.target.value)
                      }
                    />
                  </td>
                  <td className="px-4 py-2">
                    <input
                      type="number"
                      className="border p-1 w-20 text-center"
                      value={edit.start ?? video.start ?? 0}
                      onChange={(e) =>
                        handleInputChange(video.videoId, "start", e.target.value)
                      }
                    />
                  </td>
                  <td className="px-4 py-2">
                    <button
                      onClick={() => handleSave(video.videoId)}
                      className="bg-blue-600 text-white px-3 py-1 rounded hover:bg-blue-700"
                    >
                      Guardar
                    </button>
                  </td>
                  <td className="px-4 py-2">
                    <button
                      onClick={() => handleDelete(video.videoId)}
                      className="bg-red-600 text-white px-3 py-1 rounded hover:bg-red-700"
                    >
                      Eliminar
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
