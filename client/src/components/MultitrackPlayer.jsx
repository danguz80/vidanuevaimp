import React, { useEffect, useRef, useState, useCallback } from "react";
import { X, Play, Pause, Square, Volume2, Loader2, SkipBack, SkipForward, ListMusic, Pencil } from "lucide-react";
import { SoundTouch, SimpleFilter, WebAudioBufferSource, getWebAudioNode } from 'soundtouchjs';
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
  folderId = null,          // Drive folder ID — para cargar pista de guías
  onClose,
  getToken,
  setlistSongs = null,
  songIndex = null,
  onPrevSong = null,
  onNextSong = null,
  // Pre-carga de canciones siguientes (pasado desde BibliotecaMusica)
  nextSongsTracks = null, // [[track,...], [track,...]] de las próximas canciones
  onSwitchToEditor = null, // callback para cambiar a Modo Edición
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

  // ── Info canción (del editor de guías) ──
  const [songBpm, setSongBpm] = useState(0);
  const [songKey, setSongKey] = useState('');
  const [beatsPerBar, setBeatsPerBar] = useState(4);
  const [playBpm, setPlayBpm] = useState(0);
  const [playSemitones, setPlaySemitones] = useState(0);
  const [processing, setProcessing] = useState(false);
  // ── Metrónomo DAW ──
  const [metroEnabled, setMetroEnabled] = useState(false);
  const [metroVolume, setMetroVolume] = useState(2);
  const [metroPan, setMetroPan] = useState(-1);

  // ── Pista de Guías ──
  const [guiasClips, setGuiasClips] = useState([]); // clips guardados en DB
  const [guiasTrackRegions, setGuiasTrackRegions] = useState({}); // cortes/eliminaciones por fileId
  const [guiasVolume, setGuiasVolume] = useState(1);
  const [guiasMuted, setGuiasMuted] = useState(false);
  const [guiasSoloed, setGuiasSoloed] = useState(false);
  const [guiasPan, setGuiasPan] = useState(-1); // izquierda por defecto
  // Cada clip tiene: { id, fileId, fileName, startTime, duration }
  // Al reproducir se programan BufferSources por cada región activa del clip
  const guiasDataRef = useRef([]); // [{ fileId, buffer, regions, startTime, sourceNode }]
  const guiasGainRef = useRef(null);
  const guiasPannerRef = useRef(null);
  // ── Pitch/Tempo + Metro refs ──
  const originalBuffersRef = useRef(new Map()); // fileId → AudioBuffer sin procesar
  const metroGainRef = useRef(null);
  const metroPannerRef = useRef(null);
  const metroSchedulerRef = useRef(null);   // setTimeout ID del scheduler
  const metroNodesRef = useRef([]);          // OscillatorNodes activos del metro
  const metroNextBeatTimeRef = useRef(0);    // ctx time del próximo beat a programar
  const metroNextBeatIndexRef = useRef(0);   // índice del próximo beat (para downbeat)
  const processingIdRef = useRef(0);
  const loadTracksIdRef = useRef(0);          // cancelación de loadTracks obsoletas (StrictMode / cambio rápido)
  const soundTouchLatencyRef = useRef(-1);   // samples de latencia de arranque SoundTouch (medido una vez)
  const currentAudioBpmRef = useRef(0);      // BPM del buffer actualmente cargado (0 = original sin procesar)
  const songBpmRef = useRef(0);
  const playBpmRef = useRef(0);
  const playSemitonesRef = useRef(0);
  const beatsPerBarRef = useRef(4);
  const metroEnabledRef = useRef(false);
  const metroVolumeRef = useRef(2);
  const metroPanRef = useRef(-1);

  const audioCtxRef = useRef(null);
  const masterGainRef = useRef(null);
  const trackDataRef = useRef([]);
  const savedTrackRegionsRef = useRef({}); // trackRegions de las pistas, accesible sin closure stale
  const startTimeRef = useRef(0);
  const offsetRef = useRef(0);
  const playingRef = useRef(false);
  const timerRef = useRef(null);
  const durationRef = useRef(0);
  const folderNameRef = useRef(folderName);
  useEffect(() => { folderNameRef.current = folderName; }, [folderName]);

  const loadTracks = useCallback(async (trackList) => {
    const myId = ++loadTracksIdRef.current;
    const name = folderNameRef.current || '';
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

    // ── Parsear BPM/Key/Beats desde el nombre de carpeta ──
    // Formato: "Nombre - Key - 127bpm - 4:4"
    {
      const segments = (name || '').split(/\s*[-\u2013\u2014|]\s*/);
      let foundBpm = 0, foundKey = '', foundBpb = 0;
      for (const seg of segments) {
        const s = seg.trim();
        if (!foundBpm) { const m = s.match(/^(\d+)\s*bpm$/i) || s.match(/(\d+)\s*bpm/i); if (m) foundBpm = parseFloat(m[1]); }
        if (!foundKey) { const m = s.match(/^([A-G][#b]?(?:m(?:aj|in)?|maj|min)?)$/i); if (m) foundKey = m[1]; }
        if (!foundBpb) { const m = s.match(/^(\d)\s*[\/:.]\s*4$/); if (m) foundBpb = parseInt(m[1]); }
      }
      if (!foundBpm) { const m = (name||'').match(/(\d+)\s*bpm/i); if (m) foundBpm = parseFloat(m[1]); }
      if (!foundKey) { const m = (name||'').match(/\b([A-G][#b]?(?:m(?:aj|in)?|maj|min)?)\b/); if (m) foundKey = m[1]; }
      if (!foundBpb) { const m = (name||'').match(/(\d)\s*[\/:.]\s*4/); if (m) foundBpb = parseInt(m[1]); }
      if (foundBpm > 0) { setSongBpm(foundBpm); setPlayBpm(foundBpm); songBpmRef.current = foundBpm; playBpmRef.current = foundBpm; }
      else { setSongBpm(0); setPlayBpm(0); songBpmRef.current = 0; playBpmRef.current = 0; }
      if (foundKey) setSongKey(foundKey); else setSongKey('');
      if (foundBpb > 0) { setBeatsPerBar(foundBpb); beatsPerBarRef.current = foundBpb; } else { setBeatsPerBar(4); beatsPerBarRef.current = 4; }
    }

    audioCtxRef.current?.close().catch(() => {});
    originalBuffersRef.current = new Map();
    soundTouchLatencyRef.current = -1;   // re-medir al próximo processBuffers
    currentAudioBpmRef.current = 0;      // reiniciar: los buffers cargados son el original
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    audioCtxRef.current = ctx;

    const masterGain = ctx.createGain();
    masterGain.gain.value = masterVolume;
    masterGain.connect(ctx.destination);
    masterGainRef.current = masterGain;

    // Gain + Panner para la pista de guías (independiente del master)
    const guiasGain = ctx.createGain();
    guiasGain.gain.value = guiasVolume * 6.0;
    const guiasPanner = ctx.createStereoPanner();
    guiasPanner.pan.value = -1; // izquierda por defecto
    guiasGain.connect(guiasPanner);
    guiasPanner.connect(masterGain);
    guiasGainRef.current = guiasGain;
    guiasPannerRef.current = guiasPanner;

    // Gain + Panner para metrónomo DAW (izquierda por defecto)
    const metroGain = ctx.createGain();
    metroGain.gain.value = metroVolumeRef.current;
    const metroPanner = ctx.createStereoPanner();
    metroPanner.pan.value = metroPanRef.current;
    metroGain.connect(metroPanner);
    metroPanner.connect(masterGain);
    metroGainRef.current = metroGain;
    metroPannerRef.current = metroPanner;

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
        originalBuffersRef.current.set(fileId, buffer); // guardar original
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

      // Orden: vocals → backing vocals → [resto] → metro → (Guías es canal aparte, siempre al final)
      const isMetro   = (name) => /\b(metro(nome)?|click|clic|clave|beat|tempo|drum\s*machine)\b/i.test(name);
      const isVocal   = (name) => /\bvocals?\b|\bvocales\b|\bvoz\b|\blead\b/i.test(name) && !/backing|bg[\s_-]?vocals?|bv\d?\b/i.test(name);
      const isBacking = (name) => /\b(backing[\s_-]?vocals?|bg[\s_-]?vocals?|bv\d?|coro)\b/i.test(name);

      const sortPriority = (name) => {
        if (isVocal(name))   return 0;  // primero
        if (isBacking(name)) return 1;  // segundo
        if (isMetro(name))   return 99; // penúltimo (antes de Guías)
        return 50; // todo lo demás en el medio
      };

      loaded.sort((a, b) => {
        const diff = sortPriority(a.name) - sortPriority(b.name);
        return diff !== 0 ? diff : a._idx - b._idx;
      });
      loaded.forEach((t) => delete t._idx);

      // Si una llamada más nueva ya tomó el control, descartar esta (StrictMode / cambio rápido)
      if (loadTracksIdRef.current !== myId) return;

      trackDataRef.current = loaded;
      const maxDur = Math.max(...loaded.map((t) => t.buffer.duration));
      durationRef.current = maxDur;
      setDuration(maxDur);

      // Auto-pan: metro/click → izquierda (-1), todos los demás → derecha (+1)
      const initialStates = loaded.map((t) => {
        const pan = isMetro(t.name) ? -1 : 1;
        t.pannerNode.pan.value = pan;
        return { name: t.name, volume: 1, muted: false, soloed: false, pan };
      });
      setTrackStates(initialStates);
      setLoading(false);
    } catch (e) {
      if (loadTracksIdRef.current === myId) {
        setError(e.message);
        setLoading(false);
      }
    }
  }, [getToken]);

  useEffect(() => {
    loadTracks(tracks);
    return () => {
      clearInterval(timerRef.current);
      trackDataRef.current.forEach((t) => { try { t.sourceNode?.stop(); } catch {} });
      guiasDataRef.current.forEach((g) => { try { g.sourceNode?.stop(); } catch {} });
      audioCtxRef.current?.close().catch(() => {});
    };
  }, [tracks, folderName]);

  // Cargar clips de guías desde la DB cuando folderId esté disponible y loading termine
  useEffect(() => {
    if (!folderId || !getToken) return;
    fetch(`${API_URL}/api/musica/guias/${encodeURIComponent(folderId)}`, {
      headers: { Authorization: `Bearer ${getToken()}` },
    })
      .then(r => r.json())
      .then(data => {
        if (Array.isArray(data.clips) && data.clips.length > 0) {
          setGuiasClips(data.clips);
        }
        if (data.trackRegions && typeof data.trackRegions === 'object') {
          setGuiasTrackRegions(data.trackRegions);
          savedTrackRegionsRef.current = data.trackRegions;
        }

        // DB solo aplica si el folderName NO tenía el dato (no sobreescribir el nombre de carpeta)
        if (data.bpm && parseFloat(data.bpm) > 0 && songBpmRef.current === 0) {
          const bpm = parseFloat(data.bpm);
          setSongBpm(bpm); setPlayBpm(bpm);
          songBpmRef.current = bpm; playBpmRef.current = bpm; currentAudioBpmRef.current = bpm;
        }
        if (data.beatsPerBar && beatsPerBarRef.current === 4) {
          const bpb = parseInt(data.beatsPerBar);
          setBeatsPerBar(bpb); beatsPerBarRef.current = bpb;
        }
        if (data.key && !songKey) setSongKey(data.key);
      })
      .catch(() => {});
  }, [folderId, getToken]);

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

  // Cargar y decodificar buffers de los clips de guías cuando estén disponibles
  useEffect(() => {
    if (!guiasClips.length || loading) return;
    const ctx = audioCtxRef.current;
    if (!ctx) return;
    let cancelled = false;

    (async () => {
      const loaded = [];
      for (const clip of guiasClips) {
        if (cancelled) break;
        try {
          let ab;
          if (bufferCache.has(clip.fileId)) {
            ab = bufferCache.get(clip.fileId).slice(0);
          } else {
            const idbData = await idbGet(clip.fileId);
            if (idbData) {
              bufferCache.set(clip.fileId, idbData);
              ab = idbData.slice(0);
            } else {
              const r = await fetch(`${API_URL}/api/musica/stream/${clip.fileId}`, {
                headers: { Authorization: `Bearer ${getToken()}` },
              });
              if (!r.ok) continue;
              ab = await r.arrayBuffer();
              bufferCache.set(clip.fileId, ab.slice(0));
              idbSet(clip.fileId, ab.slice(0));
            }
          }
          if (cancelled) break;
          const buffer = await ctx.decodeAudioData(ab);
          // Los clips de guía se reproducen completos desde su startTime
          loaded.push({ fileId: clip.fileId, buffer, startTime: clip.startTime, sourceNode: null });
        } catch (e) {
          console.warn("[GuíasPlayer] Error cargando clip:", clip.fileId, e.message);
        }
      }
      if (!cancelled) guiasDataRef.current = loaded;
    })();

    return () => { cancelled = true; };
  }, [guiasClips, loading, getToken]);

  // ── Transponer tonalidad ──
  const KEY_SHARPS = ['C','C#','D','D#','E','F','F#','G','G#','A','A#','B'];
  const FLATS_MAP  = {'Db':1,'Eb':3,'Gb':6,'Ab':8,'Bb':10};
  const transposeKey = (key, semitones) => {
    if (!key || semitones === 0) return key;
    const norm = key.trim();
    let rootIdx = KEY_SHARPS.indexOf(norm.slice(0,2));
    let rootLen = rootIdx !== -1 ? 2 : 0;
    if (rootIdx === -1) { rootIdx = KEY_SHARPS.indexOf(norm.slice(0,1)); rootLen = rootIdx !== -1 ? 1 : 0; }
    if (rootIdx === -1 && FLATS_MAP[norm.slice(0,2)] !== undefined) { rootIdx = FLATS_MAP[norm.slice(0,2)]; rootLen = 2; }
    if (rootIdx === -1) return key;
    return KEY_SHARPS[((rootIdx + semitones) % 12 + 12) % 12] + norm.slice(rootLen);
  };

  // ── Metrónomo schedulado (patrón Web Audio preciso, inmune a latencia de buffer) ──
  const stopMetroScheduler = () => {
    if (metroSchedulerRef.current) { clearTimeout(metroSchedulerRef.current); metroSchedulerRef.current = null; }
    metroNodesRef.current.forEach(n => { try { n.stop(); } catch {} });
    metroNodesRef.current = [];
  };

  const scheduleMetroBeats = () => {
    const ctx = audioCtxRef.current;
    if (!ctx || ctx.state === 'closed' || !metroEnabledRef.current || !playingRef.current || !playBpmRef.current || !metroGainRef.current) return;
    const beatInterval = 60 / playBpmRef.current;
    const scheduleAhead = 0.15; // 150ms lookahead

    while (metroNextBeatTimeRef.current < ctx.currentTime + scheduleAhead) {
      const beatTime = metroNextBeatTimeRef.current;
      const beatIndex = metroNextBeatIndexRef.current;

      if (beatTime >= ctx.currentTime - 0.01) {
        const isDown = (beatIndex % beatsPerBarRef.current) === 0;
        const freq = isDown ? 1600 : 900;
        const amp  = isDown ? 0.9  : 0.55;

        const osc = ctx.createOscillator();
        const env = ctx.createGain();
        osc.type = 'sine';
        osc.frequency.value = freq;
        env.gain.setValueAtTime(0, beatTime);
        env.gain.setValueAtTime(amp, beatTime);
        env.gain.exponentialRampToValueAtTime(0.001, beatTime + 0.035);
        osc.connect(env);
        env.connect(metroGainRef.current);
        osc.start(beatTime);
        osc.stop(beatTime + 0.04);
        metroNodesRef.current.push(osc);
      }

      metroNextBeatTimeRef.current += beatInterval;
      metroNextBeatIndexRef.current += 1;
    }

    // Limpiar nodos terminados
    metroNodesRef.current = metroNodesRef.current.filter(n => {
      try { return n.playbackState !== n.FINISHED_STATE; } catch { return false; }
    });

    metroSchedulerRef.current = setTimeout(scheduleMetroBeats, 25);
  };

  const startMetroScheduler = (fromOffset, startAt) => {
    stopMetroScheduler();
    if (!metroEnabledRef.current || !playBpmRef.current || !metroGainRef.current) return;
    const beatInterval = 60 / playBpmRef.current;
    // Beat más cercano mayor o igual a fromOffset
    const firstBeatIdx = Math.round(fromOffset / beatInterval);
    const firstBeatOffset = firstBeatIdx * beatInterval;
    const adjustedIdx = firstBeatOffset < fromOffset - 0.001 ? firstBeatIdx + 1 : firstBeatIdx;
    const adjustedOffset = adjustedIdx * beatInterval;

    metroNextBeatTimeRef.current = startAt + (adjustedOffset - fromOffset);
    metroNextBeatIndexRef.current = adjustedIdx;
    scheduleMetroBeats();
  };

  // ── Mide latencia de arranque de SoundTouch (ejecutar una sola vez) ──
  const measureSoundTouchLatency = async () => {
    const ctx = audioCtxRef.current;
    if (!ctx) return 0;
    const sr = ctx.sampleRate;
    const inputLen = Math.ceil(0.5 * sr); // 0.5s de señal
    const inputBuf = ctx.createBuffer(2, inputLen, sr);
    for (let c = 0; c < 2; c++) {
      const d = inputBuf.getChannelData(c);
      for (let i = 0; i < inputLen; i++) d[i] = 0.5 * Math.sin(2 * Math.PI * 440 * i / sr);
    }
    const offCtx = new OfflineAudioContext(2, inputLen + sr, sr);
    const st = new SoundTouch();
    st.tempo = 1; st.pitchSemitones = 0;
    const filter = new SimpleFilter(new WebAudioBufferSource(inputBuf), st);
    const node = getWebAudioNode(offCtx, filter);
    node.connect(offCtx.destination);
    const rendered = await offCtx.startRendering();
    const ch = rendered.getChannelData(0);
    for (let i = 0; i < ch.length; i++) {
      if (Math.abs(ch[i]) > 0.001) return i;
    }
    return 0;
  };

  // ── Recorta samples del inicio de un AudioBuffer ──
  const trimBuffer = (buffer, trimSamples) => {
    if (trimSamples <= 0) return buffer;
    const ctx = audioCtxRef.current;
    const newLen = buffer.length - trimSamples;
    if (newLen <= 0) return buffer;
    const trimmed = ctx.createBuffer(buffer.numberOfChannels, newLen, buffer.sampleRate);
    for (let c = 0; c < buffer.numberOfChannels; c++) {
      trimmed.getChannelData(c).set(buffer.getChannelData(c).subarray(trimSamples));
    }
    return trimmed;
  };

  // ── Time-stretch + Pitch-shift con SoundTouch vía OfflineAudioContext ──
  const renderWithSoundTouch = (origBuf, tempoRatio, semitones) => {
    const sampleRate = origBuf.sampleRate;
    // Duración de salida: ajustada por tempo + 1s de colchón para latencia SoundTouch
    const outputLength = Math.ceil(origBuf.length / tempoRatio) + sampleRate;
    const offCtx = new OfflineAudioContext(2, outputLength, sampleRate);
    const st = new SoundTouch();
    st.tempo = tempoRatio;
    st.pitchSemitones = semitones;
    const waSrc = new WebAudioBufferSource(origBuf);
    const filter = new SimpleFilter(waSrc, st);
    const node = getWebAudioNode(offCtx, filter);
    node.connect(offCtx.destination);
    return offCtx.startRendering();
  };

  const processBuffers = async (newBpm, semitones) => {
    const ctx = audioCtxRef.current;
    if (!ctx) return;
    const myId = ++processingIdRef.current;
    const origBpm = songBpmRef.current;
    const tempoRatio = (origBpm > 0 && newBpm > 0) ? newBpm / origBpm : 1;
    const identity = Math.abs(tempoRatio - 1) < 0.001 && Math.abs(semitones) < 0.01;

    // Invariante: currentAudioBpmRef siempre refleja el BPM en que está expresado offsetRef.
    // Se actualiza de forma EAGER (antes del render) para que llamadas rápidas encadenadas escalen bien.
    const prevAudioBpm = currentAudioBpmRef.current || origBpm;

    // ── Helper: escala el offset del dominio prevAudioBpm → targetBpm ──
    const scaleOffset = (rawOffset, fromBpm, toBpm) =>
      (fromBpm > 0 && toBpm > 0 && fromBpm !== toBpm) ? rawOffset * fromBpm / toBpm : rawOffset;

    if (identity) {
      originalBuffersRef.current.forEach((buf, fileId) => {
        const t = trackDataRef.current.find(t => t.id === fileId);
        if (t) t.buffer = buf;
      });
      const origDur = trackDataRef.current.reduce((max, t) => t.buffer ? Math.max(max, t.buffer.duration) : max, 0);
      if (origDur > 0) { durationRef.current = origDur; setDuration(origDur); }
      if (playingRef.current) {
        const elapsed = ctx.currentTime - startTimeRef.current;
        clearInterval(timerRef.current); stopSources();
        offsetRef.current = Math.max(0, scaleOffset(elapsed, prevAudioBpm, origBpm));
        playingRef.current = false; setPlaying(false);
      } else {
        offsetRef.current = Math.max(0, scaleOffset(offsetRef.current, prevAudioBpm, origBpm));
      }
      currentAudioBpmRef.current = origBpm;
      setProcessing(false);
      if (!playingRef.current) {
        await new Promise(r => setTimeout(r, 30));
        startPlayback(Math.min(offsetRef.current, durationRef.current));
      }
      return;
    }

    setProcessing(true);
    const wasPlaying = playingRef.current;
    if (wasPlaying) {
      const elapsed = ctx.currentTime - startTimeRef.current;
      clearInterval(timerRef.current); stopSources();
      // Escalar desde buffer actual → nuevo buffer
      offsetRef.current = Math.max(0, scaleOffset(elapsed, prevAudioBpm, newBpm));
      playingRef.current = false; setPlaying(false);
    } else {
      // No estaba reproduciendo (llamada anterior ya lo detuvo), pero offsetRef puede estar
      // en el dominio BPM de esa llamada anterior → escalar al dominio del nuevo BPM
      offsetRef.current = Math.max(0, scaleOffset(offsetRef.current, prevAudioBpm, newBpm));
    }
    // Actualizar AHORA para que llamadas rápidas subsiguientes usen el BPM correcto
    currentAudioBpmRef.current = newBpm;

    for (const track of trackDataRef.current) {
      if (myId !== processingIdRef.current) return;
      const origBuf = originalBuffersRef.current.get(track.id);
      if (!origBuf) continue;
      try {
        const rendered = await renderWithSoundTouch(origBuf, tempoRatio, semitones);
        if (myId !== processingIdRef.current) return;
        // Medir latencia SoundTouch una sola vez y recortar todos los buffers
        if (soundTouchLatencyRef.current < 0) {
          soundTouchLatencyRef.current = await measureSoundTouchLatency();
          if (myId !== processingIdRef.current) return;
        }
        track.buffer = trimBuffer(rendered, soundTouchLatencyRef.current);
      } catch (e) {
        console.warn('[SoundTouch] Render failed for', track.id, e);
      }
    }

    if (myId !== processingIdRef.current) return;

    // Actualizar duración y BPM actual del buffer
    const newDur = trackDataRef.current.reduce((max, t) => t.buffer ? Math.max(max, t.buffer.duration) : max, 0);
    if (newDur > 0) {
      durationRef.current = newDur;
      setDuration(newDur);
    }
    // currentAudioBpmRef ya se actualizó en la fase de stop (eager)

    setProcessing(false);
    if (wasPlaying) {
      if (ctx.state === 'suspended') await ctx.resume();
      await new Promise(r => setTimeout(r, 30));
      startPlayback(Math.min(offsetRef.current, durationRef.current));
    }
  };

  const handleBpmChange = (delta) => {
    const newBpm = Math.max(40, Math.min(240, (playBpm || songBpm) + delta));
    setPlayBpm(newBpm); playBpmRef.current = newBpm;
    processBuffers(newBpm, playSemitonesRef.current);
  };

  const handleSemitoneChange = (delta) => {
    const newSt = Math.max(-12, Math.min(12, playSemitones + delta));
    setPlaySemitones(newSt); playSemitonesRef.current = newSt;
    processBuffers(playBpmRef.current, newSt);
  };

  const stopSources = () => {
    trackDataRef.current.forEach((t) => {
      try { t.sourceNode?.stop(); } catch {}
      t.sourceNode = null;
    });
    // Detener clips de guías
    guiasDataRef.current.forEach((g) => {
      try { g.sourceNode?.stop(); } catch {}
      g.sourceNode = null;
    });
    // Detener metrónomo DAW (scheduler)
    stopMetroScheduler();
  };

  const startPlayback = (fromOffset) => {
    const ctx = audioCtxRef.current;
    const startAt = ctx.currentTime + 0.05;
    startTimeRef.current = startAt - fromOffset;

    // Reproducir pistas principales aplicando trackRegions (cortes/eliminaciones del editor)
    trackDataRef.current.forEach((t) => {
      const regs = savedTrackRegionsRef.current[t.id];
      if (regs && regs.length > 0) {
        // Pista editada: programar solo los segmentos activos
        regs.forEach(r => {
          if (fromOffset >= r.end) return;
          const fileOff   = r.fileOffset ?? r.start;
          const regDur    = r.end - r.start;
          const skipInReg = fromOffset > r.start ? fromOffset - r.start : 0;
          const bufOff    = fileOff + skipInReg;
          const segDur    = regDur - skipInReg;
          const delay     = r.start > fromOffset ? r.start - fromOffset : 0;
          if (segDur <= 0 || bufOff >= t.buffer.duration) return;
          const src = ctx.createBufferSource();
          src.buffer = t.buffer;
          src.connect(t.gainNode);
          src.start(startAt + delay, bufOff, Math.min(segDur, t.buffer.duration - bufOff));
          t.sourceNode = src;
        });
      } else {
        // Sin editar: reproducir completa
        if (fromOffset >= t.buffer.duration) return;
        const src = ctx.createBufferSource();
        src.buffer = t.buffer;
        src.connect(t.gainNode);
        src.start(startAt, fromOffset);
        t.sourceNode = src;
      }
    });

    // Reproducir clips de guías en sus posiciones (sin edición de regiones)
    guiasDataRef.current.forEach((g) => {
      if (!g.buffer) return;
      const clipEnd = g.startTime + g.buffer.duration;
      if (fromOffset >= clipEnd) return;
      const clipOffset = Math.max(0, fromOffset - g.startTime);
      const delay = g.startTime > fromOffset ? g.startTime - fromOffset : 0;
      const src = ctx.createBufferSource();
      src.buffer = g.buffer;
      src.connect(guiasGainRef.current);
      src.start(startAt + delay, clipOffset);
      g.sourceNode = src;
    });

    // Marcar como playing ANTES del scheduler (scheduleMetroBeats verifica playingRef)
    setPlaying(true);
    playingRef.current = true;

    // Metrónomo DAW: scheduler preciso basado en ctx.currentTime (inmune a latencia de buffer)
    if (metroEnabledRef.current && playBpmRef.current > 0 && metroGainRef.current) {
      startMetroScheduler(fromOffset, startAt);
    }

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

  const recalcGains = (states, nextGuiasSoloed = guiasSoloed, nextGuiasMuted = guiasMuted) => {
    const anySoloed = states.some((t) => t.soloed) || nextGuiasSoloed;
    states.forEach((t, i) => {
      const active = anySoloed ? t.soloed : !t.muted;
      trackDataRef.current[i].gainNode.gain.value = active ? t.volume : 0;
    });
    // Actualizar gain de guías
    const guiasActive = anySoloed ? nextGuiasSoloed : !nextGuiasMuted;
    if (guiasGainRef.current) guiasGainRef.current.gain.value = guiasActive ? guiasVolume * 6.0 : 0;
  };

  const toggleGuiasSolo = () => {
    const next = !guiasSoloed;
    setGuiasSoloed(next);
    recalcGains(trackStates, next, guiasMuted);
  };

  const setGuiasPanValue = (v) => {
    setGuiasPan(v);
    if (guiasPannerRef.current) guiasPannerRef.current.pan.value = v;
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
          {onSwitchToEditor && (
            <button
              onClick={onSwitchToEditor}
              title="Cambiar a Modo Edición"
              className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-emerald-700 hover:bg-emerald-600 text-white text-xs font-semibold transition shrink-0"
            >
              <Pencil size={13}/> Modo Edición
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
          {/* ── Barra BPM / Key / Metro ── */}
          {songBpm > 0 && (
            <div className="shrink-0 bg-gray-900 border-b border-gray-800 px-3 py-1.5 flex items-center gap-3 flex-wrap">
              {/* BPM */}
              <div className="flex items-center gap-1">
                <span className="text-gray-500 text-[10px] font-bold tracking-widest">BPM</span>
                <button onClick={() => handleBpmChange(-1)} className="w-5 h-5 rounded bg-gray-800 text-gray-400 hover:text-white hover:bg-gray-700 text-xs flex items-center justify-center select-none">−</button>
                <span className="text-white text-xs tabular-nums font-mono w-8 text-center">{playBpm || songBpm}</span>
                <button onClick={() => handleBpmChange(+1)} className="w-5 h-5 rounded bg-gray-800 text-gray-400 hover:text-white hover:bg-gray-700 text-xs flex items-center justify-center select-none">+</button>
                {(playBpm && playBpm !== songBpm) && (
                  <button onClick={() => { setPlayBpm(songBpm); playBpmRef.current = songBpm; processBuffers(songBpm, playSemitonesRef.current); }}
                    className="text-[10px] text-indigo-400 hover:text-indigo-300 ml-0.5" title="Restaurar BPM original">↺</button>
                )}
              </div>
              <div className="w-px h-4 bg-gray-700 shrink-0" />
              {/* Key */}
              {songKey && (
                <>
                  <div className="flex items-center gap-1">
                    <span className="text-gray-500 text-[10px] font-bold tracking-widest">KEY</span>
                    <button onClick={() => handleSemitoneChange(-1)} className="w-5 h-5 rounded bg-gray-800 text-gray-400 hover:text-white hover:bg-gray-700 text-xs flex items-center justify-center select-none">−</button>
                    <span className="text-white text-xs font-mono w-10 text-center">
                      {playSemitones !== 0
                        ? <>{songKey}<span className="text-gray-500 mx-0.5">→</span>{transposeKey(songKey, playSemitones)}</>
                        : songKey}
                    </span>
                    <button onClick={() => handleSemitoneChange(+1)} className="w-5 h-5 rounded bg-gray-800 text-gray-400 hover:text-white hover:bg-gray-700 text-xs flex items-center justify-center select-none">+</button>
                    {playSemitones !== 0 && (
                      <button onClick={() => { setPlaySemitones(0); playSemitonesRef.current = 0; processBuffers(playBpmRef.current, 0); }}
                        className="text-[10px] text-indigo-400 hover:text-indigo-300 ml-0.5" title="Restaurar tonalidad original">↺</button>
                    )}
                  </div>
                  <div className="w-px h-4 bg-gray-700 shrink-0" />
                </>
              )}
              {/* Beat */}
              <span className="text-gray-400 text-[11px] font-mono">{beatsPerBar}/4</span>
              <div className="w-px h-4 bg-gray-700 shrink-0" />
              {/* Metrónomo */}
              <div className="flex items-center gap-1.5">
                <button
                  onClick={() => {
                    const next = !metroEnabled;
                    setMetroEnabled(next);
                    metroEnabledRef.current = next;
                    if (!next) {
                      // Apagar en vivo: detener scheduler
                      stopMetroScheduler();
                    } else if (playingRef.current) {
                      // Encender en vivo: arrancar scheduler desde posición actual
                      const ctx = audioCtxRef.current;
                      if (ctx && playBpmRef.current > 0) {
                        const currentOffset = ctx.currentTime - startTimeRef.current;
                        startMetroScheduler(Math.max(0, currentOffset), ctx.currentTime + 0.02);
                      }
                    }
                  }}
                  className={`px-2 py-0.5 rounded text-[10px] font-bold transition select-none ${metroEnabled ? 'bg-emerald-600 text-white' : 'bg-gray-800 text-gray-500 hover:text-white hover:bg-gray-700'}`}
                >♩ METRO</button>
                {/* Volumen metro — siempre visible */}
                <input type="range" min={0} max={3} step={0.05} value={metroVolume}
                  onChange={(e) => {
                    const v = parseFloat(e.target.value);
                    setMetroVolume(v); metroVolumeRef.current = v;
                    if (metroGainRef.current) metroGainRef.current.gain.value = v;
                  }}
                  className="w-16 h-1 accent-emerald-500 cursor-pointer"
                />
                {/* Pan metro */}
                <button
                  onClick={() => {
                    const next = metroPan === -1 ? 0 : -1;
                    setMetroPan(next); metroPanRef.current = next;
                    if (metroPannerRef.current) metroPannerRef.current.pan.value = next;
                  }}
                  className={`text-[10px] font-bold rounded px-1.5 py-0.5 transition select-none ${metroPan === -1 ? 'bg-gray-700 text-white' : 'bg-emerald-600 text-white'}`}
                  title={metroPan === -1 ? 'Centrar metrónomo' : 'Metrónomo a la izquierda'}
                >{metroPan === -1 ? 'L' : 'C'}</button>
              </div>
              {/* Indicador de procesamiento */}
              {processing && (
                <div className="flex items-center gap-1 ml-auto">
                  <Loader2 size={11} className="animate-spin text-indigo-400" />
                  <span className="text-indigo-400 text-[10px]">Procesando…</span>
                </div>
              )}
            </div>
          )}

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
                const isMetroTrack   = /\b(metro(nome)?|click|clic|clave|beat|tempo|drum\s*machine)\b/i.test(t.name);
                const isVocalTrack   = /\bvocals?\b|\bvocales\b|\bvoz\b|\blead\b/i.test(t.name) && !/backing|bg[\s_-]?vocals?|bv\d?\b/i.test(t.name);
                const isBackingTrack = /\b(backing[\s_-]?vocals?|bg[\s_-]?vocals?|bv\d?|coro)\b/i.test(t.name);
                const cssOrder = isMetroTrack ? 999 : isVocalTrack ? 0 : isBackingTrack ? 1 : i + 10;

                return (
                  <div
                    key={i}
                    className={`flex flex-col items-center gap-1.5 px-2 border-r border-gray-800 last:border-r-0 transition-opacity`}
                    style={{ width: 68, minWidth: 68, opacity: isActive ? 1 : 0.28, order: cssOrder }}
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

              {/* Canal de Guías (si hay clips cargados) */}
              {guiasClips.length > 0 && (() => {
                const anyTrackSoloed = trackStates.some(ts => ts.soloed) || guiasSoloed;
                const guiasActive = anyTrackSoloed ? guiasSoloed : !guiasMuted;
                return (
                <div
                  className={`flex flex-col items-center gap-1.5 px-2 border-r border-gray-800 transition-opacity`}
                  style={{ width: 68, minWidth: 68, opacity: guiasActive ? 1 : 0.28, order: 998 }}
                >
                  <div className="w-10 h-0.5 rounded-full bg-emerald-500" />
                  <div className="h-9 flex items-center justify-center px-0.5 w-full">
                    <p className="text-[10px] text-emerald-400 font-medium text-center leading-tight">Guías</p>
                  </div>
                  {/* Fader vertical */}
                  <div className="flex-1 flex items-center justify-center w-full py-1 relative" style={{ minHeight: 100 }}>
                    <div className="absolute w-1.5 rounded-full bg-gray-700 top-2 bottom-2 left-1/2 -translate-x-1/2" />
                    <div
                      className="absolute w-1.5 rounded-full left-1/2 -translate-x-1/2 bottom-2 bg-emerald-500 transition-none"
                      style={{ opacity: 0.75, height: `calc(${guiasVolume * 100}% - 16px)` }}
                    />
                    <div
                      className="absolute w-5 h-3.5 rounded bg-emerald-200 left-1/2 -translate-x-1/2 shadow-md"
                      style={{ bottom: `calc(${guiasVolume * 100}% - 16px - 7px + 2px)` }}
                    />
                    <input
                      type="range" min={0} max={1} step={0.01} value={guiasVolume}
                      onChange={(e) => {
                        const v = parseFloat(e.target.value);
                        setGuiasVolume(v);
                        if (guiasGainRef.current) guiasGainRef.current.gain.value = guiasMuted ? 0 : v * 6.0;
                      }}
                      className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                      style={{ writingMode: "vertical-lr", direction: "rtl", WebkitAppearance: "slider-vertical" }}
                    />
                  </div>
                  <span className="text-gray-500 text-[10px] tabular-nums">{Math.round(guiasVolume * 100)}</span>
                  <button
                    onClick={() => {
                      const nextMuted = !guiasMuted;
                      setGuiasMuted(nextMuted);
                      recalcGains(trackStates, guiasSoloed, nextMuted);
                    }}
                    className={`w-full py-1 rounded text-[10px] font-bold transition select-none ${
                      guiasMuted ? "bg-red-500 text-white" : "bg-gray-800 text-gray-500 hover:text-gray-300 hover:bg-gray-700"
                    }`}
                  >M</button>

                  {/* Solo */}
                  <button
                    onClick={toggleGuiasSolo}
                    className={`w-full py-1 rounded text-[10px] font-bold transition select-none ${
                      guiasSoloed ? "bg-yellow-400 text-gray-900" : "bg-gray-800 text-gray-500 hover:text-gray-300 hover:bg-gray-700"
                    }`}
                  >S</button>

                  {/* Pan label */}
                  <span className="text-gray-500 text-[10px] tabular-nums mt-1">
                    {guiasPan < -0.04 ? `L${Math.round(-guiasPan * 100)}` : guiasPan > 0.04 ? `R${Math.round(guiasPan * 100)}` : "C"}
                  </span>

                  {/* Pan slider — doble clic para centrar */}
                  <div className="w-full relative mb-1" title="Balance (doble clic = centro)">
                    <div className="absolute top-1/2 left-0 right-0 h-px bg-gray-700 -translate-y-1/2 pointer-events-none" />
                    <div className="absolute top-1/2 left-1/2 w-px h-2 bg-gray-600 -translate-x-1/2 -translate-y-1/2 pointer-events-none" />
                    <input
                      type="range" min={-1} max={1} step={0.02} value={guiasPan}
                      onChange={(e) => setGuiasPanValue(parseFloat(e.target.value))}
                      onDoubleClick={() => setGuiasPanValue(0)}
                      className="w-full h-4 opacity-100 cursor-pointer relative"
                      style={{ accentColor: "#10b981" }}
                    />
                  </div>
                </div>
                );
              })()}

              {/* Master channel */}
              <div
                className="flex flex-col items-center gap-1.5 px-2 border-l-2 border-gray-600 ml-1"
                style={{ width: 68, minWidth: 68, order: 1000 }}
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
