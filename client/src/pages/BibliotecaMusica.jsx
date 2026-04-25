import React, { useEffect, useState, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { useMemberAuth } from "../context/MemberAuthContext";
import {
  ArrowLeft, Music, Play, Pause, SkipBack, SkipForward,
  Volume2, Trash2, FolderOpen, Loader2, X, Layers,
  CheckCircle2, Radio, HardDriveDownload, Music2,
} from "lucide-react";
import MultitrackPlayer, { precacheTrackList } from "../components/MultitrackPlayer";
import GuiasEditor from "../components/GuiasEditor";
import { idbStats, idbClear, formatBytes } from "../utils/audioOfflineCache";

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
  const { miembro, loading: authLoading, getToken } = useMemberAuth();

  // ── Navegación tabs ──
  const [tab, setTab] = useState("biblioteca");

  // ── Datos ──
  const [carpetas, setCarpetas] = useState([]);
  const [carpetaActiva, setCarpetaActiva] = useState(null);
  const [subcarpetas, setSubcarpetas] = useState([]);
  const [subcarpetaActiva, setSubcarpetaActiva] = useState(null);
  const [canciones, setCanciones] = useState([]);


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

  // ── Multitrack ──
  const [multitrackTracks, setMultitrackTracks] = useState(null);
  const [multitrackFolder, setMultitrackFolder] = useState("");

  // ── Editor de Guías ──
  const [guiasEditorOpen, setGuiasEditorOpen] = useState(false);
  const [guiasFolderId, setGuiasFolderId] = useState(null);
  const [guiasFolderName, setGuiasFolderName] = useState("");
  // Duración de la canción activa (para el editor de guías)
  const [guiasDuration, setGuiasDuration] = useState(0);

  // ── Setlist ──
  // setlistItems: [{ carpeta: {id,name}, tracks: null|[], cached: bool, caching: bool }]
  const [setlistItems, setSetlistItems] = useState([]);
  const [setlistActivo, setSetlistActivo] = useState(false); // player abierto
  const [setlistSongIdx, setSetlistSongIdx] = useState(0);
  const setlistLoadedRef  = useRef(false); // true cuando la carga inicial desde DB está hecha
  const setlistSaveTimer  = useRef(null);  // debounce del guardado automático
  const [precachingAll, setPrecachingAll] = useState(false);
  const [precacheProgress, setPrecacheProgress] = useState(0);
  const [savingOffline, setSavingOffline] = useState(false);
  const [offlineStats, setOfflineStats] = useState(null); // { count, bytes }



  const hdrs = () => ({ Authorization: `Bearer ${getToken()}` });

  // ── Audio events ──
  useEffect(() => {
    if (authLoading) return;              // esperar a que el contexto inicialice
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
    cargarSetlist();
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
      if (data.length > 0) await seleccionarCarpeta(data[0]);
    } catch { setErrorConexion("Error de conexión con el servidor"); }
    finally   { setLoadingCarpetas(false); }
  };

  const seleccionarCarpeta = async (carpeta) => {
    setCarpetaActiva(carpeta);
    setSubcarpetas([]);
    setSubcarpetaActiva(null);
    setCanciones([]);
    setLoadingCanciones(true);
    try {
      // Buscar subcarpetas dentro de esta carpeta
      const r = await fetch(`${API_URL}/api/musica/carpetas?folderId=${encodeURIComponent(carpeta.id)}`, { headers: hdrs() });
      const subs = await r.json();
      if (Array.isArray(subs) && subs.length > 0) {
        setSubcarpetas(subs);
        // Auto-cargar canciones de la primera subcarpeta
        await cargarCanciones(subs[0]);
      } else {
        // No hay subcarpetas: cargar directamente las canciones
        await cargarCanciones(carpeta);
      }
    } catch {
      await cargarCanciones(carpeta);
    } finally {
      setLoadingCanciones(false);
    }
  };

  const cargarCanciones = async (carpeta) => {
    setSubcarpetaActiva(carpeta);
    setLoadingCanciones(true);
    try {
      const r = await fetch(
        `${API_URL}/api/musica/canciones?folderId=${encodeURIComponent(carpeta.id)}`,
        { headers: hdrs() }
      );
      const data = await r.json();
      setCanciones(Array.isArray(data) ? data : []);
    } catch { setCanciones([]); }
    finally   { setLoadingCanciones(false); }
  };

  const cargarSetlist = async () => {
    setlistLoadedRef.current = false;
    try {
      const r = await fetch(`${API_URL}/api/musica/setlist`, { headers: hdrs() });
      if (!r.ok) return;
      const data = await r.json();
      if (!Array.isArray(data) || data.length === 0) return;
      setSetlistItems(data.map(row => ({
        carpeta: { id: row.carpeta_id, name: row.carpeta_name },
        tracks: null, cached: false, caching: true,
      })));
      // Cargar los tracks de cada canción en paralelo
      await Promise.all(data.map(async (row) => {
        try {
          const r2 = await fetch(
            `${API_URL}/api/musica/canciones?folderId=${encodeURIComponent(row.carpeta_id)}`,
            { headers: hdrs() }
          );
          const tracks = await r2.json();
          setSetlistItems(prev => prev.map(s =>
            s.carpeta.id === row.carpeta_id
              ? { ...s, tracks: Array.isArray(tracks) ? tracks : [], caching: false }
              : s
          ));
        } catch {
          setSetlistItems(prev => prev.map(s =>
            s.carpeta.id === row.carpeta_id ? { ...s, tracks: [], caching: false } : s
          ));
        }
      }));
    } catch {}
    finally { setlistLoadedRef.current = true; }
  };

  // Guardar setlist en DB cada vez que cambia (debounce 1s)
  useEffect(() => {
    if (!miembro || !setlistLoadedRef.current) return;
    clearTimeout(setlistSaveTimer.current);
    const payload = setlistItems.map(s => ({ carpeta_id: s.carpeta.id, carpeta_name: s.carpeta.name }));
    setlistSaveTimer.current = setTimeout(() => {
      fetch(`${API_URL}/api/musica/setlist`, {
        method: "PUT",
        headers: { Authorization: `Bearer ${getToken()}`, "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      }).catch(() => {});
    }, 1000);
    return () => clearTimeout(setlistSaveTimer.current);
  }, [setlistItems]); // eslint-disable-line

  // ── Setlist helpers ──
  const toggleEnSetlist = async (carpeta) => {
    const yaEsta = setlistItems.some((s) => s.carpeta.id === carpeta.id);
    if (yaEsta) {
      setSetlistItems((prev) => prev.filter((s) => s.carpeta.id !== carpeta.id));
      return;
    }
    // Agregar y cargar sus tracks en background
    const item = { carpeta, tracks: null, cached: false, caching: true };
    setSetlistItems((prev) => [...prev, item]);
    try {
      const r = await fetch(`${API_URL}/api/musica/canciones?folderId=${encodeURIComponent(carpeta.id)}`, { headers: hdrs() });
      const data = await r.json();
      const tracks = Array.isArray(data) ? data : [];
      setSetlistItems((prev) => prev.map((s) => s.carpeta.id === carpeta.id ? { ...s, tracks, caching: false } : s));
    } catch {
      setSetlistItems((prev) => prev.map((s) => s.carpeta.id === carpeta.id ? { ...s, tracks: [], caching: false } : s));
    }
  };

  const moverSetlistItem = (idx, dir) => {
    setSetlistItems((prev) => {
      const next = [...prev];
      const dest = idx + dir;
      if (dest < 0 || dest >= next.length) return prev;
      [next[idx], next[dest]] = [next[dest], next[idx]];
      return next;
    });
  };

  const precacharSetlist = async () => {
    setPrecachingAll(true);
    setPrecacheProgress(0);
    const allTracks = setlistItems.flatMap((s) => s.tracks || []);
    const total = allTracks.length;
    const errors = [];
    await precacheTrackList(allTracks, getToken, (done, _total, track, err) => {
      if (err) errors.push(`${track.name || track.id}: ${err}`);
      setPrecacheProgress(Math.round((done / total) * 100));
    });
    setSetlistItems((prev) => prev.map((s) => ({ ...s, cached: true })));
    setPrecachingAll(false);
    if (errors.length > 0) console.warn("Pre-carga con errores:", errors);
  };

  // Guardar setlist completo en IndexedDB (persiste entre sesiones)
  const guardarOffline = async () => {
    setSavingOffline(true);
    setPrecacheProgress(0);
    const allTracks = setlistItems.flatMap((s) => s.tracks || []);
    const total = allTracks.length;
    await precacheTrackList(allTracks, getToken, (done) => {
      setPrecacheProgress(Math.round((done / total) * 100));
    });
    setSetlistItems((prev) => prev.map((s) => ({ ...s, cached: true })));
    const stats = await idbStats();
    setOfflineStats(stats);
    setSavingOffline(false);
  };

  // Cargar stats de caché offline al abrir la pestaña setlist
  useEffect(() => {
    if (tab === "setlist") {
      idbStats().then(setOfflineStats);
    }
  }, [tab]);

  const abrirSetlist = (idx) => {
    setSetlistSongIdx(idx);
    setSetlistActivo(true);
  };

  const navegarSetlist = (delta) => {
    const next = setlistSongIdx + delta;
    if (next >= 0 && next < setlistItems.length) setSetlistSongIdx(next);
  };

  // ── Player ──
  const reproducirItem = async (item, cola, idx) => {
    const fileId = item.fileId || item.file_id || item.id;
    setLoadingStream(true);
    try {
      // Fetch con auth header → Blob URL para el elemento <audio>
      const r = await fetch(`${API_URL}/api/musica/stream/${fileId}`, { headers: hdrs() });
      if (!r.ok) { console.error("Error stream:", r.status); return; }
      const blob = await r.blob();
      const blobUrl = URL.createObjectURL(blob);
      const audio = audioRef.current;
      // Revocar blob anterior si existe
      if (audio._blobUrl) URL.revokeObjectURL(audio._blobUrl);
      audio._blobUrl = blobUrl;
      audio.src = blobUrl;
      audio.volume = volumen;
      await audio.play();
      colaRef.current = cola;
      idxRef.current  = idx;
      setCancionActual({
        fileId,
        titulo:  item.titulo || sinExtension(item.name || ""),
        artista: null,
      });
    } catch (e) { console.error("Error al reproducir:", e); }
    finally   { setLoadingStream(false); }
  };

  const reproducirCancion = (cancion, cola, idx) => reproducirItem(cancion, cola, idx);

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

  if (authLoading) return (
    <div className="flex items-center justify-center min-h-screen">
      <Loader2 size={28} className="animate-spin text-indigo-400" />
    </div>
  );
  if (!miembro) return null;

  const colaLibreria = canciones;

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
            { id: "setlist",    label: "Setlist", icon: <Radio size={14} />, badge: setlistItems.length || null },
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

      <div className={tab === "biblioteca" ? "" : "max-w-4xl mx-auto px-4 py-4"}>

        {/* ─────────────── TAB BIBLIOTECA ─────────────── */}
        {tab === "biblioteca" && (
          loadingCarpetas ? (
            <div className="flex justify-center py-16">
              <Loader2 size={28} className="animate-spin text-indigo-400" />
            </div>
          ) : errorConexion ? (
            <div className="text-center py-16 text-gray-400 space-y-2">
              <Music size={40} className="mx-auto opacity-30" />
              <p className="text-sm font-medium">{errorConexion}</p>
              <p className="text-xs">Contacta al administrador para configurar Google Drive.</p>
            </div>
          ) : (
            <div className="flex h-[calc(100vh-106px)]">

              {/* ── Sidebar izquierda: árbol de carpetas ── */}
              <div className="w-52 sm:w-60 shrink-0 bg-white border-r border-gray-200 flex flex-col overflow-hidden">
                <div className="px-4 py-3 border-b border-gray-100 shrink-0">
                  <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Carpetas</p>
                </div>
                <div className="overflow-y-auto flex-1 py-2 px-2">
                  {carpetas.map(c => (
                    <div key={c.id}>
                      <button
                        onClick={() => seleccionarCarpeta(c)}
                        className={`w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-semibold transition text-left mb-0.5 ${
                          carpetaActiva?.id === c.id
                            ? "bg-indigo-50 text-indigo-700"
                            : "text-gray-600 hover:bg-gray-50 hover:text-gray-800"
                        }`}
                      >
                        <FolderOpen size={15} className={`shrink-0 ${carpetaActiva?.id === c.id ? "text-indigo-500" : "text-gray-400"}`} />
                        <span className="truncate flex-1">{c.name}</span>
                      </button>
                      {carpetaActiva?.id === c.id && subcarpetas.length > 0 && (
                        <div className="ml-4 pl-2 border-l-2 border-indigo-100 mt-0.5 mb-2 space-y-0.5">
                          {subcarpetas.map(s => {
                            const enSetlist = setlistItems.some(sl => sl.carpeta.id === s.id);
                            const isActive  = subcarpetaActiva?.id === s.id;
                            return (
                              <div
                                key={s.id}
                                className={`flex items-center gap-1 rounded-lg pr-1 transition ${
                                  isActive ? "bg-indigo-100" : "hover:bg-gray-50"
                                }`}
                              >
                                <button
                                  onClick={() => cargarCanciones(s)}
                                  className={`flex-1 min-w-0 text-left px-2 py-1.5 text-xs font-medium truncate ${
                                    isActive ? "text-indigo-700" : "text-gray-600 hover:text-gray-800"
                                  }`}
                                >
                                  {s.name}
                                </button>
                                <button
                                  onClick={() => toggleEnSetlist(s)}
                                  title={enSetlist ? "Quitar del setlist" : "Agregar al setlist"}
                                  className={`w-5 h-5 rounded-full flex items-center justify-center transition text-xs shrink-0 ${
                                    enSetlist ? "bg-green-500 text-white" : "bg-gray-100 text-gray-400 hover:bg-indigo-200 hover:text-indigo-600"
                                  }`}
                                >
                                  {enSetlist ? "✓" : "+"}
                                </button>
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>

              {/* ── Panel derecho: canciones ── */}
              <div className="flex-1 overflow-y-auto bg-gray-50">
                <div className="px-5 py-4 max-w-3xl mx-auto">

                  {/* Cabecera: nombre activo + botones acción */}
                  {(subcarpetaActiva || carpetaActiva) && (
                    <div className="flex items-center justify-between mb-4 gap-2 flex-wrap">
                      <div className="flex items-center gap-2 min-w-0">
                        <h2 className="text-base font-bold text-gray-800 truncate">
                          {subcarpetaActiva?.name || carpetaActiva?.name}
                        </h2>
                        {subcarpetas.length === 0 && carpetaActiva && (() => {
                          const enSetlist = setlistItems.some(sl => sl.carpeta.id === carpetaActiva.id);
                          return (
                            <button
                              onClick={() => toggleEnSetlist(carpetaActiva)}
                              title={enSetlist ? "Quitar del setlist" : "Agregar al setlist"}
                              className={`w-6 h-6 rounded-full flex items-center justify-center transition text-xs shrink-0 ${
                                enSetlist ? "bg-green-500 text-white" : "bg-gray-200 text-gray-400 hover:bg-indigo-200 hover:text-indigo-600"
                              }`}
                            >
                              {enSetlist ? "✓" : "+"}
                            </button>
                          );
                        })()}
                      </div>
                      {canciones.length > 1 && (
                        <div className="flex gap-2 shrink-0">
                          <button
                            onClick={() => {
                              const fid = subcarpetaActiva?.id || carpetaActiva?.id;
                              const fname = subcarpetaActiva?.name || carpetaActiva?.name || "Canción";
                              setGuiasFolderId(fid);
                              setGuiasFolderName(fname);
                              setGuiasDuration(0);
                              setGuiasEditorOpen(true);
                            }}
                            className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold bg-emerald-600 text-white hover:bg-emerald-700 transition shadow"
                          >
                            <Music2 size={13} /> Modo Edición
                          </button>
                          <button
                            onClick={() => {
                              setMultitrackFolder(subcarpetaActiva?.name || carpetaActiva?.name || "Multitrack");
                              setMultitrackTracks(canciones);
                            }}
                            className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold bg-indigo-600 text-white hover:bg-indigo-700 transition shadow"
                          >
                            <Layers size={13} /> Modo Multitrack
                          </button>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Lista de canciones */}
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
                            <button
                              className="flex-1 min-w-0 text-left"
                              onClick={() => reproducirCancion(c, colaLibreria, i)}
                            >
                              <p className={`text-sm font-medium truncate ${esActual ? "text-indigo-700" : "text-gray-800"}`}>
                                {titulo}
                              </p>
                              {artista && <p className="text-xs text-gray-400 truncate">{artista}</p>}
                            </button>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              </div>
            </div>
          )
        )}

        {/* ─────────────── TAB SETLIST ─────────────── */}
        {tab === "setlist" && (
          <div className="space-y-4">
            {setlistItems.length === 0 ? (
              <div className="text-center py-14 text-gray-400 space-y-2">
                <Radio size={36} className="mx-auto opacity-30" />
                <p className="text-sm font-medium">Setlist vacío</p>
                <p className="text-xs text-gray-400 max-w-xs mx-auto">
                  Ve a "Carpetas", selecciona una canción (subcarpeta) y toca el <strong>+</strong> junto a su nombre para agregarla aquí.
                </p>
              </div>
            ) : (
              <>
                {/* Lista ordenable */}
                <div className="bg-white rounded-2xl shadow-sm divide-y divide-gray-100 overflow-hidden">
                  {setlistItems.map((item, idx) => (
                    <div key={item.carpeta.id} className="flex items-center gap-2 px-4 py-3">
                      {/* Orden */}
                      <div className="flex flex-col gap-0.5 shrink-0">
                        <button
                          onClick={() => moverSetlistItem(idx, -1)}
                          disabled={idx === 0}
                          className="text-gray-300 hover:text-gray-600 disabled:opacity-20 leading-none"
                        >▲</button>
                        <button
                          onClick={() => moverSetlistItem(idx, 1)}
                          disabled={idx === setlistItems.length - 1}
                          className="text-gray-300 hover:text-gray-600 disabled:opacity-20 leading-none"
                        >▼</button>
                      </div>
                      {/* Número */}
                      <span className="text-gray-400 text-xs w-5 text-center tabular-nums shrink-0">{idx + 1}</span>
                      {/* Info */}
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold text-gray-800 truncate">{item.carpeta.name}</p>
                        <p className="text-xs text-gray-400">
                          {item.caching ? "Cargando tracks…" : item.tracks ? `${item.tracks.length} tracks` : "Sin tracks"}
                        </p>
                      </div>
                      {/* Estado caché */}
                      {item.cached && <CheckCircle2 size={15} className="text-green-500 shrink-0" />}
                      {item.caching && <Loader2 size={15} className="animate-spin text-indigo-400 shrink-0" />}
                      {/* Reproducir esta canción */}
                      <button
                        onClick={() => abrirSetlist(idx)}
                        disabled={!item.tracks || item.tracks.length === 0}
                        className="w-8 h-8 rounded-full bg-indigo-100 hover:bg-indigo-200 text-indigo-600 flex items-center justify-center transition disabled:opacity-30 shrink-0"
                      >
                        <Play size={14} />
                      </button>
                      {/* Quitar */}
                      <button
                        onClick={() => toggleEnSetlist(item.carpeta)}
                        className="p-1.5 text-gray-300 hover:text-red-500 transition shrink-0"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  ))}
                </div>

                {/* Pre-carga + Guardar offline + Tocar setlist completo */}
                <div className="flex gap-3 flex-wrap items-center">
                  <button
                    onClick={precacharSetlist}
                    disabled={precachingAll || savingOffline || setlistItems.every((s) => s.cached)}
                    className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium bg-white border border-gray-200 text-gray-700 hover:border-indigo-300 hover:text-indigo-600 transition disabled:opacity-50"
                  >
                    {precachingAll ? (
                      <><Loader2 size={14} className="animate-spin" /> Pre-cargando… {precacheProgress}%</>
                    ) : setlistItems.every((s) => s.cached) ? (
                      <><CheckCircle2 size={14} className="text-green-500" /> Todo pre-cargado</>
                    ) : (
                      <><Layers size={14} /> Pre-cargar todo</>
                    )}
                  </button>

                  {/* Guardar offline en IndexedDB */}
                  <button
                    onClick={guardarOffline}
                    disabled={savingOffline || precachingAll || setlistItems.length === 0}
                    className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium bg-emerald-50 border border-emerald-200 text-emerald-700 hover:bg-emerald-100 transition disabled:opacity-50"
                    title="Guarda todos los tracks en el navegador — carga instantánea en próximas sesiones"
                  >
                    {savingOffline ? (
                      <><Loader2 size={14} className="animate-spin" /> Guardando… {precacheProgress}%</>
                    ) : (
                      <><HardDriveDownload size={14} /> Guardar offline</>
                    )}
                  </button>

                  {/* Indicador de almacenamiento guardado + botón limpiar */}
                  {offlineStats && offlineStats.count > 0 && (
                    <span className="text-xs text-gray-400 flex items-center gap-1.5">
                      <CheckCircle2 size={12} className="text-emerald-500" />
                      {offlineStats.count} tracks · {formatBytes(offlineStats.bytes)}
                      <button
                        onClick={async () => {
                          await idbClear();
                          setOfflineStats(null);
                          setSetlistItems((prev) => prev.map((s) => ({ ...s, cached: false })));
                        }}
                        className="ml-1 text-red-400 hover:text-red-600 underline underline-offset-2 transition"
                        title="Eliminar caché offline"
                      >
                        Limpiar
                      </button>
                    </span>
                  )}

                  <button
                    onClick={() => abrirSetlist(0)}
                    disabled={setlistItems.length === 0 || !setlistItems[0]?.tracks?.length}
                    className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold bg-indigo-600 text-white hover:bg-indigo-700 transition disabled:opacity-40"
                  >
                    <Play size={14} /> Tocar setlist desde el inicio
                  </button>
                </div>
              </>
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

      {/* ── Editor de Guías ── */}
      {guiasEditorOpen && guiasFolderId && (
        <GuiasEditor
          folderId={guiasFolderId}
          folderName={guiasFolderName}
          tracks={canciones}
          getToken={getToken}
          onClose={() => setGuiasEditorOpen(false)}
          onSaved={(clips) => {
            setGuiasEditorOpen(false);
          }}
          onSwitchToMultitrack={() => {
            setGuiasEditorOpen(false);
            setMultitrackFolder(guiasFolderName);
            setMultitrackTracks(canciones);
          }}
        />
      )}

      {/* ── Multitrack Player (modo carpeta normal) ── */}
      {multitrackTracks && !setlistActivo && (
        <MultitrackPlayer
          tracks={multitrackTracks}
          folderName={multitrackFolder}
          folderId={subcarpetaActiva?.id || carpetaActiva?.id || null}
          onClose={() => setMultitrackTracks(null)}
          getToken={getToken}
          onSwitchToEditor={() => {
            setMultitrackTracks(null);
            setGuiasFolderId(subcarpetaActiva?.id || carpetaActiva?.id);
            setGuiasFolderName(multitrackFolder);
            setGuiasEditorOpen(true);
          }}
        />
      )}

      {/* ── Multitrack Player (modo setlist) ── */}
      {setlistActivo && setlistItems[setlistSongIdx]?.tracks?.length > 0 && (
        <MultitrackPlayer
          key={setlistSongIdx}
          tracks={setlistItems[setlistSongIdx].tracks}
          folderName={setlistItems[setlistSongIdx].carpeta.name}
          folderId={setlistItems[setlistSongIdx].carpeta.id}
          onClose={() => setSetlistActivo(false)}
          getToken={getToken}
          setlistSongs={setlistItems.map((s) => ({
            name: s.carpeta.name,
            cached: s.cached,
            caching: s.caching,
          }))}
          songIndex={setlistSongIdx}
          onPrevSong={(delta) => navegarSetlist(-delta)}
          onNextSong={(delta) => navegarSetlist(delta)}
          nextSongsTracks={
            // Pasar los tracks de las próximas 2 canciones para pre-cargar en background
            setlistItems
              .slice(setlistSongIdx + 1, setlistSongIdx + 3)
              .map((s) => s.tracks)
              .filter(Boolean)
          }
        />
      )}
    </div>
  );
}
