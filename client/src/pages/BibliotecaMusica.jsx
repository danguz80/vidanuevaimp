import React, { useEffect, useState, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { useMemberAuth } from "../context/MemberAuthContext";
import {
  ArrowLeft, Music, ListMusic, Play, Pause, SkipBack, SkipForward,
  Volume2, Plus, Trash2, FolderOpen, Loader2, ListPlus, X, ChevronRight,
} from "lucide-react";

const API_URL = import.meta.env.VITE_BACKEND_URL || "https://iglesia-backend.onrender.com";

function fmt(seg) {
  if (!seg || isNaN(seg)) return "0:00";
  const m = Math.floor(seg / 60);
  const s = Math.floor(seg % 60);
  return `${m}:${s.toString().padStart(2, "0")}`;
}

function sinExtension(nombre) {
  return (nombre || "").replace(/\.[^.]+$/, "");
}

export default function BibliotecaMusica() {
  const navigate = useNavigate();
  const { miembro, getToken } = useMemberAuth();

  // ── Navegación tabs ──
  const [tab, setTab] = useState("biblioteca");

  // ── Datos ──
  const [carpetas, setCarpetas] = useState([]);
  const [carpetaActiva, setCarpetaActiva] = useState(null);
  const [canciones, setCanciones] = useState([]);
  const [playlists, setPlaylists] = useState([]);
  const [playlistActiva, setPlaylistActiva] = useState(null);
  const [cancionesPlaylist, setCancionesPlaylist] = useState([]);

  // ── Loading / error ──
  const [loadingCarpetas, setLoadingCarpetas] = useState(true);
  const [loadingCanciones, setLoadingCanciones] = useState(false);
  const [loadingStream, setLoadingStream] = useState(false);
  const [errorConexion, setErrorConexion] = useState(null);

  // ── Player ──
  const audioRef = useRef(null);
  if (!audioRef.current) audioRef.current = new Audio();
  const colaRef = useRef([]);
  const idxRef = useRef(0);
  const [cancionActual, setCancionActual] = useState(null); // { fileId, titulo, artista }
  const [reproduciendo, setReproduciendo] = useState(false);
  const [progreso, setProgreso] = useState(0);
  const [duracion, setDuracion] = useState(0);
  const [volumen, setVolumen] = useState(1);

  // ── Playlist UI ──
  const [mostrarNuevaPlaylist, setMostrarNuevaPlaylist] = useState(false);
  const [nombreNuevaPlaylist, setNombreNuevaPlaylist] = useState("");
  const [agregandoA, setAgregandoA] = useState(null); // cancion que se quiere agregar
  const [addingPl, setAddingPl] = useState(null);    // id playlist en proceso

  const hdrs = () => ({ Authorization: `Bearer ${getToken()}` });

  // ── Audio events ──
  useEffect(() => {
    if (!miembro) { navigate("/portal/login"); return; }
    const audio = audioRef.current;

    const onTime   = () => setProgreso(audio.currentTime);
    const onDur    = () => setDuracion(isFinite(audio.duration) ? audio.duration : 0);
    const onPlay   = () => setReproduciendo(true);
    const onPause  = () => setReproduciendo(false);
    const onEnded  = () => {
      const cola = colaRef.current;
      const idx  = idxRef.current;
      if (!cola.length) return;
      const next = (idx + 1) % cola.length;
      reproducirItem(cola[next], cola, next);
    };

    audio.addEventListener("timeupdate",     onTime);
    audio.addEventListener("durationchange", onDur);
    audio.addEventListener("play",           onPlay);
    audio.addEventListener("pause",          onPause);
    audio.addEventListener("ended",          onEnded);
    return () => {
      audio.removeEventListener("timeupdate",     onTime);
      audio.removeEventListener("durationchange", onDur);
      audio.removeEventListener("play",           onPlay);
      audio.removeEventListener("pause",          onPause);
      audio.removeEventListener("ended",          onEnded);
      audio.pause();
    };
  }, []);

  useEffect(() => {
    if (!miembro) return;
    cargarCarpetas();
    cargarPlaylists();
  }, [miembro]);

  // ── Carga de datos ──
  const cargarCarpetas = async () => {
    setLoadingCarpetas(true);
    setErrorConexion(null);
    try {
      const r = await fetch(`${API_URL}/api/musica/carpetas`, { headers: hdrs() });
      const data = await r.json();
      if (data.error) { setErrorConexion(data.error); return; }
      setCarpetas(data);
      if (data.length > 0) cargarCanciones(data[0]);
    } catch { setErrorConexion("Error de conexión con el servidor"); }
    finally   { setLoadingCarpetas(false); }
  };

  const cargarCanciones = async (carpeta) => {
    setCarpetaActiva(carpeta);
    setLoadingCanciones(true);
    try {
      const r = await fetch(`${API_URL}/api/musica/canciones/${carpeta.id}`, { headers: hdrs() });
      const data = await r.json();
      setCanciones(Array.isArray(data) ? data : []);
    } catch { setCanciones([]); }
    finally   { setLoadingCanciones(false); }
  };

  const cargarPlaylists = async () => {
    try {
      const r = await fetch(`${API_URL}/api/musica/playlists`, { headers: hdrs() });
      const data = await r.json();
      setPlaylists(Array.isArray(data) ? data : []);
    } catch {}
  };

  const cargarCancionesPlaylist = async (pl) => {
    setPlaylistActiva(pl);
    try {
      const r = await fetch(`${API_URL}/api/musica/playlists/${pl.id}/canciones`, { headers: hdrs() });
      const data = await r.json();
      setCancionesPlaylist(Array.isArray(data) ? data : []);
    } catch { setCancionesPlaylist([]); }
  };

  // ── Playlists CRUD ──
  const crearPlaylist = async () => {
    if (!nombreNuevaPlaylist.trim()) return;
    try {
      const r = await fetch(`${API_URL}/api/musica/playlists`, {
        method: "POST",
        headers: { ...hdrs(), "Content-Type": "application/json" },
        body: JSON.stringify({ nombre: nombreNuevaPlaylist }),
      });
      const data = await r.json();
      if (data.id) {
        setPlaylists(prev => [data, ...prev]);
        setNombreNuevaPlaylist("");
        setMostrarNuevaPlaylist(false);
      }
    } catch {}
  };

  const eliminarPlaylist = async (id) => {
    try {
      await fetch(`${API_URL}/api/musica/playlists/${id}`, { method: "DELETE", headers: hdrs() });
      setPlaylists(prev => prev.filter(p => p.id !== id));
      if (playlistActiva?.id === id) { setPlaylistActiva(null); setCancionesPlaylist([]); }
    } catch {}
  };

  const agregarAPlaylist = async (playlistId, cancion) => {
    setAddingPl(playlistId);
    try {
      const titulo = cancion.audio?.title || sinExtension(cancion.name || "");
      await fetch(`${API_URL}/api/musica/playlists/${playlistId}/canciones`, {
        method: "POST",
        headers: { ...hdrs(), "Content-Type": "application/json" },
        body: JSON.stringify({ file_id: cancion.id, titulo, duracion_ms: cancion.audio?.duration }),
      });
      cargarPlaylists();
      if (playlistActiva?.id === playlistId) cargarCancionesPlaylist(playlistActiva);
    } catch {}
    finally { setAddingPl(null); setAgregandoA(null); }
  };

  const quitarDePlaylist = async (plId, cancionId) => {
    try {
      await fetch(`${API_URL}/api/musica/playlists/${plId}/canciones/${cancionId}`, {
        method: "DELETE", headers: hdrs(),
      });
      setCancionesPlaylist(prev => prev.filter(c => c.id !== cancionId));
      cargarPlaylists();
    } catch {}
  };

  // ── Player ──
  const reproducirItem = async (item, cola, idx) => {
    const fileId = item.fileId || item.id;
    setLoadingStream(true);
    try {
      const r = await fetch(`${API_URL}/api/musica/stream/${fileId}`, { headers: hdrs() });
      const { url, audio: meta } = await r.json();
      const audio = audioRef.current;
      audio.src = url;
      audio.volume = volumen;
      await audio.play();
      colaRef.current = cola;
      idxRef.current  = idx;
      setCancionActual({
        fileId,
        titulo:  meta?.title  || item.titulo || sinExtension(item.name || ""),
        artista: meta?.artist || item.artista || null,
      });
    } catch (e) { console.error("Error al reproducir:", e); }
    finally   { setLoadingStream(false); }
  };

  // Wrapper para canciones de biblioteca (OneDrive items)
  const reproducirCancion = (cancion, cola, idx) => {
    reproducirItem({ fileId: cancion.id, name: cancion.name, audio: cancion.audio }, cola, idx);
  };

  // Wrapper para canciones de playlist (DB rows)
  const reproducirDePlaylist = (c, lista, idx) => {
    reproducirItem({ fileId: c.file_id, titulo: c.titulo }, lista, idx);
  };

  const togglePlay = () => {
    const audio = audioRef.current;
    reproduciendo ? audio.pause() : audio.play();
  };

  const irA = (delta) => {
    const cola = colaRef.current;
    const idx  = idxRef.current;
    if (!cola.length) return;
    const next = (idx + delta + cola.length) % cola.length;
    reproducirItem(cola[next], cola, next);
  };

  const seekTo = (e) => {
    const val = parseFloat(e.target.value);
    audioRef.current.currentTime = val;
    setProgreso(val);
  };

  if (!miembro) return null;

  // Cola para biblioteca: mapear a { fileId, name, audio }
  const colaLibreria = canciones.map(c => ({ fileId: c.id, name: c.name, audio: c.audio }));
  // Cola para playlist: mapear a { fileId, titulo }
  const colaPlaylist = cancionesPlaylist.map(c => ({ fileId: c.file_id, titulo: c.titulo }));

  return (
    <div className="min-h-screen bg-gray-50 pb-32">
      {/* ── Header ── */}
      <div className="bg-white border-b sticky top-0 z-20">
        <div className="max-w-4xl mx-auto px-4 h-14 flex items-center gap-3">
          <button onClick={() => navigate("/portal")} className="text-gray-500 hover:text-gray-800 p-1 -ml-1 transition">
            <ArrowLeft size={20} />
          </button>
          <span className="font-semibold text-gray-800 text-base flex items-center gap-2">
            <Music size={16} className="text-indigo-500" /> Biblioteca de Música
          </span>
        </div>
        {/* Tabs */}
        <div className="max-w-4xl mx-auto px-4 flex gap-0 border-t">
          {[
            { id: "biblioteca", label: "Carpetas", icon: <FolderOpen size={14} /> },
            { id: "playlists",  label: "Mis Playlists", icon: <ListMusic size={14} />, badge: playlists.length || null },
          ].map(t => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={`flex items-center gap-1.5 px-4 py-2.5 text-sm font-medium border-b-2 transition ${
                tab === t.id ? "border-indigo-500 text-indigo-600" : "border-transparent text-gray-500 hover:text-gray-700"
              }`}
            >
              {t.icon} {t.label}
              {t.badge ? (
                <span className="bg-indigo-100 text-indigo-600 text-xs rounded-full px-1.5 leading-5">{t.badge}</span>
              ) : null}
            </button>
          ))}
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-4 py-4">

        {/* ─────────────── TAB BIBLIOTECA ─────────────── */}
        {tab === "biblioteca" && (
          <>
            {loadingCarpetas ? (
              <div className="flex justify-center py-16">
                <Loader2 size={28} className="animate-spin text-indigo-400" />
              </div>
            ) : errorConexion ? (
              <div className="text-center py-16 text-gray-400 space-y-2">
                <Music size={40} className="mx-auto opacity-30" />
                <p className="text-sm font-medium">{errorConexion}</p>
                <p className="text-xs">Contacta al administrador para configurar OneDrive.</p>
              </div>
            ) : (
              <>
                {/* ── Chips de carpetas ── */}
                <div className="flex gap-2 flex-wrap mb-4">
                  {carpetas.map(c => (
                    <button
                      key={c.id}
                      onClick={() => cargarCanciones(c)}
                      className={`px-3 py-1.5 rounded-full text-sm font-medium transition ${
                        carpetaActiva?.id === c.id
                          ? "bg-indigo-600 text-white"
                          : "bg-white text-gray-600 border border-gray-200 hover:border-indigo-300 hover:text-indigo-600"
                      }`}
                    >
                      {c.name}
                    </button>
                  ))}
                </div>

                {/* ── Lista de canciones ── */}
                {loadingCanciones ? (
                  <div className="flex justify-center py-10">
                    <Loader2 size={22} className="animate-spin text-indigo-400" />
                  </div>
                ) : canciones.length === 0 ? (
                  <p className="text-center text-gray-400 text-sm py-8">No hay canciones en esta carpeta</p>
                ) : (
                  <div className="bg-white rounded-2xl shadow-sm divide-y divide-gray-100 overflow-hidden">
                    {canciones.map((c, i) => {
                      const titulo  = c.audio?.title  || sinExtension(c.name || "");
                      const artista = c.audio?.artist || c.audio?.albumArtist || null;
                      const esActual = cancionActual?.fileId === c.id;
                      return (
                        <div
                          key={c.id}
                          className={`flex items-center gap-2 px-4 py-3 hover:bg-gray-50 transition ${esActual ? "bg-indigo-50" : ""}`}
                        >
                          {/* Botón play */}
                          <button
                            onClick={() => reproducirCancion(c, colaLibreria, i)}
                            disabled={loadingStream}
                            className="w-8 h-8 rounded-full flex items-center justify-center shrink-0 hover:bg-indigo-100 transition"
                          >
                            {esActual && loadingStream ? (
                              <Loader2 size={15} className="animate-spin text-indigo-500" />
                            ) : esActual && reproduciendo ? (
                              <Pause size={15} className="text-indigo-600" />
                            ) : (
                              <Play size={15} className={esActual ? "text-indigo-600" : "text-gray-400"} />
                            )}
                          </button>
                          {/* Info */}
                          <button
                            className="flex-1 min-w-0 text-left"
                            onClick={() => reproducirCancion(c, colaLibreria, i)}
                          >
                            <p className={`text-sm font-medium truncate ${esActual ? "text-indigo-700" : "text-gray-800"}`}>
                              {titulo}
                            </p>
                            {artista && <p className="text-xs text-gray-400 truncate">{artista}</p>}
                          </button>
                          {/* Agregar a playlist */}
                          <button
                            onClick={() => setAgregandoA(c)}
                            className="p-1.5 text-gray-300 hover:text-indigo-500 transition shrink-0"
                            title="Agregar a playlist"
                          >
                            <ListPlus size={16} />
                          </button>
                        </div>
                      );
                    })}
                  </div>
                )}
              </>
            )}
          </>
        )}

        {/* ─────────────── TAB PLAYLISTS ─────────────── */}
        {tab === "playlists" && (
          <div className="space-y-4">
            {/* Crear playlist */}
            {mostrarNuevaPlaylist ? (
              <div className="bg-white rounded-2xl shadow-sm p-4 flex gap-2">
                <input
                  autoFocus
                  type="text"
                  placeholder="Nombre de la playlist..."
                  value={nombreNuevaPlaylist}
                  onChange={e => setNombreNuevaPlaylist(e.target.value)}
                  onKeyDown={e => e.key === "Enter" && crearPlaylist()}
                  className="flex-1 border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400"
                />
                <button
                  onClick={crearPlaylist}
                  className="bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-xl text-sm font-medium transition"
                >
                  Crear
                </button>
                <button
                  onClick={() => { setMostrarNuevaPlaylist(false); setNombreNuevaPlaylist(""); }}
                  className="text-gray-400 hover:text-gray-600 px-2 transition"
                >
                  <X size={18} />
                </button>
              </div>
            ) : (
              <button
                onClick={() => setMostrarNuevaPlaylist(true)}
                className="flex items-center gap-1.5 text-sm text-indigo-600 font-medium hover:text-indigo-800 transition"
              >
                <Plus size={16} /> Nueva playlist
              </button>
            )}

            {/* Sin playlists */}
            {playlists.length === 0 && (
              <div className="text-center py-12 text-gray-400 space-y-2">
                <ListMusic size={36} className="mx-auto opacity-30" />
                <p className="text-sm">Aún no tienes playlists</p>
              </div>
            )}

            {/* Vista detalle playlist */}
            {playlistActiva ? (
              <div>
                <button
                  onClick={() => setPlaylistActiva(null)}
                  className="flex items-center gap-2 text-sm text-gray-500 hover:text-gray-800 mb-4 transition"
                >
                  <ArrowLeft size={15} />
                  <span className="font-semibold text-gray-700">{playlistActiva.nombre}</span>
                  <span className="text-xs text-gray-400">({cancionesPlaylist.length} canciones)</span>
                </button>

                {cancionesPlaylist.length === 0 ? (
                  <p className="text-center text-gray-400 text-sm py-8">
                    La playlist está vacía. Agrega canciones desde la biblioteca.
                  </p>
                ) : (
                  <div className="bg-white rounded-2xl shadow-sm divide-y divide-gray-100 overflow-hidden">
                    {cancionesPlaylist.map((c, i) => {
                      const esActual = cancionActual?.fileId === c.file_id;
                      return (
                        <div key={c.id} className={`flex items-center gap-2 px-4 py-3 hover:bg-gray-50 transition ${esActual ? "bg-indigo-50" : ""}`}>
                          <button
                            onClick={() => reproducirDePlaylist(c, colaPlaylist, i)}
                            className="w-8 h-8 rounded-full flex items-center justify-center shrink-0 hover:bg-indigo-100 transition"
                          >
                            {esActual && reproduciendo
                              ? <Pause size={15} className="text-indigo-600" />
                              : <Play  size={15} className={esActual ? "text-indigo-600" : "text-gray-400"} />
                            }
                          </button>
                          <button
                            className="flex-1 min-w-0 text-left"
                            onClick={() => reproducirDePlaylist(c, colaPlaylist, i)}
                          >
                            <p className={`text-sm font-medium truncate ${esActual ? "text-indigo-700" : "text-gray-800"}`}>
                              {c.titulo}
                            </p>
                          </button>
                          <button
                            onClick={() => quitarDePlaylist(playlistActiva.id, c.id)}
                            className="p-1.5 text-gray-300 hover:text-red-500 transition shrink-0"
                          >
                            <Trash2 size={14} />
                          </button>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            ) : (
              /* Lista de playlists */
              <div className="space-y-2">
                {playlists.map(pl => (
                  <div key={pl.id} className="bg-white rounded-2xl shadow-sm flex items-center gap-3 px-4 py-3 hover:bg-gray-50 transition">
                    <button
                      className="flex items-center gap-3 flex-1 min-w-0 text-left"
                      onClick={() => cargarCancionesPlaylist(pl)}
                    >
                      <div className="w-10 h-10 rounded-xl bg-indigo-100 flex items-center justify-center shrink-0">
                        <ListMusic size={18} className="text-indigo-500" />
                      </div>
                      <div className="min-w-0">
                        <p className="text-sm font-semibold text-gray-800 truncate">{pl.nombre}</p>
                        <p className="text-xs text-gray-400">{pl.total} {pl.total === 1 ? "canción" : "canciones"}</p>
                      </div>
                    </button>
                    <ChevronRight size={15} className="text-gray-300 shrink-0" />
                    <button
                      onClick={() => eliminarPlaylist(pl.id)}
                      className="p-1.5 text-gray-300 hover:text-red-500 transition shrink-0"
                    >
                      <Trash2 size={15} />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* ── Player bar ── */}
      {cancionActual && (
        <div className="fixed bottom-0 left-0 right-0 bg-white border-t shadow-2xl z-30">
          <div className="max-w-4xl mx-auto px-4 pt-2 pb-3">
            {/* Progress */}
            <input
              type="range"
              min={0}
              max={duracion || 0}
              step={0.1}
              value={progreso}
              onChange={seekTo}
              className="w-full h-1 mb-2 accent-indigo-600 cursor-pointer"
            />
            <div className="flex items-center gap-3">
              {/* Título */}
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-gray-800 truncate">{cancionActual.titulo}</p>
                <p className="text-xs text-gray-400">
                  {fmt(progreso)}{duracion ? ` / ${fmt(duracion)}` : ""}
                  {cancionActual.artista && <span className="ml-2 text-gray-300">· {cancionActual.artista}</span>}
                </p>
              </div>
              {/* Controles */}
              <div className="flex items-center gap-1 shrink-0">
                <button onClick={() => irA(-1)} className="p-2 text-gray-500 hover:text-gray-800 transition">
                  <SkipBack size={18} />
                </button>
                <button
                  onClick={togglePlay}
                  className="w-10 h-10 rounded-full bg-indigo-600 hover:bg-indigo-700 text-white flex items-center justify-center transition"
                >
                  {reproduciendo ? <Pause size={18} /> : <Play size={18} />}
                </button>
                <button onClick={() => irA(1)} className="p-2 text-gray-500 hover:text-gray-800 transition">
                  <SkipForward size={18} />
                </button>
              </div>
              {/* Volumen (solo desktop) */}
              <div className="hidden sm:flex items-center gap-2 shrink-0">
                <Volume2 size={14} className="text-gray-400" />
                <input
                  type="range" min={0} max={1} step={0.05} value={volumen}
                  onChange={e => {
                    const v = parseFloat(e.target.value);
                    setVolumen(v);
                    audioRef.current.volume = v;
                  }}
                  className="w-20 accent-indigo-600"
                />
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── Modal: agregar a playlist ── */}
      {agregandoA && (
        <div
          className="fixed inset-0 bg-black/50 z-50 flex items-end sm:items-center justify-center"
          onClick={() => setAgregandoA(null)}
        >
          <div
            className="bg-white rounded-t-2xl sm:rounded-2xl shadow-xl w-full sm:max-w-sm max-h-[80vh] flex flex-col overflow-hidden"
            onClick={e => e.stopPropagation()}
          >
            <div className="flex items-center justify-between px-5 py-4 border-b shrink-0">
              <div className="min-w-0">
                <p className="text-xs text-gray-400">Agregar a playlist</p>
                <p className="text-sm font-semibold text-gray-800 truncate">
                  {agregandoA.audio?.title || sinExtension(agregandoA.name || "")}
                </p>
              </div>
              <button onClick={() => setAgregandoA(null)} className="text-gray-400 hover:text-gray-600 ml-2 transition">
                <X size={18} />
              </button>
            </div>
            <div className="overflow-y-auto flex-1 py-1">
              {playlists.length === 0 ? (
                <p className="text-center text-gray-400 text-sm py-6">
                  Sin playlists. Crea una primero desde "Mis Playlists".
                </p>
              ) : (
                playlists.map(pl => (
                  <button
                    key={pl.id}
                    onClick={() => agregarAPlaylist(pl.id, agregandoA)}
                    disabled={addingPl === pl.id}
                    className="flex items-center gap-3 w-full px-5 py-3 hover:bg-indigo-50 transition text-left"
                  >
                    <ListMusic size={16} className="text-indigo-400 shrink-0" />
                    <span className="flex-1 text-sm text-gray-800 truncate">{pl.nombre}</span>
                    <span className="text-xs text-gray-400 shrink-0">{pl.total}</span>
                    {addingPl === pl.id && <Loader2 size={14} className="animate-spin text-indigo-400 shrink-0" />}
                  </button>
                ))
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
