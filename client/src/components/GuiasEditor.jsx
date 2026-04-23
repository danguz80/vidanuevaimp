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
  ZoomIn, ZoomOut, Plus, Scissors, MousePointer, Volume2, VolumeX,
} from "lucide-react";
import { idbGet, idbSet } from "../utils/audioOfflineCache";

const API_URL = import.meta.env.VITE_BACKEND_URL || "https://iglesia-backend.onrender.com";

const TRACK_COLORS = [
  "#6366f1","#10b981","#f59e0b","#ef4444","#8b5cf6",
  "#06b6d4","#84cc16","#f97316","#ec4899","#14b8a6",
];

const LABEL_W = 128;
const RULER_H  = 40;
const TRACK_H  = 60;
const GUIDE_H  = 68;

function fmt(s)   { if (!Number.isFinite(s)||s<0) return "0:00"; return `${Math.floor(s/60)}:${String(Math.floor(s%60)).padStart(2,"0")}`; }
function fmtMs(s) { if (!Number.isFinite(s)||s<0) return "0:00.0"; return `${Math.floor(s/60)}:${(s%60).toFixed(1).padStart(4,"0")}`; }
function sinExt(n){ return (n||"").replace(/\.[^.]+$/,""); }

let _uid=1;
const uid = () => `id_${Date.now()}_${_uid++}`;

/* ─── Dibujo de waveform con regiones activas ─────────────────────────────── */
function drawWaveformWithRegions(canvas, buffer, color, regions, selectedId) {
  if (!canvas || !buffer) return;
  const ctx  = canvas.getContext("2d");
  const W    = canvas.width;
  const H    = canvas.height;
  const dur  = buffer.duration;
  const data = buffer.getChannelData(0);
  const step = Math.max(1, Math.floor(data.length / W));
  const amp  = (H / 2) * 0.88;

  ctx.clearRect(0, 0, W, H);
  ctx.fillStyle = "#ffffff06";
  ctx.fillRect(0, 0, W, H);

  // línea central
  ctx.strokeStyle = "#ffffff12";
  ctx.lineWidth = 0.5;
  ctx.beginPath(); ctx.moveTo(0,H/2); ctx.lineTo(W,H/2); ctx.stroke();

  // helper: dibuja líneas de waveform entre columnas x1..x2
  const drawLines = (x1, x2, strokeColor, lw=1) => {
    ctx.strokeStyle = strokeColor; ctx.lineWidth = lw; ctx.beginPath();
    for (let i=Math.max(0,x1); i<Math.min(W,x2); i++) {
      let mn=0, mx=0;
      for (let j=0;j<step;j++) { const d=data[i*step+j]??0; if(d<mn)mn=d; if(d>mx)mx=d; }
      ctx.moveTo(i+.5, H/2+mn*amp); ctx.lineTo(i+.5, H/2+mx*amp);
    }
    ctx.stroke();
  };

  // 1. waveform completa tenue (fondo / zonas eliminadas)
  drawLines(0, W, color+"22");

  // 2. por cada región activa, dibujar la waveform viva + borde
  for (const r of regions) {
    const x1 = Math.floor((r.start/dur)*W);
    const x2 = Math.ceil ((r.end  /dur)*W);
    const sel = r.id === selectedId;

    ctx.fillStyle = sel ? color+"44" : color+"1c";
    ctx.fillRect(x1, 0, x2-x1, H);

    ctx.save();
    ctx.beginPath(); ctx.rect(x1,0,x2-x1,H); ctx.clip();
    drawLines(x1, x2, sel?"#ffffff": color, sel?1.3:1);
    ctx.restore();

    ctx.strokeStyle = sel ? "#ffffffa0" : color+"80";
    ctx.lineWidth   = sel ? 1.5 : 1;
    ctx.strokeRect(x1+.5, .5, x2-x1-1, H-1);
  }
}

