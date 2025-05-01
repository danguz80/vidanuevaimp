import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";

const backendUrl = import.meta.env.VITE_BACKEND_URL;

export default function AdminVideos() {
  const [videos, setVideos] = useState([]);
  const [editing, setEditing] = useState({});
  const navigate = useNavigate();

  useEffect(() => {
    const fetchVideos = async () => {
      try {
        const res = await fetch(`${backendUrl}/api/sermones`);
        const data = await res.json();
        setVideos(data);
      } catch (error) {
        console.error("Error al cargar videos:", error);
      }
    };

    fetchVideos();
  }, []);

  const handleInputChange = (videoId, field, value) => {
    setEditing((prev) => ({
      ...prev,
      [videoId]: {
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

      setVideos((prev) =>
        prev.map((video) =>
          video.videoId === videoId
            ? { ...video, ...changes }
            : video
        )
      );
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

      setVideos((prev) => prev.filter((video) => video.videoId !== videoId));
      alert("Video eliminado correctamente");
    } catch (error) {
      console.error("Error al eliminar video:", error);
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
      <h1 className="text-2xl font-bold text-center mb-6">Administrar Videos de Sermones</h1>

      <div className="flex justify-center mb-6">
        <button
          onClick={() => navigate("/admin")}
          className="bg-gray-700 text-white px-6 py-2 rounded hover:bg-gray-800 transition"
        >
          Volver al Panel de Administración
        </button>
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
                  <td className="px-4 py-2 whitespace-nowrap">{formatearFecha(video.sundayDate)}</td>
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
