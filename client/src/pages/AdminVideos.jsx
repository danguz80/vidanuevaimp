import React, { useEffect, useState } from "react";
import { useAuth } from "../context/AuthContext";
import AdminNav from "../components/AdminNav";
import {
  Video, Plus, Trash2, Save, Clock, Search, Check,
  AlertCircle, Loader2, Youtube, Calendar, ExternalLink,
} from "lucide-react";

const API = import.meta.env.VITE_BACKEND_URL;

export default function AdminVideos() {
  const { getToken } = useAuth();
  const [videos, setVideos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState({});
  const [guardandoId, setGuardandoId] = useState(null);
  const [borrandoId, setBorrandoId] = useState(null);
  const [agregando, setAgregando] = useState(false);
  const [nuevoVideo, setNuevoVideo] = useState({ videoId: "", title: "", thumbnail: "", start: "0:00:00" });

  // Convierte segundos a "H:MM:SS"
  const segsAHms = (s) => {
    const n = Number(s) || 0;
    const h = Math.floor(n / 3600);
    const m = Math.floor((n % 3600) / 60);
    const sec = n % 60;
    return `${h}:${String(m).padStart(2, "0")}:${String(sec).padStart(2, "0")}`;
  };

  // Convierte "H:MM:SS" o "MM:SS" o número a segundos
  const hmsASegs = (str) => {
    if (!str && str !== 0) return 0;
    const s = String(str).trim();
    if (!s.includes(":")) return Number(s) || 0;
    const parts = s.split(":").map(Number);
    if (parts.length === 3) return parts[0] * 3600 + parts[1] * 60 + parts[2];
    if (parts.length === 2) return parts[0] * 60 + parts[1];
    return 0;
  };
  const [feedback, setFeedback] = useState(null); // { tipo: "ok"|"error", texto }

  // Auto-búsqueda YouTube
  const [busquedaEstado, setBusquedaEstado] = useState(null);
  const [buscando, setBuscando] = useState(false);

  const hdrs = () => ({
    "Content-Type": "application/json",
    Authorization: `Bearer ${getToken()}`,
  });

  const mostrarFeedback = (tipo, texto) => {
    setFeedback({ tipo, texto });
    setTimeout(() => setFeedback(null), 5000);
  };

  const cargar = async () => {
    setLoading(true);
    try {
      const r = await fetch(`${API}/api/sermones`);
      setVideos(await r.json());
    } finally {
      setLoading(false);
    }
  };

  const cargarEstadoBusqueda = async () => {
    try {
      const r = await fetch(`${API}/api/sermones/buscar-youtube`, { headers: hdrs() });
      if (r.ok) setBusquedaEstado(await r.json());
    } catch {}
  };

  useEffect(() => {
    cargar();
    cargarEstadoBusqueda();
  }, []);

  /* ── Buscar en YouTube ahora ─────────────────────────────────────────── */
  const buscarAhora = async () => {
    setBuscando(true);
    try {
      const r = await fetch(`${API}/api/sermones/buscar-youtube`, {
        method: "POST",
        headers: hdrs(),
      });
      const data = await r.json();
      setBusquedaEstado(data);
      if (data.encontrado) {
        mostrarFeedback("ok", `Nuevo video agregado: "${data.titulo}"`);
        await cargar();
      } else if (data.error) {
        mostrarFeedback("error", `Error: ${data.error}`);
      } else {
        mostrarFeedback("ok", data.titulo || "No se encontraron videos nuevos.");
      }
    } catch {
      mostrarFeedback("error", "Error de red al buscar en YouTube.");
    } finally {
      setBuscando(false);
    }
  };

  /* ── CRUD ────────────────────────────────────────────────────────────── */
  const handleInputChange = (videoId, field, value) => {
    setEditing(prev => ({
      ...prev,
      [videoId]: {
        ...videos.find(v => v.videoId === videoId),
        ...prev[videoId],
        [field]: value,
      },
    }));
  };

  const handleSave = async (videoId) => {
    const changes = editing[videoId];
    if (!changes) return;
    setGuardandoId(videoId);
    try {
      const r = await fetch(`${API}/api/sermones/${videoId}`, {
        method: "PUT",
        headers: hdrs(),
        body: JSON.stringify({
          start: hmsASegs(changes.start),
          title: changes.title,
          thumbnail: changes.thumbnail,
          fecha_publicacion: changes.publishedAt,
          sunday_date: changes.sundayDate,
        }),
      });
      if (!r.ok) throw new Error();
      setEditing(p => { const n = { ...p }; delete n[videoId]; return n; });
      mostrarFeedback("ok", "Video actualizado");
      await cargar();
    } catch {
      mostrarFeedback("error", "Error al guardar cambios");
    } finally {
      setGuardandoId(null);
    }
  };

  const handleDelete = async (videoId) => {
    try {
      await fetch(`${API}/api/sermones/${videoId}`, { method: "DELETE", headers: hdrs() });
      setBorrandoId(null);
      mostrarFeedback("ok", "Video eliminado");
      await cargar();
    } catch {
      mostrarFeedback("error", "Error al eliminar el video");
    }
  };

  const handleAdd = async () => {
    if (!nuevoVideo.videoId.trim()) {
      mostrarFeedback("error", "El Video ID de YouTube es obligatorio");
      return;
    }
    setAgregando(true);
    try {
      const r = await fetch(`${API}/api/sermones`, {
        method: "POST",
        headers: hdrs(),
        body: JSON.stringify({
          videoId: nuevoVideo.videoId.trim(),
          title: nuevoVideo.title,
          thumbnail: nuevoVideo.thumbnail,
          start: hmsASegs(nuevoVideo.start),
          fecha_publicacion: new Date().toISOString(),
          sundayDate: new Date().toISOString().split("T")[0],
        }),
      });
      if (!r.ok) throw new Error();
      setNuevoVideo({ videoId: "", title: "", thumbnail: "", start: "0:00:00" });
      mostrarFeedback("ok", "Video agregado correctamente");
      await cargar();
    } catch {
      mostrarFeedback("error", "Error al agregar el video");
    } finally {
      setAgregando(false);
    }
  };

  /* ── Helpers ─────────────────────────────────────────────────────────── */
  const formatearFecha = (iso) => {
    if (!iso) return "—";
    // pg puede devolver la columna date como objeto Date o como string YYYY-MM-DD o YYYY-MM-DDTHH:mm:ssZ
    const str = (iso instanceof Date ? iso.toISOString() : String(iso)).split("T")[0];
    const [y, m, d] = str.split("-").map(Number);
    if (!y || !m || !d) return "—";
    return new Date(Date.UTC(y, m - 1, d)).toLocaleDateString("es-CL", {
      day: "numeric", month: "long", year: "numeric", timeZone: "UTC",
    });
  };

  // Calcula la próxima búsqueda automática en hora Santiago
  const proximaBusqueda = () => {
    try {
      const now = new Date();
      const stg = new Date(now.toLocaleString("en-US", { timeZone: "America/Santiago" }));
      const day = stg.getDay(); // 0=domingo, 1=lunes
      const h = stg.getHours();

      // Días hasta el próximo lunes (1)
      let daysToLunes = (8 - day) % 7; // 1=lunes → 0 días si hoy es lunes
      if (daysToLunes === 0 && h >= 12) daysToLunes = 7; // lunes pasadas 12 → próximo lunes
      const nextLunes = new Date(stg);
      nextLunes.setDate(stg.getDate() + daysToLunes);
      nextLunes.setHours(12, 0, 0, 0);

      return nextLunes.toLocaleDateString("es-CL", {
        weekday: "long", day: "numeric", month: "long",
        hour: "2-digit", minute: "2-digit", timeZone: "America/Santiago",
      });
    } catch {
      return "calculando...";
    }
  };

  /* ── Render ──────────────────────────────────────────────────────────── */
  return (
    <>
      <AdminNav />
      <div className="max-w-4xl mx-auto px-4 py-8 space-y-6">

        {/* Encabezado */}
        <h1 className="text-xl font-bold text-gray-800 flex items-center gap-2">
          <Video size={20} className="text-green-500" /> Sermones
        </h1>

        {/* Feedback */}
        {feedback && (
          <div className={`flex items-center gap-3 rounded-xl px-4 py-3 text-sm font-medium ${
            feedback.tipo === "ok"
              ? "bg-green-50 text-green-700 border border-green-200"
              : "bg-red-50 text-red-700 border border-red-200"
          }`}>
            {feedback.tipo === "ok" ? <Check size={16} /> : <AlertCircle size={16} />}
            {feedback.texto}
          </div>
        )}

        {/* ── Panel búsqueda automática ───────────────────────────────────── */}
        <div className="bg-white rounded-2xl border border-gray-200 p-5 space-y-4">
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <div className="flex items-center gap-2">
              <Youtube size={18} className="text-red-500" />
              <h2 className="font-semibold text-gray-800">Búsqueda automática en YouTube</h2>
            </div>
            <button
              onClick={buscarAhora}
              disabled={buscando}
              className="flex items-center gap-2 bg-red-600 hover:bg-red-700 disabled:opacity-50 text-white px-4 py-2 rounded-xl text-sm font-semibold transition"
            >
              {buscando ? <Loader2 size={15} className="animate-spin" /> : <Search size={15} />}
              {buscando ? "Buscando..." : "Buscar ahora"}
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {/* Horarios */}
            <div className="bg-gray-50 rounded-xl p-4 flex items-start gap-3">
              <Clock size={16} className="text-gray-400 mt-0.5 flex-shrink-0" />
              <div>
                <p className="text-xs font-semibold text-gray-500 mb-1">Búsquedas programadas</p>
                <p className="text-sm text-gray-700">Lunes 12:00</p>
                <p className="text-xs text-gray-400 mt-1">
                  Próxima: {proximaBusqueda()}
                </p>
              </div>
            </div>

            {/* Última búsqueda */}
            <div className="bg-gray-50 rounded-xl p-4 flex items-start gap-3">
              <Calendar size={16} className="text-gray-400 mt-0.5 flex-shrink-0" />
              <div className="min-w-0">
                <p className="text-xs font-semibold text-gray-500 mb-1">Última búsqueda</p>
                {busquedaEstado?.fecha ? (
                  <>
                    <p className="text-sm text-gray-700">
                      {new Date(busquedaEstado.fecha).toLocaleString("es-CL", {
                        timeZone: "America/Santiago",
                        day: "2-digit", month: "short", year: "numeric",
                        hour: "2-digit", minute: "2-digit",
                      })}
                    </p>
                    {busquedaEstado.encontrado && (
                      <p className="text-xs text-green-600 font-medium mt-0.5 truncate">
                        ✓ {busquedaEstado.titulo}
                      </p>
                    )}
                    {!busquedaEstado.encontrado && busquedaEstado.error && (
                      <p className="text-xs text-red-500 mt-0.5">{busquedaEstado.error}</p>
                    )}
                    {!busquedaEstado.encontrado && !busquedaEstado.error && (
                      <p className="text-xs text-gray-400 mt-0.5">{busquedaEstado.titulo}</p>
                    )}
                  </>
                ) : (
                  <p className="text-sm text-gray-400">Aún no se ha ejecutado</p>
                )}
              </div>
            </div>
          </div>

          <p className="text-xs text-gray-400 leading-relaxed">
            El sistema busca transmisiones en vivo completadas en los últimos 7 días.
            Cuando encuentra un video nuevo lo agrega y elimina el más antiguo para mantener siempre 3 sermones.
            Usa <strong>"Buscar ahora"</strong> para eventos especiales en cualquier momento.
          </p>
        </div>

        {/* ── Sermones actuales ───────────────────────────────────────────── */}
        <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden">
          <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
            <h2 className="font-semibold text-gray-800">Sermones actuales</h2>
            <span className="text-xs text-gray-400">{videos.length} de 3</span>
          </div>

          {loading ? (
            <div className="flex items-center justify-center gap-2 py-12 text-gray-400">
              <Loader2 size={20} className="animate-spin" /> Cargando...
            </div>
          ) : !videos.length ? (
            <div className="py-12 text-center text-sm text-gray-400">
              No hay sermones registrados
            </div>
          ) : (
            <div className="divide-y divide-gray-100">
              {videos.map(video => {
                const edit = editing[video.videoId] || {};
                return (
                  <div key={video.videoId} className="p-5 space-y-3">
                    {/* Cabecera del video */}
                    <div className="flex items-start gap-3">
                      {(edit.thumbnail ?? video.thumbnail) ? (
                        <img
                          src={edit.thumbnail ?? video.thumbnail}
                          alt=""
                          className="w-28 h-16 rounded-lg object-cover flex-shrink-0 bg-gray-100"
                        />
                      ) : (
                        <div className="w-28 h-16 rounded-lg bg-gray-100 flex items-center justify-center flex-shrink-0">
                          <Video size={20} className="text-gray-300" />
                        </div>
                      )}
                      <div className="flex-1 min-w-0">
                        <p className="text-xs text-gray-400">{formatearFecha(video.sundayDate)}</p>
                        <p className="text-sm font-medium text-gray-700 truncate">
                          {(edit.title ?? video.title) || "Sin título"}
                        </p>
                        <a
                          href={`https://youtube.com/watch?v=${video.videoId}`}
                          target="_blank"
                          rel="noreferrer"
                          className="inline-flex items-center gap-1 text-xs text-violet-600 hover:underline"
                        >
                          {video.videoId} <ExternalLink size={11} />
                        </a>
                      </div>
                      <div className="flex gap-2 flex-shrink-0">
                        {editing[video.videoId] && (
                          <button
                            onClick={() => handleSave(video.videoId)}
                            disabled={guardandoId === video.videoId}
                            className="flex items-center gap-1.5 px-3 py-1.5 bg-green-600 hover:bg-green-700 disabled:opacity-50 text-white text-xs font-semibold rounded-lg transition"
                          >
                            {guardandoId === video.videoId
                              ? <Loader2 size={12} className="animate-spin" />
                              : <Save size={12} />}
                            Guardar
                          </button>
                        )}
                        <button
                          onClick={() => setBorrandoId(video.videoId)}
                          className="p-1.5 rounded-lg text-gray-400 hover:text-red-500 hover:bg-red-50 transition"
                          title="Eliminar"
                        >
                          <Trash2 size={15} />
                        </button>
                      </div>
                    </div>

                    {/* Campos editables */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      <div>
                        <label className="text-xs text-gray-400 mb-1 block">Título</label>
                        <input
                          type="text"
                          value={edit.title ?? video.title ?? ""}
                          onChange={e => handleInputChange(video.videoId, "title", e.target.value)}
                          className="w-full border border-gray-200 rounded-xl px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-violet-300"
                        />
                      </div>
                      <div>
                        <label className="text-xs text-gray-400 mb-1 block">URL miniatura</label>
                        <input
                          type="text"
                          value={edit.thumbnail ?? video.thumbnail ?? ""}
                          onChange={e => handleInputChange(video.videoId, "thumbnail", e.target.value)}
                          className="w-full border border-gray-200 rounded-xl px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-violet-300"
                        />
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <label className="text-xs text-gray-400">Inicio (h:mm:ss):</label>
                      <input
                        type="text"
                        value={edit.start !== undefined ? edit.start : segsAHms(video.start)}
                        onChange={e => handleInputChange(video.videoId, "start", e.target.value)}
                        placeholder="0:00:00"
                        className="w-24 border border-gray-200 rounded-xl px-3 py-1.5 text-sm text-center focus:outline-none focus:ring-2 focus:ring-violet-300"
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* ── Agregar manualmente ─────────────────────────────────────────── */}
        <div className="bg-white rounded-2xl border border-gray-200 p-5 space-y-4">
          <h2 className="font-semibold text-gray-800 flex items-center gap-2">
            <Plus size={16} className="text-green-500" /> Agregar video manualmente
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-gray-500 mb-1 block">Video ID de YouTube *</label>
              <input
                type="text"
                value={nuevoVideo.videoId}
                onChange={e => setNuevoVideo(v => ({ ...v, videoId: e.target.value }))}
                placeholder="ej: dQw4w9WgXcQ"
                className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-violet-300"
              />
            </div>
            <div>
              <label className="text-xs text-gray-500 mb-1 block">Título</label>
              <input
                type="text"
                value={nuevoVideo.title}
                onChange={e => setNuevoVideo(v => ({ ...v, title: e.target.value }))}
                placeholder="Título del sermón"
                className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-violet-300"
              />
            </div>
            <div>
              <label className="text-xs text-gray-500 mb-1 block">URL miniatura</label>
              <input
                type="text"
                value={nuevoVideo.thumbnail}
                onChange={e => setNuevoVideo(v => ({ ...v, thumbnail: e.target.value }))}
                placeholder="https://..."
                className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-violet-300"
              />
            </div>
            <div>
              <label className="text-xs text-gray-500 mb-1 block">Inicio (h:mm:ss)</label>
              <input
                type="text"
                value={nuevoVideo.start}
                onChange={e => setNuevoVideo(v => ({ ...v, start: e.target.value }))}
                placeholder="0:00:00"
                className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-violet-300"
              />
            </div>
          </div>
          <button
            onClick={handleAdd}
            disabled={agregando}
            className="flex items-center gap-2 bg-green-600 hover:bg-green-700 disabled:opacity-50 text-white px-5 py-2 rounded-xl text-sm font-semibold transition"
          >
            {agregando ? <Loader2 size={15} className="animate-spin" /> : <Plus size={15} />}
            {agregando ? "Agregando..." : "Agregar video"}
          </button>
        </div>

      </div>

      {/* Confirmar borrado */}
      {borrandoId && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-xl p-6 max-w-sm w-full space-y-4">
            <h3 className="font-bold text-gray-800">¿Eliminar sermón?</h3>
            <p className="text-sm text-gray-500">Esta acción no se puede deshacer.</p>
            <div className="flex gap-3 justify-end">
              <button
                onClick={() => setBorrandoId(null)}
                className="px-4 py-2 text-sm text-gray-600 hover:bg-gray-100 rounded-xl transition"
              >
                Cancelar
              </button>
              <button
                onClick={() => handleDelete(borrandoId)}
                className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white text-sm font-semibold rounded-xl transition"
              >
                Eliminar
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