/* ─── Componente principal ────────────────────────────────────────────────── */
export default function GuiasEditor({ folderId, folderName, tracks=[], getToken, onClose, onSaved }) {

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
  const guiaSrcRef    = useRef(null);

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
  const [selectedReg,   setSelectedReg]   = useState(null); // {fid,id}
  const [tool,          setTool]          = useState("select");
  const [soloGuia,      setSoloGuia]      = useState(false);
  const [saving,        setSaving]        = useState(false);
  const [playing,       setPlaying]       = useState(false);
  const [currentTime,   setCurrentTime]   = useState(0);
  const [duration,      setDuration]      = useState(0);
  const [zoom,          setZoom]          = useState(6);
  const [bpm,           setBpm]           = useState(120);
  const [beatsPerBar,   setBeatsPerBar]   = useState(4);
  const [showBeats,     setShowBeats]     = useState(true);
  const [activeGuiaClip,setActiveGuiaClip]= useState(null);
  const [previewId,     setPreviewId]     = useState(null);
  const previewAudio  = useRef(new Audio());
  const canvasRefs    = useRef({});
  const scrollContRef = useRef(null);
  const guideLaneRef  = useRef(null);

  const tlWidth = Math.max(800, Math.ceil(duration)*zoom);

  /* helper: obtiene regiones de un track */
  const getRegs = (fid, buf) =>
    trackRegions[fid] ?? (buf ? [{ id:`r0_${fid}`, start:0, end:buf.duration }] : []);

  /* ── carga inicial ───────────────────────────────────────────────────────── */
  useEffect(() => {
    const hdrs = { Authorization:`Bearer ${getToken()}` };
    const actx = new (window.AudioContext||window.webkitAudioContext)();
    ctxRef.current = actx;
    const mg = actx.createGain(); mg.gain.value=.85; mg.connect(actx.destination); masterGainRef.current=mg;
    const gg = actx.createGain(); gg.gain.value=.9;  gg.connect(actx.destination); guiaGainRef.current=gg;

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
        if(Array.isArray(d.clips))     setClips(d.clips);
        if(d.trackRegions)             setTrackRegions(d.trackRegions);
        if(d.bpm)                      setBpm(d.bpm);
        if(d.beatsPerBar)              setBeatsPerBar(d.beatsPerBar);
      }).catch(()=>{}).finally(()=>setLoadingClips(false));

    return ()=>{
      clearInterval(tickRef.current);
      sourcesRef.current.forEach(s=>{ try{s.stop();}catch{} });
      actx.close().catch(()=>{}); previewAudio.current.pause();
    };
  },[]); // eslint-disable-line

  /* ── redibujar waveforms ─────────────────────────────────────────────────── */
  useEffect(()=>{
    tracks.forEach((track,i)=>{
      const fid=track.id||track.fileId;
      const buf=buffers[fid]; const canvas=canvasRefs.current[fid];
      if(!buf||!canvas) return;
      canvas.width=tlWidth; canvas.height=TRACK_H;
      const regs = getRegs(fid,buf);
      const selId = selectedReg?.fid===fid ? selectedReg.id : null;
      drawWaveformWithRegions(canvas, buf, TRACK_COLORS[i%TRACK_COLORS.length], regs, selId);
    });
  },[buffers,tlWidth,tracks,trackRegions,selectedReg]); // eslint-disable-line

  /* ── teclado: Delete para eliminar región seleccionada ───────────────────── */
  useEffect(()=>{
    const onKey=e=>{
      if(!selectedReg) return;
      if(["INPUT","SELECT","TEXTAREA"].includes(e.target.tagName)) return;
      if(e.key==="Delete"||e.key==="Backspace"){
        deleteRegion(selectedReg.fid, selectedReg.id);
        setSelectedReg(null);
      }
    };
    window.addEventListener("keydown",onKey);
    return ()=>window.removeEventListener("keydown",onKey);
  },[selectedReg]); // eslint-disable-line

  /* ── playback ────────────────────────────────────────────────────────────── */
  const stopSources = useCallback(()=>{
    sourcesRef.current.forEach(s=>{ try{s.stop();}catch{} }); sourcesRef.current=[];
    if(guiaSrcRef.current){ try{guiaSrcRef.current.stop();}catch{} guiaSrcRef.current=null; }
  },[]);

  const stopAll = useCallback(()=>{
    clearInterval(tickRef.current); stopSources();
    offsetRef.current=0; setCurrentTime(0); setPlaying(false); playingRef.current=false;
  },[stopSources]);

  const startPlayback = useCallback((fromOffset, gClip=null)=>{
    const actx=ctxRef.current; if(!actx) return;
    const startAt=actx.currentTime+0.05;
    startTimeRef.current=startAt-fromOffset;

    if(!soloGuia){
      tracks.forEach(track=>{
        const fid=track.id||track.fileId; const buf=buffers[fid]; if(!buf) return;
        const regs=trackRegions[fid]??[{id:`r0_${fid}`,start:0,end:buf.duration}];
        regs.forEach(r=>{
          if(fromOffset>=r.end) return;
          const bufOff = fromOffset>=r.start ? fromOffset : r.start;
          const segDur = r.end-bufOff;
          const delay  = fromOffset>=r.start ? 0 : r.start-fromOffset;
          if(segDur<=0) return;
          const src=actx.createBufferSource(); src.buffer=buf;
          src.connect(masterGainRef.current);
          src.start(startAt+delay, bufOff, segDur);
          sourcesRef.current.push(src);
        });
      });
    }

    if(gClip){
      const gBuf=guiaBuffers[gClip.fileId];
      if(gBuf){
        const off   = Math.max(0, fromOffset-gClip.startTime);
        const delay = fromOffset<=gClip.startTime ? gClip.startTime-fromOffset : 0;
        if(off<gBuf.duration){
          const gs=actx.createBufferSource(); gs.buffer=gBuf;
          gs.connect(guiaGainRef.current); gs.start(startAt+delay,off);
          guiaSrcRef.current=gs;
        }
      }
    }

    setPlaying(true); playingRef.current=true;
    tickRef.current=setInterval(()=>{
      if(!playingRef.current||!ctxRef.current) return;
      const el=ctxRef.current.currentTime-startTimeRef.current;
      const cl=Math.min(el,durationRef.current);
      setCurrentTime(cl);
      const cont=scrollContRef.current;
      if(cont){ const ph=LABEL_W+cl*zoom; if(ph>cont.scrollLeft+cont.clientWidth-80) cont.scrollLeft=ph-cont.clientWidth/2; }
      if(el>=durationRef.current) stopAll();
    },50);
  },[buffers,guiaBuffers,soloGuia,tracks,trackRegions,zoom,stopAll]);

  const doSeek = useCallback((t)=>{
    const was=playingRef.current;
    if(was){ clearInterval(tickRef.current); stopSources(); playingRef.current=false; setPlaying(false); }
    offsetRef.current=t; setCurrentTime(t);
    if(was) startPlayback(t, activeGuiaClip);
  },[activeGuiaClip,startPlayback,stopSources]);

  const play  = async gc=>{
    const actx=ctxRef.current; if(!actx) return;
    if(actx.state==="suspended") await actx.resume();
    startPlayback(offsetRef.current, gc??activeGuiaClip);
  };
  const pause = ()=>{
    clearInterval(tickRef.current);
    if(ctxRef.current){ const el=ctxRef.current.currentTime-startTimeRef.current; offsetRef.current=Math.min(Math.max(el,0),durationRef.current); }
    stopSources(); setPlaying(false); playingRef.current=false;
  };
  const togglePlay = ()=>{ if(playing) pause(); else play(); };
  const onSeekBar  = e=>doSeek(parseFloat(e.target.value));

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
      /* encontrar la región que contiene t y dividirla */
      const idx=regs.findIndex(r=>t>r.start+0.05&&t<r.end-0.05);
      if(idx===-1) return;
      const r=regs[idx];
      const next=[...regs];
      const a={id:uid(),start:r.start,end:t};
      const b={id:uid(),start:t,end:r.end};
      next.splice(idx,1,a,b);
      setTrackRegions(prev=>({...prev,[fid]:next}));
      setSelectedReg({fid,id:b.id}); // selecciona el fragmento derecho
    } else {
      /* SELECT: clic en región → seleccionar; clic en hueco → seekear */
      const hit=regs.find(r=>t>=r.start&&t<=r.end);
      if(hit){ setSelectedReg({fid,id:hit.id}); }
      else   { setSelectedReg(null); doSeek(t); }
    }
  },[tool,zoom,trackRegions,doSeek]);

  /* ── gestión de regiones ─────────────────────────────────────────────────── */
  const deleteRegion = useCallback((fid,rid)=>{
    setTrackRegions(prev=>{
      const regs=prev[fid]; if(!regs) return prev;
      return {...prev,[fid]:regs.filter(r=>r.id!==rid)};
    });
  },[]);

  const resetRegions = useCallback((fid)=>{
    setTrackRegions(prev=>{ const n={...prev}; delete n[fid]; return n; });
    setSelectedReg(sr=>sr?.fid===fid?null:sr);
  },[]);

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

  const agregarClip = useCallback(async(file,startTime)=>{
    const clip={id:uid(),fileId:file.id,fileName:file.name,startTime:parseFloat(Math.max(0,startTime).toFixed(2)),duration:0};
    setClips(prev=>[...prev,clip]); setActiveGuiaClip(clip);
    await cargarGuiaBuffer(file.id);
    offsetRef.current=clip.startTime; setCurrentTime(clip.startTime);
  },[cargarGuiaBuffer]);

  const eliminarClip = id=>{ setClips(p=>p.filter(c=>c.id!==id)); setActiveGuiaClip(p=>p?.id===id?null:p); };

  const moverClip = (id,delta)=>{
    const ns=c=>parseFloat(Math.max(0,c.startTime+delta).toFixed(3));
    setClips(p=>p.map(c=>c.id===id?{...c,startTime:ns(c)}:c));
    setActiveGuiaClip(p=>p?.id===id?{...p,startTime:ns(p)}:p);
  };

  const onMouseDownClip = useCallback((e,clip)=>{
    e.preventDefault(); e.stopPropagation(); setActiveGuiaClip(clip);
    const sx=e.clientX, st=clip.startTime;
    const onMove=ev=>{
      const ns=parseFloat(Math.max(0,st+(ev.clientX-sx)/zoom).toFixed(3));
      setClips(p=>p.map(c=>c.id===clip.id?{...c,startTime:ns}:c));
      setActiveGuiaClip(p=>p?.id===clip.id?{...p,startTime:ns}:p);
    };
    const onUp=()=>{ window.removeEventListener("mousemove",onMove); window.removeEventListener("mouseup",onUp); };
    window.addEventListener("mousemove",onMove); window.addEventListener("mouseup",onUp);
  },[zoom]);

  const onDropGuide = useCallback(e=>{
    e.preventDefault();
    const fileId=e.dataTransfer.getData("fileId"); const fileName=e.dataTransfer.getData("fileName");
    if(!fileId) return;
    const rect=guideLaneRef.current.getBoundingClientRect();
    const sl=scrollContRef.current?.scrollLeft||0;
    agregarClip({id:fileId,name:fileName},(e.clientX-rect.left+sl-LABEL_W)/zoom);
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
    setSaving(true);
    try{
      const r=await fetch(`${API_URL}/api/musica/guias/${encodeURIComponent(folderId)}`,{
        method:"POST", headers:{Authorization:`Bearer ${getToken()}`,"Content-Type":"application/json"},
        body:JSON.stringify({clips,trackRegions,bpm,beatsPerBar}),
      });
      const d=await r.json(); if(d.error) throw new Error(d.error);
      onSaved?.(clips);
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
        {tool==="split" && (
          <span className="text-amber-400/70 text-[10px] shrink-0 hidden sm:block">
            Clic sobre la waveform → divide · luego Selec. + Delete para borrar
          </span>
        )}
        {selectedReg && tool==="select" && (
          <button onClick={()=>{ deleteRegion(selectedReg.fid,selectedReg.id); setSelectedReg(null); }}
            className="flex items-center gap-1 px-2 py-1.5 bg-red-700 hover:bg-red-600 text-white text-[11px] font-semibold rounded-lg transition shrink-0">
            <Trash2 size={11}/> Eliminar región
          </button>
        )}

        {/* solo guía */}
        <button onClick={()=>setSoloGuia(s=>!s)}
          className={`flex items-center gap-1 px-2 py-1 rounded text-[11px] transition shrink-0 ${soloGuia?"bg-emerald-700 text-white":"bg-gray-800 text-gray-400 hover:text-white"}`}>
          {soloGuia ? <VolumeX size={12}/> : <Volume2 size={12}/>}
          {soloGuia?"Solo guía":"Todas"}
        </button>

        {/* BPM + métrica */}
        <div className="flex items-center gap-1.5 shrink-0 bg-gray-900 rounded-lg px-2 py-1">
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
        </div>

        {/* zoom */}
        <div className="flex items-center gap-1 shrink-0">
          <button onClick={()=>setZoom(z=>Math.max(2,z-1))} className="p-1.5 rounded hover:bg-gray-800 text-gray-400 hover:text-white transition"><ZoomOut size={13}/></button>
          <span className="text-gray-500 text-[11px] tabular-nums w-10 text-center">{zoom}px/s</span>
          <button onClick={()=>setZoom(z=>Math.min(48,z+2))} className="p-1.5 rounded hover:bg-gray-800 text-gray-400 hover:text-white transition"><ZoomIn size={13}/></button>
        </div>

        <button onClick={guardar} disabled={saving||isLoading}
          className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold rounded-lg transition disabled:opacity-50 shrink-0">
          {saving?<Loader2 size={12} className="animate-spin"/>:<Save size={12}/>} Guardar
        </button>
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
                    <button onClick={()=>agregarClip(file,offsetRef.current)} className="p-1 rounded hover:bg-emerald-700 text-gray-400 hover:text-emerald-300 transition">
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
                    <span className="text-gray-600 text-[9px] font-semibold tracking-widest">COMPÁS</span>
                    <span className="text-gray-700 text-[9px]">SEG</span>
                  </div>
                  <div className="relative cursor-pointer" style={{width:tlWidth,height:RULER_H}}
                    onClick={e=>{
                      const cont=scrollContRef.current; if(!cont) return;
                      const rect=cont.getBoundingClientRect();
                      const x=e.clientX-rect.left+cont.scrollLeft-LABEL_W;
                      doSeek(Math.max(0,Math.min(x/zoom,durationRef.current)));
                    }}>
                    <div className="absolute w-full" style={{top:RULER_H/2,height:1,backgroundColor:"#1f2937"}}/>
                    {/* compases */}
                    {duration>0 && Array.from({length:barCount},(_,bi)=>{
                      const bSec=bi*secPerBar; if(bSec>duration+secPerBar) return null;
                      const x=bSec*zoom;
                      return (
                        <React.Fragment key={`b${bi}`}>
                          <div className="absolute" style={{left:x,top:0,width:1,height:RULER_H/2,backgroundColor:"#374151"}}/>
                          <span className="absolute text-[9px] text-gray-500 select-none whitespace-nowrap" style={{left:x+2,top:2,lineHeight:1}}>{bi+1}</span>
                          {showBeats && Array.from({length:beatsPerBar-1},(_,ti)=>{
                            const tSec=bSec+(ti+1)*secPerBeat; if(tSec>duration) return null;
                            return <div key={`t${bi}_${ti}`} className="absolute" style={{left:tSec*zoom,top:RULER_H/4,width:1,height:RULER_H/4,backgroundColor:"#374151"}}/>;
                          })}
                        </React.Fragment>
                      );
                    })}
                    {/* segundos */}
                    {Array.from({length:Math.ceil(duration)+1},(_,i)=>i).map(sec=>{
                      const major=sec%5===0;
                      return (
                        <div key={`s${sec}`} className="absolute" style={{left:sec*zoom,top:RULER_H/2}}>
                          <div style={{width:1,height:major?10:5,backgroundColor:major?"#6b7280":"#374151"}}/>
                          {major && <span className="absolute text-[9px] text-gray-500 ml-0.5 select-none whitespace-nowrap" style={{top:10}}>{fmt(sec)}</span>}
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
                  const hasEdits = !!trackRegions[fid];
                  const cursor = tool==="split" ? "crosshair" : "default";
                  return (
                    <div key={fid} className="flex border-b border-gray-800" style={{height:TRACK_H}}>
                      {/* label */}
                      <div style={{width:LABEL_W,position:"sticky",left:0,zIndex:10,backgroundColor:"#0d1117"}}
                        className="shrink-0 flex items-center gap-1.5 px-2 border-r border-gray-800">
                        <div className="w-1.5 h-8 rounded-full shrink-0" style={{backgroundColor:color}}/>
                        <div className="min-w-0 flex-1">
                          <p className="text-[11px] text-gray-400 truncate leading-tight" title={track.name}>
                            {sinExt(track.name||`Track ${i+1}`)}
                          </p>
                          {hasEdits && (
                            <button onClick={()=>resetRegions(fid)}
                              className="text-[9px] text-amber-500 hover:text-amber-300 flex items-center gap-0.5 mt-0.5 transition">
                              <Scissors size={8}/> reset
                            </button>
                          )}
                        </div>
                      </div>
                      {/* waveform */}
                      <div className="relative" style={{width:tlWidth,height:TRACK_H,cursor}}
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
                        {/* pista activa seleccionada: botón delete flotante */}
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
                    className="shrink-0 flex items-center gap-2 px-2 border-r border-gray-700">
                    <div className="w-1.5 h-8 rounded-full bg-emerald-500 shrink-0"/>
                    <div>
                      <p className="text-[11px] text-emerald-400 font-semibold leading-tight">GUÍAS</p>
                      <p className="text-[9px] text-gray-600 leading-tight">{clips.length} clip{clips.length!==1?"s":""}</p>
                    </div>
                  </div>
                  <div className="relative" style={{width:tlWidth,height:GUIDE_H,backgroundColor:"#061612"}}
                    onDragOver={e=>e.preventDefault()} onDrop={onDropGuide}>
                    <div className="absolute inset-x-0" style={{top:"50%",height:1,backgroundColor:"#064e3b60"}}/>
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
                        onClick={()=>{ setActiveGuiaClip(clip); offsetRef.current=clip.startTime; setCurrentTime(clip.startTime); }}>
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
