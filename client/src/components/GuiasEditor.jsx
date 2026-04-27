/**
 * GuiasEditor.jsx  v4
 *
 * Herramientas de edición:
 *   SELECT  — clic en región para seleccionarla · clic en hueco para seekear
 *   SPLIT   — clic sobre una región → la divide en ese punto
 * Tras un split, selecciona el fragmento y pulsa Delete / botón Eliminar para borrarlo.
 * La reproducción respeta los fragmentos activos (salta los eliminados).
 */

import React, { useEffect, useRef, useState, useCallback } from "react";
import {
  X, Loader2, Play, Pause, Square, Save, Trash2,
  GripHorizontal, ChevronLeft, ChevronRight, Music2,
  ZoomIn, ZoomOut, Plus, Scissors, MousePointer, Volume2, VolumeX, Undo2, Maximize2, Layers,
} from "lucide-react";
import { idbGet, idbSet } from "../utils/audioOfflineCache";

const API_URL = import.meta.env.VITE_BACKEND_URL || "https://iglesia-backend.onrender.com";

const TRACK_COLORS = [
  "#6366f1","#10b981","#f59e0b","#ef4444","#8b5cf6",
  "#06b6d4","#84cc16","#f97316","#ec4899","#14b8a6",
];

const LABEL_W = 164;
const RULER_H  = 40;
const TRACK_H  = 100;
const GUIDE_H  = 124;

function fmt(s)   { if (!Number.isFinite(s)||s<0) return "0:00"; return `${Math.floor(s/60)}:${String(Math.floor(s%60)).padStart(2,"0")}`; }
function fmtMs(s) { if (!Number.isFinite(s)||s<0) return "0:00.0"; return `${Math.floor(s/60)}:${(s%60).toFixed(1).padStart(4,"0")}`; }
function sinExt(n){ return (n||"").replace(/\.[^.]+$/,""); }

/**
 * parseFolderName — extrae clave, BPM y compas del nombre de carpeta.
 * Formato esperado: "Nombre cancion - G - 110bpm - 4/4"
 * También soporta variaciones como "Gm", "F#", "Bb", "110 bpm", "3/4", etc.
 */
