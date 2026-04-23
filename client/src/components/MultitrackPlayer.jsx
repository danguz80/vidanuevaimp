import React, { useEffect, useRef, useState, useCallback } from "react";
import { X, Play, Pause, Square, Volume2, Loader2, SkipBack, SkipForward, ListMusic } from "lucide-react";
import { idbGet, idbSet } from "../utils/audioOfflineCache";

const API_URL = import.meta.env.VITE_BACKEND_URL || "https://iglesia-backend.onrender.com";

// Caché global de ArrayBuffers por fileId — persiste mientras la pestaña está abierta
const bufferCache = new Map();

const TRACK_COLORS = [
  "#6366f1", "#10b981", "#f59e0b", "#ef4444", "#8b5cf6",
  "#06b6d4", "#84cc16", "#f97316", "#ec4899", "#14b8a6",
];

function fmt(seg) {
  if (!seg || isNaN(seg)) return "0:00";
  const m = Math.floor(seg / 60);
  const s = Math.floor(seg % 60);
  return `${m}:${s.toString().padStart(2, "0")}`;
}

function sinExtension(nombre) {
  return (nombre || "").replace(/\.[^.]+$/, "");
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// ── Pre-carga silenciosa de un array de tracks (solo ArrayBuffer, sin decode) ──
// Descarga uno por uno con delay para no saturar el rate limit de Google Drive
export async function precacheTrackList(tracks, getToken, onProgress) {
  for (let i = 0; i < tracks.length; i++) {
    const track = tracks[i];
    const fileId = track.id || track.file_id || track.fileId;

    // 1) Memoria RAM (más rápido)
    if (bufferCache.has(fileId)) {
      onProgress?.(i + 1, tracks.length, track, null);
      continue;
    }

    // 2) IndexedDB (persistente entre sesiones)
    const idbData = await idbGet(fileId);
    if (idbData) {
      bufferCache.set(fileId, idbData);
      onProgress?.(i + 1, tracks.length, track, null);
      continue;
    }

    // 3) Descargar desde el servidor
    let lastError = null;
    for (let attempt = 1; attempt <= 3; attempt++) {
      try {
        if (attempt > 1) await sleep(attempt * 800);
        const r = await fetch(`${API_URL}/api/musica/stream/${fileId}`, {
          headers: { Authorization: `Bearer ${getToken()}` },
        });
        if (!r.ok) {
          lastError = `HTTP ${r.status}`;
          if (r.status === 403 || r.status === 429) {
            await sleep(attempt * 1500);
            continue;
          }
          break;
        }
        const ab = await r.arrayBuffer();
        bufferCache.set(fileId, ab.slice(0));
        // Guardar en IDB para persistencia offline
        idbSet(fileId, ab.slice(0));
        lastError = null;
        break;
      } catch (e) {
        lastError = e.message;
      }
    }
    onProgress?.(i + 1, tracks.length, track, lastError);
    if (lastError && i < tracks.length - 1) await sleep(800);
  }
}

// ─────────────────────────────────────────────────────────────────────────────
export default function MultitrackPlayer({
  tracks,
  folderName,
  onClose,
  getToken,
  setlistSongs = null,
  songIndex = null,
  onPrevSong = null,
  onNextSong = null,
  // Pre-carga de canciones siguientes (pasado desde BibliotecaMusica)
  nextSongsTracks = null, // [[track,...], [track,...]] de las próximas canciones
}) {
  const [loading, setLoading] = useState(true);
  const [loadingProgress, setLoadingProgress] = useState(0);
  const [loadingTrack, setLoadingTrack] = useState("");
  const [error, setError] = useState(null);

  const [playing, setPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [masterVolume, setMasterVolume] = useState(0.85);
  const [trackStates, setTrackStates] = useState([]);
  const [showSetlist, setShowSetlist] = useState(false);

  const audioCtxRef = useRef(null);
  const masterGainRef = useRef(null);
  const trackDataRef = useRef([]);
  const startTimeRef = useRef(0);
  const offsetRef = useRef(0);
  const playingRef = useRef(false);
  const timerRef = useRef(null);
  const durationRef = useRef(0);

  const loadTracks = useCallback(async (trackList) => {
    setLoading(true);
    setLoadingProgress(0);
    setLoadingTrack("");
    setError(null);
    setTrackStates([]);
    setCurrentTime(0);
    setDuration(0);
    offsetRef.current = 0;

    clearInterval(timerRef.current);
    trackDataRef.current.forEach((t) => { try { t.sourceNode?.stop(); } catch {} });
    trackDataRef.current = [];
    playingRef.current = false;
    setPlaying(false);

    audioCtxRef.current?.close().catch(() => {});
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    audioCtxRef.current = ctx;

    const masterGain = ctx.createGain();
    masterGain.gain.value = masterVolume;
    masterGain.connect(ctx.destination);
    masterGainRef.current = masterGain;

    try {
      let completedCount = 0;

      // Carga en PARALELO: todos los tracks al mismo tiempo desde RAM/IDB/servidor
      const loaded = await Promise.all(trackList.map(async (track, i) => {
        const name = sinExtension(track.name || track.titulo || `Track ${i + 1}`);
        const fileId = track.id || track.file_id || track.fileId;

        let arrayBuffer;
        if (bufferCache.has(fileId)) {
          // 1) RAM cache
          arrayBuffer = bufferCache.get(fileId).slice(0);
        } else {
          // 2) IndexedDB (offline / sesión anterior)
          const idbData = await idbGet(fileId);
          if (idbData) {
            bufferCache.set(fileId, idbData);
            arrayBuffer = idbData.slice(0);
          } else {
            // 3) Descargar desde servidor (con reintentos)
            let r;
            for (let attempt = 1; attempt <= 3; attempt++) {
              if (attempt > 1) await sleep(attempt * 2000);
              r = await fetch(`${API_URL}/api/musica/stream/${fileId}`, {
                headers: { Authorization: `Bearer ${getToken()}` },
              });
              if (r.ok || (r.status !== 403 && r.status !== 429)) break;
            }
            if (!r.ok) throw new Error(`Error cargando "${name}" (${r.status})`);
            arrayBuffer = await r.arrayBuffer();
            bufferCache.set(fileId, arrayBuffer.slice(0));
            idbSet(fileId, arrayBuffer.slice(0));
          }
        }

        const buffer = await ctx.decodeAudioData(arrayBuffer);
        const gainNode = ctx.createGain();
        gainNode.gain.value = 1;
        const pannerNode = ctx.createStereoPanner();
        pannerNode.pan.value = 0;
        gainNode.connect(pannerNode);
        pannerNode.connect(masterGain);

        completedCount++;
        setLoadingTrack(name);
        setLoadingProgress(Math.round((completedCount / trackList.length) * 100));

        return { id: fileId, name, buffer, gainNode, pannerNode, sourceNode: null, _idx: i };
      }));

      // Restaurar orden original (Promise.all preserva orden, pero por claridad)
      loaded.sort((a, b) => a._idx - b._idx);
      loaded.forEach((t) => delete t._idx);

      trackDataRef.current = loaded;
      const maxDur = Math.max(...loaded.map((t) => t.buffer.duration));
      durationRef.current = maxDur;
      setDuration(maxDur);

      // Auto-pan: click/metrónomo → izquierda (-1), todo lo demás (drums incluido) → derecha (+1)
      // "drums" va a la DERECHA — solo el click/metro/clave va a la izquierda
      const isMetro = (name) => /\b(metro(nome)?|click|clic|clave|beat|tempo|drum\s*machine)\b/i.test(name);
      const initialStates = loaded.map((t) => {
        const pan = isMetro(t.name) ? -1 : 1;
        t.pannerNode.pan.value = pan;
        return { name: t.name, volume: 1, muted: false, soloed: false, pan };
      });
      setTrackStates(initialStates);
      setLoading(false);
    } catch (e) {
      setError(e.message);
      setLoading(false);
    }
  }, [getToken]);

  useEffect(() => {
    loadTracks(tracks);
    return () => {
      clearInterval(timerRef.current);
      trackDataRef.current.forEach((t) => { try { t.sourceNode?.stop(); } catch {} });
      // close() devuelve Promise — usar .catch() para evitar unhandled rejection
      audioCtxRef.current?.close().catch(() => {});
    };
  }, [tracks]);

  // Pre-carga silenciosa de canciones siguientes en background
  // Solo arranca DESPUÉS de que la canción actual haya terminado de cargar
  useEffect(() => {
    if (loading) return; // esperar a que termine loadTracks
    if (!nextSongsTracks || nextSongsTracks.length === 0) return;
    let cancelled = false;
    const run = async () => {
      for (const trackList of nextSongsTracks) {
        if (cancelled) break;
        await precacheTrackList(trackList, getToken);
      }
    };
    const timer = setTimeout(run, 1500);
    return () => { cancelled = true; clearTimeout(timer); };
  }, [nextSongsTracks, getToken, loading]);

  const stopSources = () => {
    trackDataRef.current.forEach((t) => {
      try { t.sourceNode?.stop(); } catch {}
      t.sourceNode = null;
    });
  };

  const startPlayback = (fromOffset) => {
    const ctx = audioCtxRef.current;
    const startAt = ctx.currentTime + 0.05;
    startTimeRef.current = startAt - fromOffset;

    trackDataRef.current.forEach((t) => {
      if (fromOffset >= t.buffer.duration) return;
      const src = ctx.createBufferSource();
      src.buffer = t.buffer;
      src.connect(t.gainNode);
      src.start(startAt, fromOffset);
      t.sourceNode = src;
    });

    setPlaying(true);
    playingRef.current = true;

    timerRef.current = setInterval(() => {
      if (!playingRef.current) return;
      const elapsed = audioCtxRef.current.currentTime - startTimeRef.current;
      const clamped = Math.min(elapsed, durationRef.current);
      setCurrentTime(clamped);
      if (elapsed >= durationRef.current) stopAll();
    }, 50);
  };

  const play = async () => {
    const ctx = audioCtxRef.current;
    if (ctx.state === "suspended") await ctx.resume();
    startPlayback(offsetRef.current);
  };

  const pause = () => {
    clearInterval(timerRef.current);
    const elapsed = audioCtxRef.current.currentTime - startTimeRef.current;
    offsetRef.current = Math.min(Math.max(elapsed, 0), durationRef.current);
    stopSources();
    setPlaying(false);
    playingRef.current = false;
  };

  const stopAll = () => {
    clearInterval(timerRef.current);
    stopSources();
    offsetRef.current = 0;
    setCurrentTime(0);
    setPlaying(false);
    playingRef.current = false;
  };

  const togglePlay = () => { if (playing) pause(); else play(); };

  const seek = (time) => {
    const wasPlaying = playingRef.current;
    if (wasPlaying) { clearInterval(timerRef.current); stopSources(); playingRef.current = false; setPlaying(false); }
    offsetRef.current = time;
    setCurrentTime(time);
    if (wasPlaying) startPlayback(time);
  };

  const recalcGains = (states) => {
    const anySoloed = states.some((t) => t.soloed);
    states.forEach((t, i) => {
      const active = anySoloed ? t.soloed : !t.muted;
      trackDataRef.current[i].gainNode.gain.value = active ? t.volume : 0;
    });
  };

  const setTrackVolume = (i, v) => {
    setTrackStates((prev) => {
      const next = prev.map((t, j) => (j === i ? { ...t, volume: v } : t));
      const anySoloed = next.some((t) => t.soloed);
      const active = anySoloed ? next[i].soloed : !next[i].muted;
      if (active) trackDataRef.current[i].gainNode.gain.value = v;
      return next;
    });
  };

  const toggleMute = (i) => {
    setTrackStates((prev) => {
      const next = prev.map((t, j) => (j === i ? { ...t, muted: !t.muted } : t));
      recalcGains(next);
      return next;
    });
  };

  const toggleSolo = (i) => {
    setTrackStates((prev) => {
      const next = prev.map((t, j) => (j === i ? { ...t, soloed: !t.soloed } : t));
      recalcGains(next);
      return next;
    });
  };

  const setTrackPan = (i, v) => {
    trackDataRef.current[i].pannerNode.pan.value = v;
    setTrackStates((prev) => prev.map((t, j) => (j === i ? { ...t, pan: v } : t)));
  };

  const setMasterVol = (v) => {
    masterGainRef.current.gain.value = v;
    setMasterVolume(v);
  };

  const isSetlist = setlistSongs && setlistSongs.length > 1;

  return (
    <div className="fixed inset-0 bg-gray-950 z-50 flex flex-col overflow-hidden">

      {/* Header */}
      <div className="flex items-center justify-between px-4 py-2.5 border-b border-gray-800 shrink-0">
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="w-7 h-7 rounded-lg bg-indigo-600 flex items-center justify-center shrink-0">
            <span className="text-white text-[10px] font-bold select-none">MT</span>
          </div>
          <div className="min-w-0">
            <p className="text-white font-semibold text-sm truncate max-w-[160px] sm:max-w-sm leading-tight">
              {folderName}
            </p>
            {isSetlist && (
              <p className="text-indigo-400 text-[10px] leading-tight">
                {songIndex + 1} / {setlistSongs.length} · Setlist
              </p>
            )}
          </div>
        </div>
        <div className="flex items-center gap-1 shrink-0">
          {isSetlist && (
            <button
              onClick={() => setShowSetlist((v) => !v)}
              title="Ver setlist"
              className={`p-1.5 rounded-lg transition ${showSetlist ? "bg-indigo-600 text-white" : "text-gray-400 hover:text-white hover:bg-gray-800"}`}
            >
              <ListMusic size={17} />
            </button>
          )}
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-white transition p-1.5 rounded-lg hover:bg-gray-800"
          >
            <X size={18} />
          </button>
        </div>
      </div>

      {/* Loading */}
      {loading && (
        <div className="flex-1 flex flex-col items-center justify-center gap-5">
          <Loader2 size={34} className="animate-spin text-indigo-400" />
          <div className="text-center">
            <p className="text-gray-300 text-sm mb-1">Cargando tracks…</p>
            <p className="text-gray-500 text-xs mb-4 max-w-[220px] truncate">{loadingTrack}</p>
            <div className="w-64 bg-gray-800 rounded-full h-1.5">
              <div className="bg-indigo-500 h-1.5 rounded-full transition-all duration-300" style={{ width: `${loadingProgress}%` }} />
            </div>
            <p className="text-gray-600 text-xs mt-2">{loadingProgress}%</p>
          </div>
        </div>
      )}

      {/* Error */}
      {error && (
        <div className="flex-1 flex flex-col items-center justify-center gap-4 px-6">
          <p className="text-red-400 text-sm text-center">{error}</p>
          <button onClick={onClose} className="text-gray-400 hover:text-white text-sm underline underline-offset-2">Cerrar</button>
        </div>
      )}

      {/* Mixer + Transport */}
      {!loading && !error && (
        <>
          {/* Panel setlist — lateral derecho, no tapa los faders */}
          {showSetlist && isSetlist && (
            <div className="absolute right-0 top-0 bottom-0 z-10 w-56 bg-gray-900 border-l border-gray-700 flex flex-col shadow-2xl">
              <div className="flex items-center justify-between px-3 py-2.5 border-b border-gray-700 shrink-0">
                <p className="text-white font-semibold text-xs tracking-wide">SETLIST</p>
                <button onClick={() => setShowSetlist(false)} className="text-gray-400 hover:text-white p-1"><X size={15} /></button>
              </div>
              <div className="flex-1 overflow-y-auto py-1">
                {setlistSongs.map((song, idx) => (
                  <button
                    key={idx}
                    onClick={() => {
                      setShowSetlist(false);
                      const delta = idx - songIndex;
                      if (delta < 0 && onPrevSong) onPrevSong(-delta);
                      else if (delta > 0 && onNextSong) onNextSong(delta);
                    }}
                    className={`w-full flex items-center gap-2 px-3 py-2.5 text-left transition ${
                      idx === songIndex ? "bg-indigo-600/25 text-indigo-300" : "hover:bg-gray-800 text-gray-300"
                    }`}
                  >
                    <span className={`text-[10px] w-4 text-center tabular-nums shrink-0 ${idx === songIndex ? "text-indigo-400" : "text-gray-600"}`}>{idx + 1}</span>
                    <span className="flex-1 text-xs truncate">{song.name}</span>
                    {song.cached && <span className="text-[10px] text-green-500 shrink-0">✓</span>}
                    {song.caching && <Loader2 size={10} className="animate-spin text-indigo-400 shrink-0" />}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* ── MIXER VERTICAL ── */}
          <div className="flex-1 overflow-x-auto overflow-y-hidden" style={{ minHeight: 0 }}>
            <div className="flex h-full px-2 pt-3 pb-1" style={{ minWidth: "max-content" }}>

              {trackStates.map((t, i) => {
                const color = TRACK_COLORS[i % TRACK_COLORS.length];
                const anySoloed = trackStates.some((ts) => ts.soloed);
                const isActive = anySoloed ? t.soloed : !t.muted;

                return (
                  <div
                    key={i}
                    className={`flex flex-col items-center gap-1.5 px-2 border-r border-gray-800 last:border-r-0 transition-opacity`}
                    style={{ width: 68, minWidth: 68, opacity: isActive ? 1 : 0.28 }}
                  >
                    {/* Top color bar */}
                    <div className="w-10 h-0.5 rounded-full" style={{ backgroundColor: color }} />

                    {/* Name */}
                    <div className="h-9 flex items-center justify-center px-0.5 w-full">
                      <p
                        className="text-[10px] text-gray-300 font-medium text-center leading-tight break-words"
                        title={t.name}
                        style={{ wordBreak: "break-all", hyphens: "auto" }}
                      >
                        {t.name.length > 14 ? t.name.slice(0, 13) + "…" : t.name}
                      </p>
                    </div>

                    {/* Vertical fader */}
                    <div className="flex-1 flex items-center justify-center w-full py-1 relative" style={{ minHeight: 100 }}>
                      {/* Track bg */}
                      <div className="absolute w-1.5 rounded-full bg-gray-700 top-2 bottom-2 left-1/2 -translate-x-1/2" />
                      {/* Fill */}
                      <div
                        className="absolute w-1.5 rounded-full left-1/2 -translate-x-1/2 bottom-2 transition-none"
                        style={{ backgroundColor: color, opacity: 0.75, height: `calc(${t.volume * 100}% - 16px)` }}
                      />
                      {/* Thumb knob visual */}
                      <div
                        className="absolute w-5 h-3.5 rounded bg-gray-300 left-1/2 -translate-x-1/2 shadow-md"
                        style={{ bottom: `calc(${t.volume * 100}% - 16px - 7px + 2px)` }}
                      />
                      <input
                        type="range"
                        min={0}
                        max={1}
                        step={0.01}
                        value={t.volume}
                        onChange={(e) => setTrackVolume(i, parseFloat(e.target.value))}
                        className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                        style={{ writingMode: "vertical-lr", direction: "rtl", WebkitAppearance: "slider-vertical" }}
                      />
                    </div>

                    {/* Volume % */}
                    <span className="text-gray-500 text-[10px] tabular-nums">{Math.round(t.volume * 100)}</span>

                    {/* M button */}
                    <button
                      onClick={() => toggleMute(i)}
                      className={`w-full py-1 rounded text-[10px] font-bold transition select-none ${
                        t.muted ? "bg-red-500 text-white" : "bg-gray-800 text-gray-500 hover:text-gray-300 hover:bg-gray-700"
                      }`}
                    >M</button>

                    {/* S button */}
                    <button
                      onClick={() => toggleSolo(i)}
                      className={`w-full py-1 rounded text-[10px] font-bold transition select-none ${
                        t.soloed ? "bg-yellow-400 text-gray-900" : "bg-gray-800 text-gray-500 hover:text-gray-300 hover:bg-gray-700"
                      }`}
                    >S</button>

                    {/* Pan label */}
                    <span className="text-gray-500 text-[10px] tabular-nums mt-1">
                      {t.pan < -0.04 ? `L${Math.round(-t.pan * 100)}` : t.pan > 0.04 ? `R${Math.round(t.pan * 100)}` : "C"}
                    </span>

                    {/* Pan slider horizontal — doble clic para centrar */}
                    <div className="w-full relative mb-1" title="Balance (doble clic = centro)">
                      <div className="absolute top-1/2 left-0 right-0 h-px bg-gray-700 -translate-y-1/2 pointer-events-none" />
                      <div className="absolute top-1/2 left-1/2 w-px h-2 bg-gray-600 -translate-x-1/2 -translate-y-1/2 pointer-events-none" />
                      <input
                        type="range"
                        min={-1}
                        max={1}
                        step={0.02}
                        value={t.pan}
                        onChange={(e) => setTrackPan(i, parseFloat(e.target.value))}
                        onDoubleClick={() => setTrackPan(i, 0)}
                        className="w-full h-4 opacity-100 cursor-pointer relative"
                        style={{ accentColor: color }}
                      />
                    </div>
                  </div>
                );
              })}

              {/* Master channel */}
              <div
                className="flex flex-col items-center gap-1.5 px-2 border-l-2 border-gray-600 ml-1"
                style={{ width: 68, minWidth: 68 }}
              >
                <div className="w-10 h-0.5 rounded-full bg-indigo-500" />
                <div className="h-9 flex items-center justify-center">
                  <p className="text-[10px] text-indigo-400 font-bold tracking-widest text-center">MSTR</p>
                </div>
                <div className="flex-1 flex items-center justify-center w-full py-1 relative" style={{ minHeight: 100 }}>
                  <div className="absolute w-1.5 rounded-full bg-gray-700 top-2 bottom-2 left-1/2 -translate-x-1/2" />
                  <div
                    className="absolute w-1.5 rounded-full left-1/2 -translate-x-1/2 bottom-2 bg-indigo-500 transition-none"
                    style={{ opacity: 0.8, height: `calc(${masterVolume * 100}% - 16px)` }}
                  />
                  <div
                    className="absolute w-5 h-3.5 rounded bg-indigo-200 left-1/2 -translate-x-1/2 shadow-md"
                    style={{ bottom: `calc(${masterVolume * 100}% - 16px - 7px + 2px)` }}
                  />
                  <input
                    type="range"
                    min={0}
                    max={1}
                    step={0.01}
                    value={masterVolume}
                    onChange={(e) => setMasterVol(parseFloat(e.target.value))}
                    className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                    style={{ writingMode: "vertical-lr", direction: "rtl", WebkitAppearance: "slider-vertical" }}
                  />
                </div>
                <span className="text-gray-500 text-[10px] tabular-nums">{Math.round(masterVolume * 100)}</span>
                <div className="w-full h-6 mb-1" />
              </div>
            </div>
          </div>

          {/* Transport bar */}
          <div className="bg-gray-900 border-t border-gray-800 px-4 pt-2.5 pb-4 shrink-0">
            <div className="flex items-center gap-2 mb-3">
              <span className="text-gray-500 text-[11px] w-9 shrink-0 tabular-nums">{fmt(currentTime)}</span>
              <input
                type="range" min={0} max={duration || 0} step={0.1} value={currentTime}
                onChange={(e) => seek(parseFloat(e.target.value))}
                className="flex-1 h-1 cursor-pointer accent-indigo-500"
              />
              <span className="text-gray-500 text-[11px] w-9 text-right shrink-0 tabular-nums">{fmt(duration)}</span>
            </div>

            <div className="flex items-center justify-center gap-3">
              {isSetlist && (
                <button
                  onClick={() => onPrevSong && onPrevSong(1)}
                  disabled={songIndex === 0}
                  className="w-9 h-9 rounded-lg bg-gray-800 hover:bg-gray-700 text-gray-400 hover:text-white flex items-center justify-center transition disabled:opacity-30"
                >
                  <SkipBack size={16} />
                </button>
              )}
              <button
                onClick={stopAll}
                className="w-9 h-9 rounded-lg bg-gray-800 hover:bg-gray-700 text-gray-400 hover:text-white flex items-center justify-center transition"
              >
                <Square size={14} fill="currentColor" />
              </button>
              <button
                onClick={togglePlay}
                className="w-14 h-14 rounded-2xl bg-indigo-600 hover:bg-indigo-500 text-white flex items-center justify-center transition shadow-lg shadow-indigo-600/30"
              >
                {playing ? <Pause size={24} /> : <Play size={24} />}
              </button>
              {isSetlist && (
                <button
                  onClick={() => onNextSong && onNextSong(1)}
                  disabled={songIndex === setlistSongs.length - 1}
                  className="w-9 h-9 rounded-lg bg-gray-800 hover:bg-gray-700 text-gray-400 hover:text-white flex items-center justify-center transition disabled:opacity-30"
                >
                  <SkipForward size={16} />
                </button>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
