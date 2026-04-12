import { useState, useEffect } from "react";
import axios from "axios";
import AdminNav from "../components/AdminNav";

const API = "https://iglesia-backend.onrender.com";

export default function AdminGaleria() {
  const token = localStorage.getItem("token");
  const headers = { Authorization: `Bearer ${token}` };

  const [albums, setAlbums] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [refreshingId, setRefreshingId] = useState(null);

  const [nombre, setNombre] = useState("");
  const [url, setUrl] = useState("");
  const [saving, setSaving] = useState(false);

  const fetchAlbums = async () => {
    setLoading(true);
    try {
      const { data } = await axios.get(`${API}/api/admin/galeria/albums`, { headers });
      setAlbums(data);
    } catch (err) {
      setError("No se pudieron cargar los álbumes.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchAlbums(); }, []); // eslint-disable-line

  const handleAdd = async (e) => {
    e.preventDefault();
    setError(""); setSuccess("");
    setSaving(true);
    try {
      await axios.post(`${API}/api/admin/galeria/albums`, { nombre, url }, { headers });
      setSuccess("Álbum agregado correctamente.");
      setNombre(""); setUrl("");
      fetchAlbums();
    } catch (err) {
      setError(err.response?.data?.error || "Error al agregar álbum.");
    } finally {
      setSaving(false);
    }
  };

  const toggleActivo = async (album) => {
    try {
      await axios.put(`${API}/api/admin/galeria/albums/${album.id}`, { activo: !album.activo }, { headers });
      fetchAlbums();
    } catch (err) {
      setError("Error al actualizar el álbum.");
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm("¿Eliminar este álbum de la galería?")) return;
    try {
      await axios.delete(`${API}/api/admin/galeria/albums/${id}`, { headers });
      setSuccess("Álbum eliminado.");
      fetchAlbums();
    } catch (err) {
      setError("Error al eliminar el álbum.");
    }
  };

  const handleRefreshThumbnail = async (id) => {
    setRefreshingId(id);
    setError(""); setSuccess("");
    try {
      await axios.post(`${API}/api/admin/galeria/albums/${id}/refresh-thumbnail`, {}, { headers });
      setSuccess("Miniatura actualizada.");
      fetchAlbums();
    } catch (err) {
      setError(err.response?.data?.error || "No se pudo obtener la miniatura automáticamente.");
    } finally {
      setRefreshingId(null);
    }
  };

  return (
    <>
      <AdminNav />
      <div className="max-w-3xl mx-auto p-6">
        <h1 className="text-2xl font-bold mb-2">Galería — Álbumes</h1>
        <p className="text-gray-500 text-sm mb-6">
          Agrega los álbumes de Google Photos que quieres mostrar. Los visitantes hacen clic y se abre el álbum directamente en Google Photos.
        </p>

        <div className="bg-blue-50 border border-blue-200 rounded p-4 mb-6 text-sm text-blue-800">
          <strong>¿Cómo obtener el enlace del álbum?</strong>
          <ol className="list-decimal ml-4 mt-1 space-y-1">
            <li>Abre el álbum en <a href="https://photos.google.com" target="_blank" rel="noopener noreferrer" className="underline">Google Photos</a></li>
            <li>Clic en el ícono de compartir → <strong>"Crear enlace compartido"</strong></li>
            <li>Copia el enlace y pégalo aquí abajo</li>
          </ol>
        </div>

        <form onSubmit={handleAdd} className="bg-white shadow rounded p-4 mb-6 space-y-3">
          <h2 className="font-semibold text-lg">Agregar álbum</h2>
          <div>
            <label className="block text-sm font-medium text-gray-700">Nombre del álbum</label>
            <input
              type="text"
              value={nombre}
              onChange={(e) => setNombre(e.target.value)}
              placeholder="Ej: Navidad 2024"
              required
              className="mt-1 w-full border rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700">Enlace del álbum</label>
            <input
              type="url"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="https://photos.google.com/share/..."
              required
              className="mt-1 w-full border rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
            />
          </div>
          {error && <p className="text-red-600 text-sm">{error}</p>}
          {success && <p className="text-green-600 text-sm">{success}</p>}
          <button
            type="submit"
            disabled={saving}
            className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded text-sm disabled:opacity-50"
          >
            {saving ? "Guardando…" : "Agregar álbum"}
          </button>
        </form>

        <div className="bg-white shadow rounded p-4">
          <h2 className="font-semibold text-lg mb-3">Álbumes configurados</h2>
          {loading ? (
            <p className="text-gray-400 text-sm">Cargando…</p>
          ) : albums.length === 0 ? (
            <p className="text-gray-400 text-sm">No hay álbumes configurados todavía.</p>
          ) : (
            <ul className="divide-y">
              {albums.map((a) => (
                <li key={a.id} className="py-3 flex flex-wrap items-start justify-between gap-3">
                  <div className="flex gap-3 items-start">
                    {a.thumbnail ? (
                      <img src={a.thumbnail} alt={a.nombre} className="w-16 h-16 object-cover rounded shadow-sm flex-shrink-0" />
                    ) : (
                      <div className="w-16 h-16 bg-gradient-to-br from-blue-400 to-indigo-500 rounded flex items-center justify-center flex-shrink-0">
                        <svg className="w-7 h-7 text-white opacity-70" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                        </svg>
                      </div>
                    )}
                    <div>
                      <p className="font-medium">{a.nombre}</p>
                      <a href={a.url} target="_blank" rel="noopener noreferrer" className="text-xs text-blue-500 hover:underline truncate max-w-xs block">{a.url}</a>
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <button
                      onClick={() => handleRefreshThumbnail(a.id)}
                      disabled={refreshingId === a.id}
                      className="text-xs px-3 py-1 rounded bg-yellow-100 text-yellow-700 hover:bg-yellow-200 disabled:opacity-50"
                      title="Obtener portada automáticamente desde Google Photos"
                    >
                      {refreshingId === a.id ? "Cargando…" : "🖼️ Portada"}
                    </button>
                    <button
                      onClick={() => toggleActivo(a)}
                      className={`text-xs px-3 py-1 rounded ${a.activo ? "bg-green-100 text-green-700 hover:bg-green-200" : "bg-gray-100 text-gray-500 hover:bg-gray-200"}`}
                    >
                      {a.activo ? "Visible" : "Oculto"}
                    </button>
                    <button
                      onClick={() => handleDelete(a.id)}
                      className="text-xs px-3 py-1 rounded bg-red-100 text-red-700 hover:bg-red-200"
                    >
                      Eliminar
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </>
  );
}