function parseFolderName(name = "") {
  const result = { key: null, bpm: null, beatsPerBar: null };
  // BPM: número seguido opcionalmente de espacio y "bpm"
  const bpmMatch = name.match(/(\d{2,3})\s*bpm/i);
  if (bpmMatch) result.bpm = parseInt(bpmMatch[1], 10);
  // Time signature: dígito/dígito
  const tsMatch = name.match(/(\d+)\/(\d+)/);
  if (tsMatch) result.beatsPerBar = parseInt(tsMatch[1], 10);
  // Clave musical: letra A-G, opcionalmente seguida de # o b, luego m/min/maj/M
  // Buscamos segmentos separados por " - " o " |"
  const keyMatch = name.match(/(?:^|\s+-\s+)([A-Ga-g][#b]?(?:m|min|maj|M)?(?:\d)?(?![a-z]))/g);
  if (keyMatch) {
    // tomar el que no sea el nombre de la canción (generalmente 2do segmento)
    const keys = keyMatch.map(s => s.replace(/^\s*-\s*/, "").trim());
    result.key = keys[0] || null;
  }
  return result;
}

let _uid=1;
const uid = () => `id_${Date.now()}_${_uid++}`;

/* ─── Dibujo de waveform con regiones activas ─────────────────────────────── */
function drawWaveformWithRegions(canvas, buffer, color, regions, selectedId, gridLines, zoom, multiSelIds) {
  if (!canvas || !buffer) return;
  const ctx    = canvas.getContext("2d");
  const W      = canvas.width;
  const H      = canvas.height;
  const dur    = buffer.duration;
  const data   = buffer.getChannelData(0);
  // píxeles que ocupa realmente el audio (puede ser < W si la pista es más corta)
  const W_audio = Math.min(W, Math.ceil(dur * zoom));
  const step    = Math.max(1, Math.floor(data.length / W_audio));
  const amp     = (H / 2) * 0.88;

  ctx.clearRect(0, 0, W, H);
  ctx.fillStyle = "#ffffff06";
  ctx.fillRect(0, 0, W, H);

  // línea central
  ctx.strokeStyle = "#ffffff12";
  ctx.lineWidth = 0.5;
  ctx.beginPath(); ctx.moveTo(0,H/2); ctx.lineTo(W,H/2); ctx.stroke();

  // helper: dibuja líneas de waveform entre columnas px1..px2
  // x1Region: píxel absoluto donde empieza la región en el canvas
  // fileOffset: segundos en el archivo de audio donde empieza la región
  const drawLines = (px1, px2, x1Region, fileOffset, strokeColor, lw=1) => {
    const a1 = Math.max(0, px1);
    const a2 = Math.min(W_audio, px2); // no dibujar más allá del audio real
    if (a1 >= a2) return;
    ctx.strokeStyle = strokeColor; ctx.lineWidth = lw; ctx.beginPath();
    for (let px = a1; px < a2; px++) {
      // tiempo en el archivo de audio = fileOffset + posición relativa dentro de la región
      const fileTime = fileOffset + (px - x1Region) / zoom;
      if (fileTime < 0 || fileTime >= dur) continue;
      const si = Math.floor((fileTime / dur) * data.length);
      let mn=0, mx=0;
      for (let j=0;j<step;j++) { const d=data[si+j]??0; if(d<mn)mn=d; if(d>mx)mx=d; }
      ctx.moveTo(px+.5, H/2+mn*amp); ctx.lineTo(px+.5, H/2+mx*amp);
    }
    ctx.stroke();
  };

  // Solo dibujamos las regiones activas — las zonas eliminadas quedan vacías
  for (const r of regions) {
    const x1 = Math.floor(r.start * zoom);
    const x2 = Math.ceil (r.end   * zoom);
    const sel = r.id === selectedId;
    const multiSel = !sel && (multiSelIds?.has(r.id) ?? false);
    // fileOffset: dónde en el archivo de audio empieza esta región (por defecto = r.start para compatibilidad)
    const fileOff = r.fileOffset ?? r.start;

    ctx.fillStyle = sel ? color+"44" : multiSel ? "#6366f130" : color+"1c";
    ctx.fillRect(x1, 0, x2-x1, H);

    ctx.save();
    ctx.beginPath(); ctx.rect(x1,0,x2-x1,H); ctx.clip();
    drawLines(x1, x2, x1, fileOff, (sel||multiSel)?"#ffffff": color, (sel||multiSel)?1.3:1);
    ctx.restore();

    ctx.strokeStyle = sel ? "#ffffffa0" : multiSel ? "#6366f1c0" : color+"80";
    ctx.lineWidth   = sel ? 1.5 : (multiSel ? 1.5 : 1);
    ctx.strokeRect(x1+.5, .5, x2-x1-1, H-1);
  }

  // 3. líneas de grid (beats y barras) encima de todo
  if (gridLines) {
    if (gridLines.beats?.length) {
      ctx.strokeStyle = "#ffffff0a"; ctx.lineWidth = 1; ctx.beginPath();
      gridLines.beats.forEach(x => { ctx.moveTo(x+.5,0); ctx.lineTo(x+.5,H); });
      ctx.stroke();
    }
    if (gridLines.bars?.length) {
      ctx.strokeStyle = "#ffffff1a"; ctx.lineWidth = 1; ctx.beginPath();
      gridLines.bars.forEach(x => { ctx.moveTo(x+.5,0); ctx.lineTo(x+.5,H); });
      ctx.stroke();
    }
  }
}

/* ─── Componente principal ────────────────────────────────────────────────── */
export default function GuiasEditor({ folderId, folderName, tracks=[], getToken, onClose, onSaved, onSwitchToMultitrack=null }) {
  /* Extraer metadatos del nombre de carpeta una sola vez */
  const folderMeta = React.useMemo(() => parseFolderName(folderName), [folderName]);
  /* refs de audio */
  const ctxRef        = useRef(null);
  const masterGainRef = useRef(null);
  const guiaGainRef   = useRef(null);
  const sourcesRef    = useRef([]);
  const startTimeRef  = useRef(0);
  const offsetRef     = useRef(0);
  const playingRef    = useRef(false);
  const tickRef       = useRef(null);
  const durationRef   = useRef(0);
  const guiaSrcRef    = useRef([]);  // array de BufferSourceNodes activos de guías
  const trackGainNodesRef   = useRef({}); // fid → GainNode por pista
  const trackPannerNodesRef = useRef({}); // fid → StereoPannerNode por pista
  const guiaPannerRef       = useRef(null);
  const guiaVolumeRef       = useRef(1);
  const guiaBoostRef        = useRef(2.5);
  const guiaPanValRef       = useRef(-1);
  const metroGainRef        = useRef(null);
  const metroPannerRef      = useRef(null);
  const metroSchedulerRef   = useRef(null);
  const metroNodesRef       = useRef([]);
  const metroNextBeatRef    = useRef(0);
  const metroNextIdxRef     = useRef(0);
  const metroEnabledRef     = useRef(false);
  const metroVolumeRef      = useRef(1);
  const metroPanRef         = useRef(-1);
  const bpmRef              = useRef(120);
  const beatsPerBarRef      = useRef(4);

  /* state */
  const [buffers,       setBuffers]       = useState({});
  const [guiaBuffers,   setGuiaBuffers]   = useState({});
  const [loadingPistas, setLoadingPistas] = useState(true);
  const [loadProgress,  setLoadProgress]  = useState(0);
  const [guiasFiles,    setGuiasFiles]    = useState([]);
  const [loadingFiles,  setLoadingFiles]  = useState(true);
  const [errorFiles,    setErrorFiles]    = useState(null);
  const [clips,         setClips]         = useState([]);
  const [loadingClips,  setLoadingClips]  = useState(true);
  /* trackRegions: { [fid]: [{id,start,end}] }  — no entry = 1 región completa */
  const [trackRegions,  setTrackRegions]  = useState({});
  const historyRef    = useRef([]); // stack de snapshots de trackRegions para undo
  const [canUndo,       setCanUndo]       = useState(false);
  const [selectedReg,   setSelectedReg]   = useState(null); // {fid,id}
  const [selectedRegIds, setSelectedRegIds] = useState(new Set()); // regiones seleccionadas para corte (keys: "fid:rid")
  const anchorTrackRef = useRef(null); // ancla Shift+click: {fid, id} o null
  const dragRegRef    = useRef(null);  // estado de drag: {fid, rid, startX, origStart, origEnd, dur}
  const [tool,          setTool]          = useState("select");
  const [soloGuia,      setSoloGuia]      = useState(false);
  const [muteGuia,      setMuteGuia]      = useState(false);
  const [trackMixer,    setTrackMixer]    = useState({}); // { [fid]: { muted, soloed, volume, pan } }
  const [metroEnabled,  setMetroEnabled]  = useState(false);
  const [metroVolume,   setMetroVolume]   = useState(1);
  const [metroPan,      setMetroPan]      = useState(-1);
  const [guiaVolume,    setGuiaVolume]    = useState(1);
  const [guiaBoost,     setGuiaBoost]     = useState(2.5);
  const [guiaPan,       setGuiaPan]       = useState(-1);
  const [saving,        setSaving]        = useState(false);
  const [savedOk,       setSavedOk]       = useState(false);
  const [playing,       setPlaying]       = useState(false);
  const [currentTime,   setCurrentTime]   = useState(0);
  const [duration,      setDuration]      = useState(0);
  const [zoom,          setZoom]          = useState(6);
  const [bpm,           setBpm]           = useState(() => folderMeta.bpm ?? 120);
  const [beatsPerBar,   setBeatsPerBar]   = useState(() => folderMeta.beatsPerBar ?? 4);
  const [songKey,       setSongKey]       = useState(folderMeta.key ?? "");
  const [showBeats,     setShowBeats]     = useState(true);
  const [rulerMode,     setRulerMode]     = useState("bars"); // "bars" | "seconds"
  const [activeGuiaClip,setActiveGuiaClip]= useState(null);
  const [previewId,     setPreviewId]     = useState(null);
  const previewAudio  = useRef(new Audio());
  const canvasRefs    = useRef({});
  const scrollContRef = useRef(null);
  const guideLaneRef  = useRef(null);

  const tlWidth = Math.max(800, Math.ceil(duration)*zoom + zoom*30); // 30s extra siempre

  /* helper: obtiene regiones de un track */
  const getRegs = (fid, buf) =>
    trackRegions[fid] ?? (buf ? [{ id:`r0_${fid}`, start:0, end:buf.duration, fileOffset:0 }] : []);

  /* ── carga inicial ───────────────────────────────────────────────────────── */
  useEffect(() => {
    const hdrs = { Authorization:`Bearer ${getToken()}` };
    const actx = new (window.AudioContext||window.webkitAudioContext)();
    ctxRef.current = actx;
    const mg = actx.createGain(); mg.gain.value=.85; mg.connect(actx.destination); masterGainRef.current=mg;
    const gg = actx.createGain(); gg.gain.value=6.0; guiaGainRef.current=gg;
    const gp = actx.createStereoPanner(); gp.pan.value=-1;
    gg.connect(gp); gp.connect(actx.destination); guiaPannerRef.current=gp;
    const mGain = actx.createGain(); mGain.gain.value=1; metroGainRef.current=mGain;
    const mPan  = actx.createStereoPanner(); mPan.pan.value=-1;
    mGain.connect(mPan); mPan.connect(actx.destination); metroPannerRef.current=mPan;

    let done=0, total=tracks.length;
    (async()=>{
      if(!total){ setLoadingPistas(false); return; }
      const res = await Promise.all(tracks.map(async t=>{
        const fid=t.id||t.fileId;
        try {
          let ab; const cached=await idbGet(fid);
          if(cached) ab=cached.slice(0);
          else {
            const r=await fetch(`${API_URL}/api/musica/stream/${fid}`,{headers:hdrs});
            if(!r.ok) throw new Error(`HTTP ${r.status}`);
            ab=await r.arrayBuffer(); idbSet(fid,ab.slice(0));
          }
          const buf=await actx.decodeAudioData(ab);
          done++; setLoadProgress(Math.round((done/total)*100));
          return {fid,buf};
        } catch { done++; setLoadProgress(Math.round((done/total)*100)); return {fid,buf:null}; }
      }));
      const map={}; let mx=0;
      res.forEach(({fid,buf})=>{ if(buf){map[fid]=buf; if(buf.duration>mx)mx=buf.duration;} });
      durationRef.current=mx; setDuration(mx); setBuffers(map); setLoadingPistas(false);
    })();

    fetch(`${API_URL}/api/musica/guias/archivos`,{headers:hdrs})
      .then(r=>r.json()).then(d=>{ if(d.error)setErrorFiles(d.error); else setGuiasFiles(Array.isArray(d)?d:[]); })
      .catch(()=>setErrorFiles("Error de conexión")).finally(()=>setLoadingFiles(false));

    fetch(`${API_URL}/api/musica/guias/${encodeURIComponent(folderId)}`,{headers:hdrs})
      .then(r=>r.json()).then(d=>{
        if(Array.isArray(d.clips))                      setClips([...d.clips].sort((a,b)=>a.startTime-b.startTime));
        if(d.trackRegions)                              setTrackRegions(d.trackRegions);
        if(d.bpm       && folderMeta.bpm       == null) setBpm(d.bpm);
        if(d.beatsPerBar && folderMeta.beatsPerBar == null) setBeatsPerBar(d.beatsPerBar);
        if(d.key       && !folderMeta.key)              setSongKey(d.key);
      }).catch(()=>{}).finally(()=>setLoadingClips(false));

    return ()=>{
      clearInterval(tickRef.current);
      sourcesRef.current.forEach(s=>{ try{s.stop();}catch{} });
      actx.close().catch(()=>{}); previewAudio.current.pause();
    };
  },[]); // eslint-disable-line

  /* ── redibujar waveforms ─────────────────────────────────────────────────── */
  useEffect(()=>{
    // calcular líneas de grid para las waveforms
    const bars = [], beats = [];
    if (duration > 0) {
      const _secPerBeat = 60/bpm;
      const _secPerBar  = _secPerBeat * beatsPerBar;
      const _barCount   = Math.ceil(duration / _secPerBar) + 1;
      for (let bi = 0; bi < _barCount; bi++) {
        const bSec = bi * _secPerBar;
        if (bSec > duration + _secPerBar) break;
        bars.push(Math.floor(bSec * zoom));
        if (showBeats) {
          for (let ti = 1; ti < beatsPerBar; ti++) {
            const tSec = bSec + ti * _secPerBeat;
            if (tSec < duration) beats.push(Math.floor(tSec * zoom));
          }
        }
      }
    }
    const gridLines = { bars, beats };

    tracks.forEach((track,i)=>{
      const fid=track.id||track.fileId;
      const buf=buffers[fid]; const canvas=canvasRefs.current[fid];
      if(!buf||!canvas) return;
      canvas.width=tlWidth; canvas.height=TRACK_H;
      const regs = getRegs(fid,buf);
      const selId = selectedReg?.fid===fid ? selectedReg.id : null;
      const multiSelIds = new Set([...selectedRegIds].filter(k=>k.startsWith(fid+":")).map(k=>k.slice(fid.length+1)));
      drawWaveformWithRegions(canvas, buf, TRACK_COLORS[i%TRACK_COLORS.length], regs, selId, gridLines, zoom, multiSelIds);
    });
  },[buffers,tlWidth,tracks,trackRegions,selectedReg,selectedRegIds,bpm,beatsPerBar,showBeats,zoom,duration]); // eslint-disable-line

  /* ── helper: guarda snapshot y actualiza trackRegions ──────────────────── */
  const commitRegions = useCallback((updater) => {
    setTrackRegions(prev => {
      historyRef.current = [...historyRef.current.slice(-49), prev]; // máx 50 pasos
      setCanUndo(true);
      return typeof updater === "function" ? updater(prev) : updater;
    });
  }, []);

  const undo = useCallback(() => {
    if (!historyRef.current.length) return;
    const prev = historyRef.current[historyRef.current.length - 1];
    historyRef.current = historyRef.current.slice(0, -1);
    setTrackRegions(prev);
    setCanUndo(historyRef.current.length > 0);
    setSelectedReg(null);
  }, []);

  /* ── gestión de regiones ─────────────────────────────────────────────────── */
  const deleteRegion = useCallback((fid,rid)=>{
    commitRegions(prev=>{
      const regs=prev[fid]; if(!regs) return prev;
      return {...prev,[fid]:regs.filter(r=>r.id!==rid)};
    });
  },[commitRegions]);

  // elimina todas las regiones marcadas en selectedRegIds de una sola pasada (1 entrada en historial)
  const deleteSelectedRegions = useCallback((regIds)=>{
    if (!regIds.size) return;
    const byFid = {};
    regIds.forEach(key=>{
      const [rfid,...rest] = key.split(":"); const rid = rest.join(":");
      (byFid[rfid] = byFid[rfid]||[]).push(rid);
    });
    commitRegions(prev=>{
      const next = {...prev};
      Object.entries(byFid).forEach(([rfid, rids])=>{
        const regs = next[rfid]; if(!regs) return;
        next[rfid] = regs.filter(r=>!rids.includes(r.id));
      });
      return next;
    });
  },[commitRegions]);

  /* ── teclado: Delete · Escape · Ctrl+Z · ← → mover región ─────────────────
     Sin modificador : mueve la región seleccionada al cursor del playhead
     Shift+← / Shift+→ : paso de 1 beat
     Shift+Meta+← / Shift+Meta+→ : paso de 1 compás
  ────────────────────────────────────────────────────────────────────────── */
  useEffect(()=>{
    const onKey=e=>{
      if(["INPUT","SELECT","TEXTAREA"].includes(e.target.tagName)) return;
      if(e.key==="Escape"){
        setSelectedRegIds(new Set());
        anchorTrackRef.current = null;
        return;
      }
      if((e.ctrlKey||e.metaKey) && e.key==="z"){ e.preventDefault(); undo(); return; }
      if(e.key==="Delete"||e.key==="Backspace"){
        if(selectedRegIds.size > 0){
          deleteSelectedRegions(selectedRegIds);
          setSelectedRegIds(new Set()); anchorTrackRef.current=null;
        } else if(selectedReg){
          deleteRegion(selectedReg.fid, selectedReg.id);
          setSelectedReg(null);
        }
        return;
      }

      if(e.key==="ArrowLeft" || e.key==="ArrowRight"){
        const hasSelection = selectedRegIds.size > 0 || selectedReg;
        if(!hasSelection) return;
        e.preventDefault();

        const secPerBeat = 60 / bpm;
        const secPerBar  = secPerBeat * beatsPerBar;
        const dir = e.key==="ArrowRight" ? 1 : -1;

        // construir lista de regiones a mover
        const keysToMove = selectedRegIds.size > 0
          ? [...selectedRegIds]
          : [`${selectedReg.fid}:${selectedReg.id}`];

        commitRegions(prev => {
          const next = {...prev};
          keysToMove.forEach(k => {
            const [kfid,...rest] = k.split(":"); const krid = rest.join(":");
            const kbuf = buffers[kfid];
            const kdur = kbuf?.duration ?? durationRef.current;
            // materializar región virtual si no existe aún
            const kregs = next[kfid] ?? [{id:`r0_${kfid}`, start:0, end:kdur, fileOffset:0}];
            const kreg  = kregs.find(r=>r.id===krid); if(!kreg) return;
            const len   = kreg.end - kreg.start;

            let newStart;
            if(e.shiftKey && (e.metaKey||e.ctrlKey)){
              // Shift+Meta/Ctrl: paso de 1 compás
              newStart = Math.max(0, kreg.start + dir * secPerBar);
            } else if(e.shiftKey){
              // Shift: paso de 1 beat
              newStart = Math.max(0, kreg.start + dir * secPerBeat);
            } else {
              // Sin modificador: mover al cursor del playhead
              // → alínea el inicio de la región con el playhead
              // ← alínea el final de la región con el playhead
              if(dir === 1){
                newStart = Math.max(0, offsetRef.current);
              } else {
                newStart = Math.max(0, offsetRef.current - len);
              }
            }

            const newEnd = newStart + len;
            // expandir timeline si la región supera la duración actual
            if(newEnd > durationRef.current){
              durationRef.current = newEnd;
              setDuration(newEnd);
            }
            next[kfid] = kregs.map(r=>r.id===krid ? {...r, start:newStart, end:newEnd} : r);
          });
          return next;
        });
      }
    };
    window.addEventListener("keydown",onKey);
    return ()=>window.removeEventListener("keydown",onKey);
  },[selectedReg, selectedRegIds, undo, deleteRegion, deleteSelectedRegions, bpm, beatsPerBar, buffers, commitRegions]); // eslint-disable-line

  /* ── playback ────────────────────────────────────────────────────────────── */
  /* aplica mute/solo/vol/pan de mixer a los GainNodes/PannerNodes */
  const recalcTrackGains = (mixer, _soloGuia, _muteGuia) => {
    const anySoloed = Object.values(mixer).some(m=>m?.soloed) || _soloGuia;
    Object.entries(trackGainNodesRef.current).forEach(([fid, gNode])=>{
      const m = mixer[fid] ?? {};
      const active = anySoloed ? !!(m.soloed) : !(m.muted);
      gNode.gain.value = active ? (m.volume ?? 1) * (m.boost ?? 1) : 0;
      const pNode = trackPannerNodesRef.current[fid];
      if(pNode) pNode.pan.value = m.pan ?? 0;
    });
    if(guiaGainRef.current){
      const guiasActive = anySoloed ? _soloGuia : !_muteGuia;
      guiaGainRef.current.gain.value = guiasActive ? guiaBoostRef.current * guiaVolumeRef.current : 0;
    }
    if(guiaPannerRef.current) guiaPannerRef.current.pan.value = guiaPanValRef.current;
  };

  /* ── Metrónomo DAW ─────────────────────────────────────────────────────────── */
  const stopMetroScheduler = () => {
    if(metroSchedulerRef.current){ clearTimeout(metroSchedulerRef.current); metroSchedulerRef.current=null; }
    metroNodesRef.current.forEach(n=>{ try{n.stop();}catch{} });
    metroNodesRef.current=[];
  };

  const scheduleMetroBeats = () => {
    const actx=ctxRef.current;
    if(!actx||actx.state==='closed'||!metroEnabledRef.current||!playingRef.current||!bpmRef.current||!metroGainRef.current) return;
    const beatInterval=60/bpmRef.current;
    const scheduleAhead=0.15;
    while(metroNextBeatRef.current < actx.currentTime+scheduleAhead){
      const beatTime=metroNextBeatRef.current;
      const beatIndex=metroNextIdxRef.current;
      if(beatTime >= actx.currentTime-0.01){
        const isDown=(beatIndex%beatsPerBarRef.current)===0;
        const freq=isDown?1600:900;
        const amp=isDown?0.9:0.55;
        const osc=actx.createOscillator();
        const env=actx.createGain();
        osc.type='sine'; osc.frequency.value=freq;
        env.gain.setValueAtTime(0,beatTime);
        env.gain.setValueAtTime(amp,beatTime);
        env.gain.exponentialRampToValueAtTime(0.001,beatTime+0.035);
        osc.connect(env); env.connect(metroGainRef.current);
        osc.start(beatTime); osc.stop(beatTime+0.04);
        metroNodesRef.current.push(osc);
      }
      metroNextBeatRef.current+=beatInterval;
      metroNextIdxRef.current+=1;
    }
    metroNodesRef.current=metroNodesRef.current.filter(n=>{ try{return n.playbackState!==n.FINISHED_STATE;}catch{return false;} });
    metroSchedulerRef.current=setTimeout(scheduleMetroBeats,25);
  };

  const startMetroScheduler = (fromOffset, startAt) => {
    stopMetroScheduler();
    if(!metroEnabledRef.current||!bpmRef.current||!metroGainRef.current) return;
    const beatInterval=60/bpmRef.current;
    const firstBeatIdx=Math.round(fromOffset/beatInterval);
    const firstBeatOffset=firstBeatIdx*beatInterval;
    const adjustedIdx=firstBeatOffset<fromOffset-0.001?firstBeatIdx+1:firstBeatIdx;
    const adjustedOffset=adjustedIdx*beatInterval;
    metroNextBeatRef.current=startAt+(adjustedOffset-fromOffset);
    metroNextIdxRef.current=adjustedIdx;
    scheduleMetroBeats();
  };

  const stopSources = useCallback(()=>{
    sourcesRef.current.forEach(s=>{ try{s.stop();}catch{} }); sourcesRef.current=[];
    guiaSrcRef.current.forEach(s=>{ try{s.stop();}catch{} }); guiaSrcRef.current=[];
    stopMetroScheduler(); // eslint-disable-line
  },[]);

  const stopAll = useCallback(()=>{
    clearInterval(tickRef.current); stopSources();
    offsetRef.current=0; setCurrentTime(0); setPlaying(false); playingRef.current=false;
  },[stopSources]);

  const startPlayback = useCallback((fromOffset)=>{
    const actx=ctxRef.current; if(!actx) return;
    const startAt=actx.currentTime+0.05;
    startTimeRef.current=startAt-fromOffset;

    // Aplica estado del mixer a los nodos de gain persistentes
    recalcTrackGains(trackMixer, soloGuia, muteGuia);

    tracks.forEach(track=>{
      const fid=track.id||track.fileId; const buf=buffers[fid]; if(!buf) return;
      const regs=trackRegions[fid]??[{id:`r0_${fid}`,start:0,end:buf.duration,fileOffset:0}];
      regs.forEach(r=>{
        if(fromOffset>=r.end) return;
        // fileOffset: dónde en el archivo de audio empieza esta región
        const fileOff = r.fileOffset ?? r.start;
        const regionDur = r.end - r.start;
        // si seekeamos dentro de la región, saltamos esa fracción del audio
        const skipInRegion = fromOffset > r.start ? fromOffset - r.start : 0;
        const bufOff  = fileOff + skipInRegion;
        const segDur  = regionDur - skipInRegion;
        const delay   = fromOffset < r.start ? r.start - fromOffset : 0;
        if(segDur<=0) return;
        const src=actx.createBufferSource(); src.buffer=buf;
        src.connect(trackGainNodesRef.current[fid] ?? masterGainRef.current);
        src.start(startAt+delay, bufOff, segDur);
        sourcesRef.current.push(src);
      });
    });

    // Reproducir TODOS los clips de guías (gain ya actualizado por recalcTrackGains)
    guiaSrcRef.current = [];
    clips.forEach(clip=>{
      const gBuf=guiaBuffers[clip.fileId];
      if(!gBuf) return;
      const clipEnd = clip.startTime + gBuf.duration;
      if(fromOffset >= clipEnd) return; // ya pasó
      const off   = Math.max(0, fromOffset - clip.startTime);
      const delay = clip.startTime > fromOffset ? clip.startTime - fromOffset : 0;
      if(off >= gBuf.duration) return;
      const gs=actx.createBufferSource(); gs.buffer=gBuf;
      gs.connect(guiaGainRef.current);
      gs.start(startAt+delay, off);
      guiaSrcRef.current.push(gs);
    });

    setPlaying(true); playingRef.current=true;
    startMetroScheduler(fromOffset, startAt); // eslint-disable-line
    tickRef.current=setInterval(()=>{
      if(!playingRef.current||!ctxRef.current) return;
      const el=ctxRef.current.currentTime-startTimeRef.current;
      const cl=Math.min(el,durationRef.current);
      setCurrentTime(cl);
      const cont=scrollContRef.current;
      if(cont){ const ph=LABEL_W+cl*zoom; if(ph>cont.scrollLeft+cont.clientWidth-80) cont.scrollLeft=ph-cont.clientWidth/2; }
      if(el>=durationRef.current) stopAll();
    },50);
  },[buffers,guiaBuffers,clips,soloGuia,muteGuia,trackMixer,tracks,trackRegions,zoom,stopAll]);

  const doSeek = useCallback((t)=>{
    const was=playingRef.current;
    if(was){ clearInterval(tickRef.current); stopSources(); playingRef.current=false; setPlaying(false); }
    offsetRef.current=t; setCurrentTime(t);
    if(was) startPlayback(t);
  },[startPlayback,stopSources]);

  const play  = async ()=>{
    const actx=ctxRef.current; if(!actx) return;
    if(actx.state==="suspended") await actx.resume();
    startPlayback(offsetRef.current);
  };
  const pause = ()=>{
    clearInterval(tickRef.current);
    if(ctxRef.current){ const el=ctxRef.current.currentTime-startTimeRef.current; offsetRef.current=Math.min(Math.max(el,0),durationRef.current); }
    stopSources(); setPlaying(false); playingRef.current=false;
  };
  const togglePlay = useCallback(()=>{ if(playing) pause(); else play(); },[playing,pause,play]);

  /* barra espaciadora = play/pause */
  useEffect(()=>{
    const onSpace=e=>{
      if(["INPUT","SELECT","TEXTAREA"].includes(e.target.tagName)) return;
      if(e.key===" "||e.code==="Space"){ e.preventDefault(); togglePlay(); }
    };
    window.addEventListener("keydown",onSpace);
    return ()=>window.removeEventListener("keydown",onSpace);
  },[togglePlay]);
  const onSeekBar  = e=>doSeek(parseFloat(e.target.value));

  /* ── corte multi-pista: aplica split en tiempo t a un conjunto de fids ── */
  const applySplitToTracks = useCallback((fidSet, t) => {
    const newRegs = {};
    for (const tfid of fidSet) {
      const tbuf = buffers[tfid];
      const tdur = tbuf?.duration || durationRef.current;
      const tregs = trackRegions[tfid] ?? [{id:`r0_${tfid}`, start:0, end:tdur}];
      const idx = tregs.findIndex(r => t > r.start+0.05 && t < r.end-0.05);
      if (idx === -1) continue;
      const r = tregs[idx];
      const next = [...tregs];
      // fileOffset de la pieza izquierda = fileOffset del padre
      // fileOffset de la pieza derecha = fileOffset del padre + duración de la parte izquierda
      const rFileOff = r.fileOffset ?? r.start;
      next.splice(idx, 1,
        {id:uid(), start:r.start, end:t,     fileOffset: rFileOff},
        {id:uid(), start:t,       end:r.end,  fileOffset: rFileOff + (t - r.start)}
      );
      newRegs[tfid] = next;
    }
    if (Object.keys(newRegs).length > 0)
      commitRegions(prev => ({...prev, ...newRegs}));
    return newRegs;
  }, [buffers, trackRegions, commitRegions]);

  /* ── click sobre una pista ───────────────────────────────────────────────── */
  const onClickTrack = useCallback((e, fid, buf)=>{
    e.preventDefault();
    const cont=scrollContRef.current; if(!cont) return;
    const rect=cont.getBoundingClientRect();
    const xInTl=e.clientX-rect.left+cont.scrollLeft-LABEL_W;
    const t=Math.max(0, Math.min(xInTl/zoom, durationRef.current));
    const dur=buf?.duration||durationRef.current;
    const regs=trackRegions[fid]??[{id:`r0_${fid}`,start:0,end:dur}];

    if(tool==="split"){
      /*
       * Modo SPLIT:
       * - Si hay pistas pre-seleccionadas → cortar TODAS ellas (+ la clickeada si no está)
       * - Si no hay ninguna seleccionada → cortar solo la clickeada
       */
      const targetFids = selectedRegIds.size > 0
        ? new Set([...selectedRegIds].map(k => k.split(":")[0]))
        : new Set([fid]);
      const newRegs = applySplitToTracks(targetFids, t);
      if (newRegs[fid]) setSelectedReg({fid, id: newRegs[fid].find(r => r.start === t)?.id});
      // limpiar selección de regiones tras el corte para poder trabajar región por región
      setSelectedRegIds(new Set());
      anchorTrackRef.current = null;
    } else {
      /*
       * Modo SELECT:
       * - Shift+click → selecciona la región clickeada; rango selecciona una región por pista al tiempo t
       * - Click normal en región → selecciona la región
       * - Click normal en hueco → seekear
       */
      if (e.shiftKey || e.metaKey) {
        const hit = regs.find(r => t >= r.start && t <= r.end);
        if (!hit) { doSeek(t); return; }
        const regKey = `${fid}:${hit.id}`;
        const anchor = anchorTrackRef.current; // {fid, id, t} o null
        if (!anchor) {
          // Primer Shift+click: fijar ancla, seleccionar solo esta región
          anchorTrackRef.current = { fid, id: hit.id, t };
          setSelectedRegIds(new Set([regKey]));
        } else if (anchor.fid === fid && anchor.id === hit.id) {
          // Click en la misma región ancla: deseleccionar todo
          anchorTrackRef.current = null;
          setSelectedRegIds(new Set());
        } else {
          // Segundo Shift+click en otra pista: seleccionar rango completo
          // Intenta con anchorT primero; si no hay región, intenta con t del segundo click
          const anchorT = anchor.t;
          const trackFids = tracks.map(tr => tr.id||tr.fileId);
          const iA = trackFids.indexOf(anchor.fid);
          const iB = trackFids.indexOf(fid);
          const lo = Math.min(iA, iB);
          const hi = Math.max(iA, iB);
          const newSet = new Set();
          for (let i = lo; i <= hi; i++) {
            const tfid = trackFids[i];
            const tBuf = buffers[tfid];
            const tRegs = trackRegions[tfid] ?? [{id:`r0_${tfid}`, start:0, end:tBuf?.duration??durationRef.current}];
            const tHit = tRegs.find(r => anchorT >= r.start && anchorT <= r.end)
                      ?? tRegs.find(r => t >= r.start && t <= r.end)
                      ?? tRegs[0]; // fallback: primera región de la pista
            if (tHit) newSet.add(`${tfid}:${tHit.id}`);
          }
          setSelectedRegIds(newSet);
          // NO mover el ancla para permitir re-extender el rango
        }
        return;
      }
      // Click normal sin Shift: limpiar selección y ancla
      anchorTrackRef.current = null;
      setSelectedRegIds(new Set());
      const hit=regs.find(r=>t>=r.start&&t<=r.end);
      if(hit){ setSelectedReg({fid,id:hit.id}); }
      else   { setSelectedReg(null); doSeek(t); }
    }
  },[tool,zoom,trackRegions,doSeek,selectedRegIds,applySplitToTracks,tracks,buffers]);

  /* ── drag de región (window pointermove) ────────────────────────────────── */
  const onPointerDownRegion = useCallback((e, fid, rid, buf) => {
    if (tool !== "select") return;
    if (e.shiftKey || e.metaKey) return;
    e.preventDefault();
    e.stopPropagation();

    const regs = trackRegions[fid] ?? [{id:`r0_${fid}`, start:0, end:buf?.duration??durationRef.current}];
    const reg  = regs.find(r => r.id === rid);
    if (!reg) return;

    setSelectedReg({fid, id: rid});

    const regKey = `${fid}:${rid}`;
    const keysToMove = selectedRegIds.has(regKey) && selectedRegIds.size > 1
      ? [...selectedRegIds]
      : [regKey];

    const originals = {};
    keysToMove.forEach(k => {
      const [kfid, ...rest] = k.split(":"); const krid = rest.join(":");
      const kbuf = buffers[kfid];
      const kdur = kbuf?.duration ?? durationRef.current;
      const kregs = trackRegions[kfid] ?? [{id:`r0_${kfid}`, start:0, end:kdur}];
      const kreg  = kregs.find(r => r.id === krid);
      if (kreg) originals[k] = { fid: kfid, rid: krid, start: kreg.start, end: kreg.end, dur: kdur };
    });

    // zoom guardado en el ref para que handleMove no tenga closure estale
    dragRegRef.current = { startX: e.clientX, originals, zoom };

    const handleMove = ev => {
      const d = dragRegRef.current; if (!d) return;
      const dtSec = (ev.clientX - d.startX) / d.zoom;
      setTrackRegions(prev => {
        const next = {...prev};
        let maxEnd = durationRef.current;
        Object.values(d.originals).forEach(o => {
          const len = o.end - o.start;
          let newStart = Math.max(0, o.start + dtSec);
          let newEnd   = newStart + len;
          if (newEnd > maxEnd) maxEnd = newEnd;
          const cur = next[o.fid];
          if (cur) {
            next[o.fid] = cur.map(rr => rr.id === o.rid ? {...rr, start:newStart, end:newEnd} : rr);
          } else {
            next[o.fid] = [{id: o.rid, start: newStart, end: newEnd, fileOffset: o.start}];
          }
        });
        // expandir timeline si las regiones superan la duración actual
        if (maxEnd > durationRef.current) {
          durationRef.current = maxEnd;
          setDuration(maxEnd);
        }
        return next;
      });
    };

    const handleUp = () => {
      window.removeEventListener("mousemove", handleMove);
      window.removeEventListener("mouseup",   handleUp);
      if (!dragRegRef.current) return;
      setTrackRegions(prev => {
        historyRef.current = [...historyRef.current.slice(-49), prev];
        setCanUndo(true);
        return prev;
      });
      dragRegRef.current = null;
    };

    window.addEventListener("mousemove", handleMove);
    window.addEventListener("mouseup",   handleUp);
  }, [tool, zoom, trackRegions, selectedRegIds, buffers]);

  /* ── gestión de regiones (cont.) ──────────────────────────────────────────── */
  const resetRegions = useCallback((fid)=>{
    commitRegions(prev=>{ const n={...prev}; delete n[fid]; return n; });
    setSelectedReg(sr=>sr?.fid===fid?null:sr);
  },[commitRegions]);

  /* ── guías ───────────────────────────────────────────────────────────────── */
  const cargarGuiaBuffer = useCallback(async fid=>{
    if(guiaBuffers[fid]) return guiaBuffers[fid];
    const actx=ctxRef.current; if(!actx) return null;
    try {
      let ab; const cached=await idbGet(`guia_${fid}`);
      if(cached) ab=cached.slice(0);
      else {
        const r=await fetch(`${API_URL}/api/musica/stream/${fid}`,{headers:{Authorization:`Bearer ${getToken()}`}});
        if(!r.ok) throw new Error(`HTTP ${r.status}`);
        ab=await r.arrayBuffer(); idbSet(`guia_${fid}`,ab.slice(0));
      }
      const buf=await actx.decodeAudioData(ab);
      setGuiaBuffers(prev=>({...prev,[fid]:buf})); return buf;
    } catch { return null; }
  },[guiaBuffers,getToken]);

  /* ── cargar buffers de clips ya guardados en DB cuando llegan ── */
  useEffect(()=>{
    if(!clips.length) return;
    const actx=ctxRef.current; if(!actx||actx.state==="closed") return;
    clips.forEach(clip=>{
      if(!guiaBuffers[clip.fileId]) cargarGuiaBuffer(clip.fileId);
    });
  },[clips]); // eslint-disable-line

  /* ── sincronizar refs de BPM y beats ── */
  useEffect(()=>{ bpmRef.current=bpm; beatsPerBarRef.current=beatsPerBar; },[bpm,beatsPerBar]);

  /* ── crear nodos gain/panner por pista cuando se cargan los buffers ── */
  useEffect(()=>{
    const actx=ctxRef.current;
    if(!actx||actx.state==="closed"||!masterGainRef.current) return;
    Object.keys(buffers).forEach(fid=>{
      if(!trackGainNodesRef.current[fid]){
        const g=actx.createGain(); g.gain.value=1;
        const p=actx.createStereoPanner(); p.pan.value=0;
        g.connect(p); p.connect(masterGainRef.current);
        trackGainNodesRef.current[fid]=g;
        trackPannerNodesRef.current[fid]=p;
      }
    });
  },[buffers]); // eslint-disable-line

  const agregarClip = useCallback(async(file,startTime)=>{
    const clip={id:uid(),fileId:file.id,fileName:file.name,startTime:parseFloat(Math.max(0,startTime).toFixed(2)),duration:0};
    setClips(prev=>[...prev,clip].sort((a,b)=>a.startTime-b.startTime)); setActiveGuiaClip(clip);
    await cargarGuiaBuffer(file.id);
    offsetRef.current=clip.startTime; setCurrentTime(clip.startTime);
  },[cargarGuiaBuffer]);

  const eliminarClip = id=>{ setClips(p=>p.filter(c=>c.id!==id)); setActiveGuiaClip(p=>p?.id===id?null:p); };

  const moverClip = (id,delta)=>{
    const ns=c=>parseFloat(Math.max(0,c.startTime+delta).toFixed(3));
    setClips(p=>p.map(c=>c.id===id?{...c,startTime:ns(c)}:c).sort((a,b)=>a.startTime-b.startTime));
    setActiveGuiaClip(p=>p?.id===id?{...p,startTime:ns(p)}:p);
  };

  const onMouseDownClip = useCallback((e,clip)=>{
    e.preventDefault(); e.stopPropagation(); setActiveGuiaClip(clip);
    const sx=e.clientX, st=clip.startTime;
    const onMove=ev=>{
      const ns=parseFloat(Math.max(0,st+(ev.clientX-sx)/zoom).toFixed(3));
      setClips(p=>p.map(c=>c.id===clip.id?{...c,startTime:ns}:c).sort((a,b)=>a.startTime-b.startTime));
      setActiveGuiaClip(p=>p?.id===clip.id?{...p,startTime:ns}:p);
    };
    const onUp=()=>{ window.removeEventListener("mousemove",onMove); window.removeEventListener("mouseup",onUp); };
    window.addEventListener("mousemove",onMove); window.addEventListener("mouseup",onUp);
  },[zoom]);

  const onDropGuide = useCallback(e=>{
    e.preventDefault();
    const fileId=e.dataTransfer.getData("fileId"); const fileName=e.dataTransfer.getData("fileName");
    if(!fileId) return;
    const cont=scrollContRef.current; if(!cont) return;
    const rect=cont.getBoundingClientRect();
    const t=Math.max(0,(e.clientX-rect.left+cont.scrollLeft-LABEL_W)/zoom);
    agregarClip({id:fileId,name:fileName},t);
  },[zoom,agregarClip]);

  const togglePreview = file=>{
    const a=previewAudio.current;
    if(previewId===file.id){ a.pause(); setPreviewId(null); return; }
    a.pause(); setPreviewId(file.id);
    fetch(`${API_URL}/api/musica/stream/${file.id}`,{headers:{Authorization:`Bearer ${getToken()}`}})
      .then(r=>r.blob()).then(blob=>{ a.src=URL.createObjectURL(blob); a.play(); a.onended=()=>setPreviewId(null); })
      .catch(()=>setPreviewId(null));
  };

  const guardar = async()=>{
    setSaving(true); setSavedOk(false);
    try{
      const r=await fetch(`${API_URL}/api/musica/guias/${encodeURIComponent(folderId)}`,{
        method:"POST", headers:{Authorization:`Bearer ${getToken()}`,"Content-Type":"application/json"},
        body:JSON.stringify({clips,trackRegions,bpm,beatsPerBar,key:songKey}),
      });
      const d=await r.json(); if(d.error) throw new Error(d.error);
      setSavedOk(true);
      setTimeout(()=>setSavedOk(false), 3000);
    }catch(err){ alert("Error guardando: "+err.message); }
    finally{ setSaving(false); }
  };

  /* ── valores derivados ───────────────────────────────────────────────────── */
  const secPerBeat = 60/bpm;
  const secPerBar  = secPerBeat*beatsPerBar;
  const barCount   = duration>0 ? Math.ceil(duration/secPerBar)+1 : 0;
  const playheadPx = LABEL_W+currentTime*zoom;
  const isLoading  = loadingPistas||loadingClips;

  /* ─────────────────────────────── RENDER ────────────────────────────────── */
  return (
    <div className="fixed inset-0 bg-gray-950 z-[60] flex flex-col overflow-hidden" style={{userSelect:"none"}}>

      {/* HEADER */}
      <div className="flex items-center gap-2 px-3 py-2 border-b border-gray-800 shrink-0 flex-wrap">

        <div className="flex items-center gap-2 min-w-0 mr-1 shrink-0">
          <div className="w-7 h-7 rounded-lg bg-emerald-600 flex items-center justify-center">
            <Music2 size={14} className="text-white" />
          </div>
          <div className="min-w-0">
            <p className="text-white font-semibold text-sm leading-tight truncate max-w-[180px]">{folderName}</p>
            <p className="text-gray-500 text-[10px] leading-tight">Editor Guías DAW</p>
          </div>
        </div>

        {/* transporte */}
        <div className="flex items-center gap-1 shrink-0">
          <button onClick={stopAll} disabled={isLoading}
            className="w-7 h-7 rounded bg-gray-800 hover:bg-gray-700 text-gray-400 hover:text-white flex items-center justify-center transition disabled:opacity-40">
            <Square size={11} fill="currentColor"/>
          </button>
          <button onClick={togglePlay} disabled={isLoading}
            className="w-9 h-9 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white flex items-center justify-center transition shadow-lg shadow-indigo-600/30 disabled:opacity-40">
            {playing ? <Pause size={16}/> : <Play size={16}/>}
          </button>
          <div className="flex flex-col items-center min-w-[60px]">
            <span className="text-gray-300 text-xs tabular-nums font-medium">{fmtMs(currentTime)}</span>
            <span className="text-gray-600 text-[10px] tabular-nums">/ {fmt(duration)}</span>
          </div>
        </div>

        <input type="range" min={0} max={duration||0} step={0.05} value={currentTime}
          onChange={onSeekBar} disabled={isLoading}
          className="flex-1 h-1 cursor-pointer accent-indigo-500 min-w-[60px] max-w-[180px]"/>

        {/* herramientas */}
        <div className="flex items-center gap-0.5 bg-gray-900 rounded-lg p-0.5 shrink-0">
          <button onClick={()=>setTool("select")} title="Seleccionar región / Seekear"
            className={`flex items-center gap-1 px-2 py-1 rounded text-[11px] transition ${tool==="select"?"bg-indigo-600 text-white":"text-gray-400 hover:text-white hover:bg-gray-700"}`}>
            <MousePointer size={12}/> Selec.
          </button>
          <button onClick={()=>setTool("split")} title="Clic para dividir una región"
            className={`flex items-center gap-1 px-2 py-1 rounded text-[11px] transition ${tool==="split"?"bg-amber-600 text-white":"text-gray-400 hover:text-white hover:bg-gray-700"}`}>
            <Scissors size={12}/> Cortar
          </button>
        </div>

        {/* instrucción contextual */}
        {tool==="select" && selectedRegIds.size===0 && (
          <span className="text-gray-500 text-[10px] shrink-0 hidden sm:block">
            Shift+clic en 1ª pista → Shift+clic en última → selecciona el rango · o Shift+clic individual en cada región
          </span>
        )}
        {tool==="select" && selectedRegIds.size>0 && (
          <span className="text-indigo-300/90 text-[10px] shrink-0 hidden sm:block font-semibold">
            {selectedRegIds.size} región{selectedRegIds.size>1?"es":""} marcada{selectedRegIds.size>1?"s":""} — Shift+clic para extender rango · cambia a Cortar y haz clic · Esc limpiar
          </span>
        )}
        {tool==="split" && selectedRegIds.size===0 && (
          <span className="text-amber-400/70 text-[10px] shrink-0 hidden sm:block">
            Clic → corta solo esta pista (usa Selec. + Shift+clic para marcar varias primero)
          </span>
        )}
        {tool==="split" && selectedRegIds.size>0 && (
          <span className="text-amber-300/90 text-[10px] shrink-0 hidden sm:block font-semibold">
            ✂ {selectedRegIds.size} región{selectedRegIds.size>1?"es":""} marcada{selectedRegIds.size>1?"s":""} — clic en cualquier waveform para cortar todas · Esc limpiar
          </span>
        )}
        {(selectedRegIds.size > 0 || selectedReg) && tool==="select" && (
          <button onClick={()=>{
            if(selectedRegIds.size > 0){
              deleteSelectedRegions(selectedRegIds);
              setSelectedRegIds(new Set()); anchorTrackRef.current=null;
              setSelectedReg(null);
            } else if(selectedReg){
              deleteRegion(selectedReg.fid,selectedReg.id);
              setSelectedReg(null);
            }
          }}
            className="flex items-center gap-1 px-2 py-1.5 bg-red-700 hover:bg-red-600 text-white text-[11px] font-semibold rounded-lg transition shrink-0">
            <Trash2 size={11}/> Eliminar {selectedRegIds.size > 1 ? `${selectedRegIds.size} regiones` : "región"}
          </button>
        )}

        {/* solo guía */}
        <button onClick={()=>{ const next=!soloGuia; setSoloGuia(next); recalcTrackGains(trackMixer, next, muteGuia); }}
          className={`flex items-center gap-1 px-2 py-1 rounded text-[11px] transition shrink-0 ${soloGuia?"bg-emerald-700 text-white":"bg-gray-800 text-gray-400 hover:text-white"}`}>
          {soloGuia ? <VolumeX size={12}/> : <Volume2 size={12}/>}
          {soloGuia?"Solo guía":"Todas"}
        </button>

        {/* BPM + métrica + clave */}
        <div className="flex items-center gap-1.5 shrink-0 bg-gray-900 rounded-lg px-2 py-1">
          {/* Clave */}
          <span className="text-gray-500 text-[10px]">Clave</span>
          <input value={songKey} onChange={e=>setSongKey(e.target.value.slice(0,4))}
            placeholder="—" maxLength={4}
            className="w-10 bg-gray-800 text-amber-300 text-[11px] rounded px-1 py-0.5 text-center border border-gray-700 focus:outline-none focus:border-amber-500 font-semibold"/>
          <div className="w-px h-4 bg-gray-700 mx-0.5"/>
          <span className="text-gray-500 text-[10px]">BPM</span>
          <input type="number" min={40} max={300} value={bpm}
            onChange={e=>setBpm(Math.max(40,Math.min(300,+e.target.value)))}
            className="w-12 bg-gray-800 text-gray-200 text-[11px] rounded px-1 py-0.5 text-center border border-gray-700 focus:outline-none focus:border-indigo-500"/>
          <select value={beatsPerBar} onChange={e=>setBeatsPerBar(+e.target.value)}
            className="bg-gray-800 text-gray-200 text-[11px] rounded px-1 py-0.5 border border-gray-700 focus:outline-none focus:border-indigo-500">
            {[2,3,4,5,6,7,8,12].map(b=><option key={b} value={b}>{b}/4</option>)}
          </select>
          <label className="flex items-center gap-0.5 cursor-pointer">
            <input type="checkbox" checked={showBeats} onChange={e=>setShowBeats(e.target.checked)} className="w-3 h-3 accent-indigo-500"/>
            <span className="text-gray-500 text-[10px]">tiempos</span>
          </label>
          {/* toggle compases / segundos */}
          <div className="flex items-center bg-gray-800 rounded p-0.5 gap-0.5">
            <button onClick={()=>setRulerMode("bars")}
              className={`px-1.5 py-0.5 rounded text-[10px] font-medium transition ${rulerMode==="bars"?"bg-indigo-600 text-white":"text-gray-400 hover:text-white"}`}>
              Comp.
            </button>
            <button onClick={()=>setRulerMode("seconds")}
              className={`px-1.5 py-0.5 rounded text-[10px] font-medium transition ${rulerMode==="seconds"?"bg-indigo-600 text-white":"text-gray-400 hover:text-white"}`}>
              Seg.
            </button>
          </div>
        </div>

        {/* ── Metrónomo ── */}
        <div className="flex items-center gap-1 shrink-0 bg-gray-900 rounded-lg px-2 py-1">
          <button
            onClick={()=>{
              const next=!metroEnabled; setMetroEnabled(next); metroEnabledRef.current=next;
              if(!next){ stopMetroScheduler(); }
              else if(playingRef.current){
                const actx=ctxRef.current;
                if(actx&&bpmRef.current>0){
                  const off=actx.currentTime-startTimeRef.current;
                  startMetroScheduler(Math.max(0,off),actx.currentTime+0.02);
                }
              }
            }}
            className={`text-[10px] font-bold px-2 py-0.5 rounded transition select-none ${
              metroEnabled?"bg-emerald-600 text-white":"bg-gray-800 text-gray-500 hover:text-white hover:bg-gray-700"}`}>
            ♪ METRO
          </button>
          <input type="range" min={0} max={3} step={0.05} value={metroVolume}
            onPointerDown={e=>e.stopPropagation()}
            onChange={e=>{
              const v=parseFloat(e.target.value); setMetroVolume(v); metroVolumeRef.current=v;
              if(metroGainRef.current) metroGainRef.current.gain.value=v;
            }}
            className="w-14 h-1 accent-emerald-500 cursor-pointer"
            title="Volumen metrónomo"/>
          <button
            onClick={()=>{
              const next=metroPan===-1?0:-1; setMetroPan(next); metroPanRef.current=next;
              if(metroPannerRef.current) metroPannerRef.current.pan.value=next;
            }}
            className={`text-[10px] font-bold rounded px-1.5 py-0.5 transition select-none ${
              metroPan===-1?"bg-gray-700 text-white":"bg-emerald-600 text-white"}`}
            title={metroPan===-1?"Centrar metrónomo":"Metrónomo a la izquierda"}>
            {metroPan===-1?"L":"C"}
          </button>
        </div>

        {/* zoom */}
        <div className="flex items-center gap-1 shrink-0">
          <button
            onClick={()=>setZoom(z=>Math.max(2,z-10))}
            className="p-1.5 rounded hover:bg-gray-800 text-gray-400 hover:text-white transition"
            title="Alejar">
            <ZoomOut size={13}/>
          </button>
          <span className="text-gray-500 text-[11px] tabular-nums w-12 text-center">{zoom}px/s</span>
          <button
            onClick={()=>setZoom(z=>Math.min(300,z+10))}
            className="p-1.5 rounded hover:bg-gray-800 text-gray-400 hover:text-white transition"
            title="Acercar">
            <ZoomIn size={13}/>
          </button>
          <button
            onClick={()=>{
              const cont = scrollContRef.current;
              if (!cont || duration <= 0) return;
              const availW = cont.clientWidth - LABEL_W;
              const newZoom = Math.max(2, Math.floor(availW / duration));
              setZoom(newZoom);
            }}
            className="p-1.5 rounded hover:bg-gray-800 text-gray-400 hover:text-white transition"
            title="Autoajustar zoom">
            <Maximize2 size={13}/>
          </button>
        </div>

        <button onClick={undo} disabled={!canUndo||isLoading}
          title="Deshacer (Ctrl+Z)"
          className="flex items-center gap-1.5 px-2.5 py-1.5 bg-gray-800 hover:bg-gray-700 text-gray-300 hover:text-white text-xs font-semibold rounded-lg transition disabled:opacity-30 shrink-0">
          <Undo2 size={12}/> Deshacer
        </button>

        <button onClick={guardar} disabled={saving||isLoading}
          className={`flex items-center gap-1.5 px-3 py-1.5 text-white text-xs font-semibold rounded-lg transition disabled:opacity-50 shrink-0 ${
            savedOk ? "bg-green-600" : "bg-emerald-600 hover:bg-emerald-500"}` }>
          {saving ? <Loader2 size={12} className="animate-spin"/> : <Save size={12}/>}
          {saving ? "Guardando…" : savedOk ? "✓ Guardado" : "Guardar"}
        </button>
        {onSwitchToMultitrack && (
          <button onClick={onSwitchToMultitrack}
            title="Cambiar a Modo Multitrack"
            className="flex items-center gap-1.5 px-2.5 py-1.5 bg-indigo-700 hover:bg-indigo-600 text-white text-xs font-semibold rounded-lg transition shrink-0">
            <Layers size={13}/> Modo Multitrack
          </button>
        )}
        <button onClick={onClose} className="text-gray-400 hover:text-white p-1.5 rounded-lg hover:bg-gray-800 transition shrink-0">
          <X size={18}/>
        </button>
      </div>

      {/* BODY */}
      {isLoading ? (
        <div className="flex-1 flex flex-col items-center justify-center gap-4">
          <Loader2 size={30} className="animate-spin text-emerald-400"/>
          <p className="text-gray-400 text-sm">Cargando pistas… {loadProgress}%</p>
          <div className="w-52 bg-gray-800 rounded-full h-1.5">
            <div className="bg-indigo-500 h-1.5 rounded-full transition-all duration-200" style={{width:`${loadProgress}%`}}/>
          </div>
        </div>
      ) : (
        <div className="flex flex-1 overflow-hidden">

          {/* SIDEBAR */}
          <div className="w-44 shrink-0 border-r border-gray-800 bg-gray-900 flex flex-col overflow-hidden">
            <div className="px-3 py-2 border-b border-gray-800 shrink-0">
              <p className="text-gray-400 text-[10px] font-semibold uppercase tracking-wider">Guías disponibles</p>
              {errorFiles && <p className="text-red-400 text-[10px] mt-0.5">{errorFiles}</p>}
            </div>
            <div className="flex-1 overflow-y-auto">
              {loadingFiles && <div className="flex justify-center py-4"><Loader2 size={14} className="animate-spin text-emerald-400"/></div>}
              {!loadingFiles && !guiasFiles.length && !errorFiles &&
                <p className="text-gray-600 text-[11px] text-center px-3 py-4">Sin guías en Drive</p>}
              {guiasFiles.map(file=>(
                <div key={file.id} draggable
                  onDragStart={e=>{ e.dataTransfer.setData("fileId",file.id); e.dataTransfer.setData("fileName",file.name); }}
                  className="group flex items-center gap-1.5 px-2 py-2.5 hover:bg-gray-800 border-b border-gray-800/40 cursor-grab active:cursor-grabbing transition">
                  <div className="w-1 h-5 rounded-full bg-emerald-600 shrink-0"/>
                  <p className="flex-1 text-[11px] text-gray-300 truncate min-w-0 leading-tight" title={file.name}>{sinExt(file.name)}</p>
                  <div className="flex items-center gap-0.5 shrink-0 opacity-0 group-hover:opacity-100 transition">
                    <button onClick={()=>togglePreview(file)} className="p-1 rounded hover:bg-gray-700 text-gray-400 hover:text-white transition">
                      {previewId===file.id ? <Pause size={11}/> : <Play size={11}/>}
                    </button>
                    <button onClick={()=>{
                      agregarClip(file, offsetRef.current);
                      // preview automático al insertar
                      const a = previewAudio.current;
                      if(previewId === file.id){ /* ya suena, no reiniciar */ } else {
                        a.pause();
                        setPreviewId(file.id);
                        fetch(`${API_URL}/api/musica/stream/${file.id}`,{headers:{Authorization:`Bearer ${getToken()}`}})
                          .then(r=>r.blob())
                          .then(blob=>{ a.src=URL.createObjectURL(blob); a.play(); a.onended=()=>setPreviewId(null); })
                          .catch(()=>setPreviewId(null));
                      }
                    }} className="p-1 rounded hover:bg-emerald-700 text-gray-400 hover:text-emerald-300 transition" title="Insertar y preescuchar">
                      <Plus size={11}/>
                    </button>
                  </div>
                </div>
              ))}
            </div>
            <div className="px-3 py-2 border-t border-gray-800 shrink-0 space-y-1.5">
              <p className="text-gray-600 text-[10px]">Arrastra al carril verde o usa +</p>
              {activeGuiaClip && (
                <div className="bg-emerald-900/30 rounded p-1.5 border border-emerald-800/40">
                  <p className="text-emerald-400 text-[10px] font-semibold truncate">{sinExt(activeGuiaClip.fileName)}</p>
                  <p className="text-gray-500 text-[10px]">activo @ {fmt(activeGuiaClip.startTime)}</p>
                </div>
              )}
            </div>
          </div>

          {/* TIMELINE */}
          <div className="flex-1 overflow-hidden flex flex-col">
            <div ref={scrollContRef} className="flex-1 overflow-auto">
              <div style={{width:LABEL_W+tlWidth, position:"relative"}}>

                {/* REGLA */}
                <div style={{position:"sticky",top:0,zIndex:30,height:RULER_H}}
                  className="flex border-b border-gray-800 bg-gray-900">
                  <div style={{width:LABEL_W,position:"sticky",left:0,zIndex:31,backgroundColor:"#111827"}}
                    className="shrink-0 flex flex-col items-center justify-center border-r border-gray-800 gap-0.5">
                    <span className="text-gray-500 text-[9px] font-semibold tracking-widest">
                      {rulerMode==="bars" ? "COMPÁS" : "SEGUNDOS"}
                    </span>
                  </div>
                  <div className="relative cursor-pointer" style={{width:tlWidth,height:RULER_H}}
                    onClick={e=>{
                      const cont=scrollContRef.current; if(!cont) return;
                      const rect=cont.getBoundingClientRect();
                      const x=e.clientX-rect.left+cont.scrollLeft-LABEL_W;
                      doSeek(Math.max(0,Math.min(x/zoom,durationRef.current)));
                    }}>
                    <div className="absolute w-full" style={{top:RULER_H/2,height:1,backgroundColor:"#1f2937"}}/>

                    {/* modo COMPASES */}
                    {rulerMode==="bars" && duration>0 && Array.from({length:barCount},(_,bi)=>{
                      const bSec=bi*secPerBar; if(bSec>duration+secPerBar) return null;
                      const x=bSec*zoom;
                      return (
                        <React.Fragment key={`b${bi}`}>
                          <div className="absolute" style={{left:x,top:0,width:1,height:RULER_H,backgroundColor:"#4b5563"}}/>
                          <span className="absolute text-[9px] text-gray-400 select-none whitespace-nowrap font-medium" style={{left:x+2,top:2,lineHeight:1}}>{bi+1}</span>
                          {showBeats && Array.from({length:beatsPerBar-1},(_,ti)=>{
                            const tSec=bSec+(ti+1)*secPerBeat; if(tSec>duration) return null;
                            return <div key={`t${bi}_${ti}`} className="absolute" style={{left:tSec*zoom,top:RULER_H/3,width:1,height:RULER_H*2/3,backgroundColor:"#374151"}}/>;
                          })}
                        </React.Fragment>
                      );
                    })}

                    {/* modo SEGUNDOS */}
                    {rulerMode==="seconds" && Array.from({length:Math.ceil(duration)+1},(_,i)=>i).map(sec=>{
                      const major=sec%5===0;
                      return (
                        <div key={`s${sec}`} className="absolute" style={{left:sec*zoom,top:0}}>
                          <div style={{width:1,height:major?RULER_H:RULER_H*0.55,backgroundColor:major?"#6b7280":"#374151"}}/>
                          {major && <span className="absolute text-[9px] text-gray-400 ml-0.5 select-none whitespace-nowrap font-medium" style={{top:RULER_H*0.55}}>{fmt(sec)}</span>}
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* PISTAS */}
                {tracks.map((track,i)=>{
                  const fid   = track.id||track.fileId;
                  const color = TRACK_COLORS[i%TRACK_COLORS.length];
                  const buf   = buffers[fid];
                  const regs  = getRegs(fid, buf);
                  const hasEdits = !!trackRegions[fid];
                  return (
                    <div key={fid} className="flex border-b border-gray-800" style={{height:TRACK_H}}>
                      {/* label + mixer */}
                      <div style={{width:LABEL_W,position:"sticky",left:0,zIndex:10,
                          backgroundColor: [...selectedRegIds].some(k=>k.startsWith(fid+":")) ? "#1e1b4b" : "#0d1117",
                          borderLeft: [...selectedRegIds].some(k=>k.startsWith(fid+":")) ? "3px solid #6366f1" : "3px solid transparent"}}
                        className="shrink-0 flex flex-col justify-center border-r border-gray-800 overflow-hidden">
                        {/* fila 1: colorbar + nombre */}
                        <div className="flex items-center gap-1 px-2 pt-1">
                          <div className="w-1.5 h-5 rounded-full shrink-0" style={{backgroundColor:color}}/>
                          <p className="text-[10px] text-gray-400 truncate flex-1 leading-tight" title={track.name}>
                            {sinExt(track.name||`Track ${i+1}`)}
                          </p>
                          {hasEdits && (
                            <button onClick={e=>{ e.stopPropagation(); resetRegions(fid); }} title="Reset ediciones"
                              className="text-[8px] text-amber-500 hover:text-amber-300 transition shrink-0">
                              <Scissors size={8}/>
                            </button>
                          )}
                        </div>
                        {/* fila 2: M S Vol */}
                        {(()=>{
                          const ms = trackMixer[fid] ?? {};
                          const anySoloed = Object.values(trackMixer).some(m=>m?.soloed) || soloGuia;
                          const active = anySoloed ? !!(ms.soloed) : !(ms.muted);
                          return (
                            <>
                              <div className="flex items-center gap-0.5 px-2 py-0.5">
                                <button
                                  onClick={e=>{ e.stopPropagation(); const next=!ms.muted; const nm={...trackMixer,[fid]:{...ms,muted:next}}; setTrackMixer(nm); recalcTrackGains(nm,soloGuia,muteGuia); }}
                                  className={`w-5 h-5 rounded text-[9px] font-bold flex items-center justify-center transition ${ms.muted?"bg-red-600 text-white":"bg-gray-700 text-gray-400 hover:bg-gray-600 hover:text-white"}`}>M</button>
                                <button
                                  onClick={e=>{ e.stopPropagation(); const next=!ms.soloed; const nm={...trackMixer,[fid]:{...ms,soloed:next}}; setTrackMixer(nm); recalcTrackGains(nm,soloGuia,muteGuia); }}
                                  className={`w-5 h-5 rounded text-[9px] font-bold flex items-center justify-center transition ${ms.soloed?"bg-yellow-400 text-gray-900":"bg-gray-700 text-gray-400 hover:bg-gray-600 hover:text-white"}`}>S</button>
                                <span className="text-[8px] text-gray-600 ml-0.5">V</span>
                                <input type="range" min={0} max={1} step={0.01} value={ms.volume??1}
                                  onClick={e=>e.stopPropagation()}
                                  onChange={e=>{ const v=parseFloat(e.target.value); const nm={...trackMixer,[fid]:{...ms,volume:v}}; setTrackMixer(nm); const gn=trackGainNodesRef.current[fid]; if(gn) gn.gain.value=active?v*(ms.boost??1):0; }}
                                  className="flex-1 h-1 cursor-pointer accent-indigo-400 min-w-0"/>
                              </div>
                              <div className="flex items-center gap-0.5 px-2 py-0.5">
                                <span className="text-[8px] text-gray-600">P</span>
                                <input type="range" min={-1} max={1} step={0.01} value={ms.pan??0}
                                  onClick={e=>e.stopPropagation()}
                                  onChange={e=>{ const v=parseFloat(e.target.value); const nm={...trackMixer,[fid]:{...ms,pan:v}}; setTrackMixer(nm); const pn=trackPannerNodesRef.current[fid]; if(pn) pn.pan.value=v; }}
                                  className="flex-1 h-1 cursor-pointer accent-purple-400 min-w-0"/>
                                <span className="text-[8px] text-gray-500 tabular-nums w-6 text-right">{Math.round((ms.pan??0)*100)}</span>
                              </div>
                              <div className="flex items-center gap-0.5 px-2 pb-1">
                                <span className="text-[8px] text-gray-600">G</span>
                                <input type="range" min={0.1} max={8} step={0.05} value={ms.boost??1}
                                  onClick={e=>e.stopPropagation()}
                                  onDoubleClick={e=>{ e.stopPropagation(); const nm={...trackMixer,[fid]:{...ms,boost:1}}; setTrackMixer(nm); const gn=trackGainNodesRef.current[fid]; if(gn) gn.gain.value=active?(ms.volume??1)*1:0; }}
                                  onChange={e=>{ const v=parseFloat(e.target.value); const nm={...trackMixer,[fid]:{...ms,boost:v}}; setTrackMixer(nm); const gn=trackGainNodesRef.current[fid]; if(gn) gn.gain.value=active?(ms.volume??1)*v:0; }}
                                  className="flex-1 h-1 cursor-pointer accent-indigo-600 min-w-0"/>
                                <span className="text-[8px] text-gray-500 tabular-nums w-7 text-right">×{(ms.boost??1).toFixed(1)}</span>
                              </div>
                            </>
                          );
                        })()}
                      </div>
                      {/* waveform */}
                      <div className="relative" style={{width:tlWidth,height:TRACK_H,
                          cursor: tool==="split" ? "crosshair" : "default",
                          outline: [...selectedRegIds].some(k=>k.startsWith(fid+":")) ? "2px solid #6366f1" : "none",
                          outlineOffset:"-2px"}}
                        onClick={e=>onClickTrack(e,fid,buf)}>
                        {buf ? (
                          <canvas
                            ref={el=>{ if(el) canvasRefs.current[fid]=el; }}
                            style={{position:"absolute",inset:0,width:"100%",height:"100%",display:"block",pointerEvents:"none"}}/>
                        ) : (
                          <div className="absolute inset-0 flex items-center justify-center" style={{backgroundColor:color+"08"}}>
                            <span className="text-[10px]" style={{color:color+"50"}}>sin datos</span>
                          </div>
                        )}
                        {/* overlays arrastrables por región (solo en modo select) */}
                        {tool==="select" && buf && regs.map(r => {
                          const x1 = Math.floor(r.start * zoom);
                          const x2 = Math.ceil(r.end * zoom);
                          return (
                            <div key={r.id}
                              onMouseDown={e => onPointerDownRegion(e, fid, r.id, buf)}
                              onClick={e => {
                                if (e.shiftKey || e.metaKey) return;
                                e.stopPropagation();
                              }}
                              className="absolute top-0 bottom-0 z-[6]"
                              style={{left: x1, width: x2-x1, cursor:"grab", background:"rgba(255,255,255,0.01)"}}
                            />
                          );
                        })}
                        {/* badge Delete en región seleccionada */}
                        {selectedReg?.fid===fid && (
                          <div className="absolute top-1 right-1 z-10 flex items-center gap-1 pointer-events-none">
                            <span className="bg-white/10 text-white text-[9px] px-1.5 py-0.5 rounded border border-white/20 select-none">Delete</span>
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}

                {/* CARRIL GUÍAS */}
                <div className="flex border-b border-gray-700" style={{height:GUIDE_H}} ref={guideLaneRef}>
                  <div style={{width:LABEL_W,position:"sticky",left:0,zIndex:10,backgroundColor:"#061612"}}
                    className="shrink-0 flex flex-col justify-center border-r border-gray-700 overflow-hidden">
                    {/* fila 1: colorbar + nombre + clips */}
                    <div className="flex items-center gap-1.5 px-2 pt-1">
                      <div className="w-1.5 h-5 rounded-full bg-emerald-500 shrink-0"/>
                      <p className="text-[10px] text-emerald-400 font-semibold leading-tight flex-1">GUÍAS</p>
                      <span className="text-[9px] text-gray-600">{clips.length}cl</span>
                    </div>
                    {/* fila 2: M S V */}
                    <div className="flex items-center gap-0.5 px-2 py-0.5">
                      <button
                        onClick={()=>{ const next=!muteGuia; setMuteGuia(next); recalcTrackGains(trackMixer, soloGuia, next); }}
                        title="Mute guías"
                        className={`w-5 h-5 rounded text-[9px] font-bold transition flex items-center justify-center ${muteGuia?"bg-red-600 text-white":"bg-gray-700 text-gray-400 hover:bg-gray-600 hover:text-white"}`}>M</button>
                      <button
                        onClick={()=>{ const next=!soloGuia; setSoloGuia(next); recalcTrackGains(trackMixer, next, muteGuia); }}
                        title="Solo guías"
                        className={`w-5 h-5 rounded text-[9px] font-bold transition flex items-center justify-center ${soloGuia?"bg-yellow-400 text-gray-900":"bg-gray-700 text-gray-400 hover:bg-gray-600 hover:text-white"}`}>S</button>
                      <span className="text-[8px] text-gray-600 ml-0.5">V</span>
                      <input type="range" min={0} max={1} step={0.01} value={guiaVolume}
                        onPointerDown={e=>e.stopPropagation()}
                        onChange={e=>{
                          const v=parseFloat(e.target.value); setGuiaVolume(v); guiaVolumeRef.current=v;
                          const anySoloed=Object.values(trackMixer).some(m=>m?.soloed)||soloGuia;
                          const active=anySoloed?soloGuia:!muteGuia;
                          if(guiaGainRef.current) guiaGainRef.current.gain.value=active?guiaBoostRef.current*v:0;
                        }}
                        className="flex-1 h-1 cursor-pointer accent-emerald-400 min-w-0"/>
                    </div>
                    {/* fila 3: P */}
                    <div className="flex items-center gap-0.5 px-2 pb-0.5">
                      <span className="text-[8px] text-gray-600">P</span>
                      <input type="range" min={-1} max={1} step={0.01} value={guiaPan}
                        onPointerDown={e=>e.stopPropagation()}
                        onChange={e=>{
                          const v=parseFloat(e.target.value); setGuiaPan(v); guiaPanValRef.current=v;
                          if(guiaPannerRef.current) guiaPannerRef.current.pan.value=v;
                        }}
                        className="flex-1 h-1 cursor-pointer accent-teal-400 min-w-0"/>
                      <span className="text-[8px] text-gray-500 tabular-nums w-6 text-right">{Math.round(guiaPan*100)}</span>
                    </div>
                    {/* fila 4: G boost — doble clic = ×6 */}
                    <div className="flex items-center gap-0.5 px-2 pb-1">
                      <span className="text-[8px] text-gray-600">G</span>
                      <input type="range" min={0.1} max={12} step={0.1} value={guiaBoost}
                        onPointerDown={e=>e.stopPropagation()}
                        onDoubleClick={()=>{ setGuiaBoost(2.5); guiaBoostRef.current=2.5; recalcTrackGains(trackMixer,soloGuia,muteGuia); }}
                        onChange={e=>{
                          const v=parseFloat(e.target.value); setGuiaBoost(v); guiaBoostRef.current=v;
                          const anySoloed=Object.values(trackMixer).some(m=>m?.soloed)||soloGuia;
                          const active=anySoloed?soloGuia:!muteGuia;
                          if(guiaGainRef.current) guiaGainRef.current.gain.value=active?v*guiaVolumeRef.current:0;
                        }}
                        className="flex-1 h-1 cursor-pointer accent-emerald-600 min-w-0"/>
                      <span className="text-[8px] text-gray-500 tabular-nums w-7 text-right">×{guiaBoost.toFixed(1)}</span>
                    </div>
                  </div>
                  <div className="relative" style={{width:tlWidth,height:GUIDE_H,backgroundColor:"#061612"}}
                    onDragOver={e=>e.preventDefault()} onDrop={onDropGuide}>
                    <div className="absolute inset-x-0" style={{top:"50%",height:1,backgroundColor:"#064e3b60"}}/>
                    {/* líneas de compás sobre el carril guías */}
                    {rulerMode==="bars" && duration>0 && Array.from({length:barCount},(_,bi)=>{
                      const bSec=bi*secPerBar; if(bSec>duration+secPerBar) return null;
                      const x=bSec*zoom;
                      return (
                        <React.Fragment key={`gl${bi}`}>
                          <div className="absolute top-0 bottom-0" style={{left:x,width:1,backgroundColor:"#ffffff18",pointerEvents:"none"}}/>
                          {showBeats && Array.from({length:beatsPerBar-1},(_,ti)=>{
                            const tSec=bSec+(ti+1)*secPerBeat; if(tSec>duration) return null;
                            return <div key={`gb${bi}_${ti}`} className="absolute top-0 bottom-0" style={{left:tSec*zoom,width:1,backgroundColor:"#ffffff08",pointerEvents:"none"}}/>
                          })}
                        </React.Fragment>
                      );
                    })}
                    {rulerMode==="seconds" && Array.from({length:Math.ceil(duration)+1},(_,i)=>i).map(sec=>(
                      <div key={`gs${sec}`} className="absolute top-0 bottom-0" style={{left:sec*zoom,width:1,backgroundColor:sec%5===0?"#ffffff14":"#ffffff07",pointerEvents:"none"}}/>
                    ))}
                    {clips.length===0 && (
                      <p className="absolute inset-0 flex items-center justify-center text-emerald-900/60 text-xs pointer-events-none select-none">
                        ← Arrastra una guía aquí
                      </p>
                    )}
                    {clips.map(clip=>{
                      const left=clip.startTime*zoom;
                      const w=clip.duration>0?Math.max(48,clip.duration*zoom):80;
                      const isAct=activeGuiaClip?.id===clip.id;
                      return (
                        <div key={clip.id}
                          className="absolute top-2 bottom-2 rounded flex items-center overflow-hidden group"
                          style={{left,width:w,backgroundColor:isAct?"#059669ee":"#059669aa",
                            border:`1px solid ${isAct?"#34d399":"#34d39980"}`,
                            cursor:"grab",boxShadow:isAct?"0 0 0 2px #34d39960":"none"}}
                          onMouseDown={e=>onMouseDownClip(e,clip)}
                          title={`${sinExt(clip.fileName)} @ ${fmtMs(clip.startTime)}`}>
                          <GripHorizontal size={10} className="text-emerald-200/50 shrink-0 ml-1"/>
                          <span className="text-white text-[10px] font-medium px-1 truncate flex-1 leading-tight">{sinExt(clip.fileName)}</span>
                          <span className="text-emerald-200/70 text-[9px] shrink-0 pr-0.5 tabular-nums">{fmtMs(clip.startTime)}</span>
                          <button onMouseDown={e=>e.stopPropagation()} onClick={()=>eliminarClip(clip.id)}
                            className="shrink-0 mr-0.5 p-0.5 rounded hover:bg-red-500/60 text-white/50 hover:text-white opacity-0 group-hover:opacity-100 transition">
                            <X size={9}/>
                          </button>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* PLAYHEAD */}
                <div className="absolute top-0 bottom-0 pointer-events-none" style={{left:playheadPx,zIndex:20,width:0}}>
                  <div className="absolute top-0 bottom-0 w-px bg-red-500/90"/>
                  <div className="absolute bg-red-500" style={{top:0,left:-5,width:10,height:10,clipPath:"polygon(50% 100%, 0 0, 100% 0)"}}/>
                </div>

              </div>
            </div>

            {/* CLIPS BAR */}
            {clips.length>0 && (
              <div className="shrink-0 border-t border-gray-800 bg-gray-900 px-3 py-2 max-h-28 overflow-y-auto">
                <div className="flex flex-wrap gap-1.5">
                  {clips.map(clip=>{
                    const isAct=activeGuiaClip?.id===clip.id;
                    return (
                      <div key={clip.id}
                        className={`flex items-center gap-1.5 rounded-lg px-2 py-1.5 border cursor-pointer transition ${isAct?"bg-emerald-900/40 border-emerald-600":"bg-gray-800 border-gray-700 hover:border-gray-500"}`}
                        onClick={()=>{
                          setActiveGuiaClip(clip);
                          doSeek(clip.startTime);
                          // Centrar vista en el punto del clip
                          const cont = scrollContRef.current;
                          if (cont) {
                            const targetX = LABEL_W + clip.startTime * zoom;
                            cont.scrollLeft = Math.max(0, targetX - cont.clientWidth / 2);
                          }
                        }}>
                        <span className="text-emerald-400 text-[11px] font-medium max-w-[90px] truncate">{sinExt(clip.fileName)}</span>
                        <div className="flex items-center gap-0.5">
                          <button onClick={e=>{ e.stopPropagation(); moverClip(clip.id,-0.1); }}
                            className="p-0.5 rounded hover:bg-gray-700 text-gray-500 hover:text-white transition" title="-0.1s">
                            <ChevronLeft size={12}/>
                          </button>
                          <span className="text-gray-400 text-[11px] tabular-nums w-12 text-center">{fmtMs(clip.startTime)}</span>
                          <button onClick={e=>{ e.stopPropagation(); moverClip(clip.id,0.1); }}
                            className="p-0.5 rounded hover:bg-gray-700 text-gray-500 hover:text-white transition" title="+0.1s">
                            <ChevronRight size={12}/>
                          </button>
                        </div>
                        <button onClick={e=>{ e.stopPropagation(); eliminarClip(clip.id); }}
                          className="text-gray-600 hover:text-red-400 transition">
                          <Trash2 size={11}/>
                        </button>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
