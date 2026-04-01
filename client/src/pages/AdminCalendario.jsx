import React, { useState, useEffect, useRef } from "react";
import { useAuth } from "../context/AuthContext";
import AdminNav from "../components/AdminNav";
import jsPDF from "jspdf";
import html2canvas from "html2canvas";

const API = import.meta.env.VITE_BACKEND_URL;

// ---------------------------------------------------------------------------
// Helpers de fecha sin conversión de zona horaria
// La BD devuelve fechas con sufijo UTC (Z), pero los eventos se almacenan con
// la hora local ingresada. Estos helpers evitan que el navegador convierta.
// ---------------------------------------------------------------------------

// Parsea un string de fecha de la API como hora local (sin conversión tz)
function parseLocalDate(str) {
  if (!str) return null;
  return new Date(str.slice(0, 16)); // "2026-03-19T11:30" → hora local
}

// Devuelve "YYYY-MM-DD" usando la hora local del Date (no UTC)
function toLocalDateStr(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

// Devuelve "YYYY-MM-DDTHH:mm" usando la hora local (no UTC)
function toLocalISOString(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  const h = String(date.getHours()).padStart(2, "0");
  const min = String(date.getMinutes()).padStart(2, "0");
  return `${y}-${m}-${d}T${h}:${min}`;
}

const DIAS_SEMANA = ["Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado", "Domingo"];
const MESES = ["Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio", "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"];

// Renderiza texto convirtiendo URLs en hipervínculos clicables
function renderTexto(texto) {
  if (!texto) return null;
  const urlRegex = /(https?:\/\/[^\s]+)/g;
  const partes = texto.split(urlRegex);
  return partes.map((parte, i) =>
    urlRegex.test(parte)
      ? <a key={i} href={parte} target="_blank" rel="noopener noreferrer" className="text-blue-600 underline hover:text-blue-800 break-all">{parte}</a>
      : parte
  );
}

const COLORES_EVENTO = [
  { label: "Azul",   value: "#3B82F6" },
  { label: "Verde",  value: "#10B981" },
  { label: "Morado", value: "#8B5CF6" },
  { label: "Rojo",   value: "#EF4444" },
  { label: "Naranja",value: "#F97316" },
  { label: "Amarillo",value: "#EAB308" },
  { label: "Rosa",   value: "#EC4899" },
  { label: "Gris",   value: "#6B7280" },
];

const FORM_INICIAL = {
  titulo: "",
  descripcion: "",
  imagen_url: "",
  fecha_inicio: "",
  fecha_fin: "",
  lugar: "",
  tipo: "especial",
  recurrencia: "ninguna",
  dia_semana: "",
  encargado_id: "",
  coordinador_id: "",
  predicador_id: "",
  notas: "",
  color: "#3B82F6",
  zoom_link: "",
};

function Avatar({ nombre, apellido, foto_url, label }) {
  const initials = `${nombre?.[0] || ""}${apellido?.[0] || ""}`.toUpperCase();
  return (
    <div className="flex items-center gap-2">
      {foto_url ? (
        <img src={foto_url} className="w-7 h-7 rounded-full object-cover border border-gray-200 flex-shrink-0" alt="" />
      ) : (
        <div className="w-7 h-7 rounded-full bg-indigo-100 flex items-center justify-center text-xs font-bold text-indigo-600 flex-shrink-0">{initials}</div>
      )}
      <span>{label && <span className="font-medium">{label}: </span>}{nombre} {apellido}</span>
    </div>
  );
}

function diasEnMes(anio, mes) {
  return new Date(anio, mes + 1, 0).getDate();
}

// Devuelve el offset lunes=0 … domingo=6
function primerDiaMes(anio, mes) {
  const dia = new Date(anio, mes, 1).getDay(); // 0=dom,1=lun…6=sab
  return dia === 0 ? 6 : dia - 1;
}

// Aplica el override de ocurrencia (si existe para esa fecha) sobre un evento base
function mergeOc(ev, fecha) {
  if (!ev.ocurrencias || !Array.isArray(ev.ocurrencias)) return ev;
  const fs = fecha.toLocaleDateString("sv"); // "2026-03-19" usando hora local
  const oc = ev.ocurrencias.find(o => o.fecha && String(o.fecha).slice(0, 10) === fs);
  if (!oc) return ev;
  // Para las fotos: si la ocurrencia asigna un id, se usa la foto de esa persona
  // (aunque sea null porque no tiene foto). Solo se hereda la foto base si no se asignó nadie.
  const tieneEncargadoOc = oc.encargado_id   !== undefined && oc.encargado_id   !== null;
  const tieneCoordOc     = oc.coordinador_id !== undefined && oc.coordinador_id !== null;
  const tienePredOc      = oc.predicador_id  !== undefined && oc.predicador_id  !== null;
  return {
    ...ev,
    encargado_id:         oc.encargado_id        !== undefined ? oc.encargado_id        : ev.encargado_id,
    encargado_nombre:     oc.encargado_nombre    != null      ? oc.encargado_nombre    : ev.encargado_nombre,
    encargado_apellido:   oc.encargado_apellido  != null      ? oc.encargado_apellido  : ev.encargado_apellido,
    encargado_foto:       tieneEncargadoOc ? oc.encargado_foto   : ev.encargado_foto,
    coordinador_id:       oc.coordinador_id      !== undefined ? oc.coordinador_id      : ev.coordinador_id,
    coordinador_nombre:   oc.coordinador_id      !== undefined ? (tieneCoordOc ? oc.coordinador_nombre   : null) : ev.coordinador_nombre,
    coordinador_apellido: oc.coordinador_id      !== undefined ? (tieneCoordOc ? oc.coordinador_apellido : null) : ev.coordinador_apellido,
    coordinador_foto:     oc.coordinador_id      !== undefined ? (tieneCoordOc ? oc.coordinador_foto     : null) : ev.coordinador_foto,
    predicador_id:        oc.predicador_id       !== undefined ? oc.predicador_id       : ev.predicador_id,
    predicador_nombre:    oc.predicador_id       !== undefined ? (tienePredOc  ? oc.predicador_nombre    : null) : ev.predicador_nombre,
    predicador_apellido:  oc.predicador_id       !== undefined ? (tienePredOc  ? oc.predicador_apellido  : null) : ev.predicador_apellido,
    predicador_foto:      oc.predicador_id       !== undefined ? (tienePredOc  ? oc.predicador_foto      : null) : ev.predicador_foto,
    notas:                oc.notas               != null      ? oc.notas                : ev.notas,
  };
}

// Expande un evento recurrente dentro de un mes dado
function expandirEventos(eventos, anio, mes) {
  const resultado = [];
  const primerDia = new Date(anio, mes, 1);
  const ultimoDia = new Date(anio, mes + 1, 0);

  for (const ev of eventos) {
    const inicio = parseLocalDate(ev.fecha_inicio);

    if (ev.tipo === "recurrente" && ev.recurrencia !== "ninguna") {
      switch (ev.recurrencia) {
        case "semanal": {
          const diaSemana = ev.dia_semana ?? inicio.getDay();
          // Encontrar el primer día del mes que coincida con el día de semana
          let d = new Date(anio, mes, 1);
          while (d.getDay() !== diaSemana) d.setDate(d.getDate() + 1);
          while (d <= ultimoDia) {
            resultado.push({ ...mergeOc(ev, d), _fecha: new Date(d), _key: `${ev.id}-${d.getDate()}` });
            d.setDate(d.getDate() + 7);
          }
          break;
        }
        case "quincenal": {
          const diaSemana = ev.dia_semana ?? inicio.getDay();
          let d = new Date(anio, mes, 1);
          while (d.getDay() !== diaSemana) d.setDate(d.getDate() + 1);
          let count = 0;
          while (d <= ultimoDia) {
            if (count % 2 === 0) {
              resultado.push({ ...mergeOc(ev, d), _fecha: new Date(d), _key: `${ev.id}-${d.getDate()}` });
            }
            d.setDate(d.getDate() + 7);
            count++;
          }
          break;
        }
        case "mensual": {
          const dia = inicio.getDate();
          const fecha = new Date(anio, mes, dia);
          if (fecha >= primerDia && fecha <= ultimoDia) {
            resultado.push({ ...mergeOc(ev, fecha), _fecha: fecha, _key: `${ev.id}-m` });
          }
          break;
        }
        case "anual": {
          if (inicio.getMonth() === mes) {
            const fecha = new Date(anio, mes, inicio.getDate());
            resultado.push({ ...mergeOc(ev, fecha), _fecha: fecha, _key: `${ev.id}-a` });
          }
          break;
        }
        default: break;
      }
    } else {
      // Evento especial (una sola vez)
      if (inicio.getFullYear() === anio && inicio.getMonth() === mes) {
        resultado.push({ ...mergeOc(ev, inicio), _fecha: inicio, _key: `${ev.id}` });
      }
    }
  }
  return resultado;
}

// Normaliza URLs relativas añadiendo / al inicio si es necesario
const normUrl = (url) => {
  if (!url) return null;
  if (url.startsWith("http://") || url.startsWith("https://") || url.startsWith("/")) return url;
  return "/" + url;
};

export default function AdminCalendario() {
  const { getToken } = useAuth();
  const calendarRef = useRef(null);
  const [eventos, setEventos] = useState([]);
  const [miembros, setMiembros] = useState([]);
  const [loading, setLoading] = useState(true);
  const [hoy] = useState(new Date());
  const [mesActual, setMesActual] = useState(new Date().getMonth());
  const [anioActual, setAnioActual] = useState(new Date().getFullYear());
  const [modalAbierto, setModalAbierto] = useState(false);
  const [editando, setEditando] = useState(null);
  const [form, setForm] = useState(FORM_INICIAL);
  const [guardando, setGuardando] = useState(false);
  const [diaSeleccionado, setDiaSeleccionado] = useState(null);
  const [vistaEvento, setVistaEvento] = useState(null);
  const [ocForm, setOcForm] = useState({ encargado_id: "", coordinador_id: "", predicador_id: "", notas: "" });
  const [guardandoOc, setGuardandoOc] = useState(false);

  // Portero del mes
  const [portero, setPortero] = useState(null); // { miembro_id, nombre, apellido, foto_url }
  const [guardandoPortero, setGuardandoPortero] = useState(false);
  const [porteroSeleccionado, setPorteroSeleccionado] = useState("");

  // PDF
  const [generandoPDF, setGenerandoPDF] = useState(false);

  // Hero
  const [heroEventoIds, setHeroEventoIds] = useState(new Set());
  const [togglingHero, setTogglingHero] = useState(null); // id del evento en proceso

  // Disponibilidad bloqueada
  const [bloqueadosPorFecha, setBloqueadosPorFecha] = useState(new Set()); // IDs de miembros no disponibles

  const headers = () => ({ Authorization: `Bearer ${getToken()}` });

  const cargar = async () => {
    try {
      const [resEv, resMem, resHero] = await Promise.all([
        fetch(`${API}/api/eventos`, { headers: headers() }),
        fetch(`${API}/api/miembros`, { headers: headers() }),
        fetch(`${API}/api/hero/eventos-ids`, { headers: headers() }),
      ]);
      const ev = await resEv.json();
      const mem = await resMem.json();
      const heroIds = await resHero.json();
      setEventos(Array.isArray(ev) ? ev : []);
      setMiembros(Array.isArray(mem) ? mem : []);
      setHeroEventoIds(new Set(Array.isArray(heroIds) ? heroIds : []));
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  // Cargar portero cada vez que cambia el mes/año
  const cargarPortero = async (anio, mes) => {
    try {
      const res = await fetch(`${API}/api/portero-mes/${anio}/${mes + 1}`, { headers: headers() });
      const data = await res.json();
      setPortero(data);
      setPorteroSeleccionado(data?.miembro_id ? String(data.miembro_id) : "");
    } catch {
      setPortero(null);
      setPorteroSeleccionado("");
    }
  };

  useEffect(() => { cargar(); }, []);
  useEffect(() => { cargarPortero(anioActual, mesActual); }, [anioActual, mesActual]);

  const agregarAlHero = async (ev) => {
    setTogglingHero(ev.id);
    try {
      const res = await fetch(`${API}/api/hero/from-evento/${ev.id}`, {
        method: "POST", headers: headers(),
      });
      if (!res.ok) {
        const data = await res.json();
        alert(data.error || "Error al agregar al Hero");
        return;
      }
      setHeroEventoIds(prev => new Set([...prev, ev.id]));
    } catch {
      alert("Error de conexión");
    } finally {
      setTogglingHero(null);
    }
  };

  const quitarDelHero = async (ev) => {
    setTogglingHero(ev.id);
    try {
      const res = await fetch(`${API}/api/hero/from-evento/${ev.id}`, {
        method: "DELETE", headers: headers(),
      });
      if (!res.ok) { alert("Error al quitar del Hero"); return; }
      setHeroEventoIds(prev => { const s = new Set(prev); s.delete(ev.id); return s; });
    } catch {
      alert("Error de conexión");
    } finally {
      setTogglingHero(null);
    }
  };

  const cargarBloqueados = async (fecha) => {
    if (!fecha) { setBloqueadosPorFecha(new Set()); return; }
    try {
      const fechaSolo = fecha.slice(0, 10);
      const res = await fetch(
        `${API}/api/miembros/disponibilidad-bloqueada?fecha=${fechaSolo}`,
        { headers: headers() }
      );
      const ids = await res.json();
      setBloqueadosPorFecha(new Set(Array.isArray(ids) ? ids : []));
    } catch {
      setBloqueadosPorFecha(new Set());
    }
  };

  const guardarPortero = async (miembro_id) => {
    setGuardandoPortero(true);
    try {
      const res = await fetch(`${API}/api/portero-mes/${anioActual}/${mesActual + 1}`, {
        method: "PUT",
        headers: { ...headers(), "Content-Type": "application/json" },
        body: JSON.stringify({ miembro_id: miembro_id || null }),
      });
      const data = await res.json();
      setPortero(data);
    } catch {
      alert("Error al guardar portero del mes");
    } finally {
      setGuardandoPortero(false);
    }
  };

  const mesAnterior = () => {
    if (mesActual === 0) { setMesActual(11); setAnioActual(a => a - 1); }
    else setMesActual(m => m - 1);
  };
  const mesSiguiente = () => {
    if (mesActual === 11) { setMesActual(0); setAnioActual(a => a + 1); }
    else setMesActual(m => m + 1);
  };

  // --- Generación de PDF ---
  const generarPDF = async () => {
    setGenerandoPDF(true);
    try {
      // ── 12 colores de cabecera, uno por mes ──────────────────────────────────
      const COLORES_MES = [
        [13,  71, 161],  // Enero     — azul profundo
        [106,  27, 154], // Febrero   — violeta
        [0,   105,  62], // Marzo     — verde selva
        [183,  28,  28], // Abril     — rojo (Semana Santa)
        [230,  81,   0], // Mayo      — naranja
        [0,   131, 143], // Junio     — cian oscuro
        [74,   20, 140], // Julio     — morado
        [0,    77,  64], // Agosto    — verde azulado
        [27,   94,  32], // Septiembre— verde patria
        [121,  85,  72], // Octubre   — marrón cálido
        [21,  101, 192], // Noviembre — azul marino
        [183,  28,  28], // Diciembre — rojo Navidad
      ];
      const [cR, cG, cB] = COLORES_MES[mesActual];

      // ── Feriados de Chile (cálculo dinámico vía algoritmo de Gauss) ──────────
      const calcularFeriados = (anio) => {
        const a = anio % 19, b = Math.floor(anio / 100), c = anio % 100;
        const d = Math.floor(b / 4), e = b % 4;
        const f = Math.floor((b + 8) / 25), gg = Math.floor((b - f + 1) / 3);
        const hh = (19 * a + b - d - gg + 15) % 30;
        const ii = Math.floor(c / 4), k = c % 4;
        const l  = (32 + 2 * e + 2 * ii - hh - k) % 7;
        const mm = Math.floor((a + 11 * hh + 22 * l) / 451);
        const mesP = Math.floor((hh + l - 7 * mm + 114) / 31);
        const diaP = ((hh + l - 7 * mm + 114) % 31) + 1;
        const pascua = new Date(anio, mesP - 1, diaP);
        const add = (base, n) => { const dt = new Date(base); dt.setDate(dt.getDate() + n); return dt; };
        const k2d = (m, dy) => `${m}-${dy}`;
        const kD  = (dt)    => k2d(dt.getMonth() + 1, dt.getDate());
        return {
          [k2d(1,  1)]:  "Anio Nuevo",
          [kD(add(pascua, -2))]: "Viernes Santo",
          [kD(add(pascua, -1))]: "Sabado Santo",
          [kD(pascua)]:          "Domingo Resurreccion",
          [k2d(5,  1)]:  "Dia del Trabajo",
          [k2d(5, 21)]:  "Glorias Navales",
          [k2d(6, 29)]:  "San Pedro y Pablo",
          [k2d(7, 16)]:  "Virgen del Carmen",
          [k2d(8, 15)]:  "Asuncion",
          [k2d(9, 18)]:  "Independencia",
          [k2d(9, 19)]:  "Glo. del Ejercito",
          [k2d(10, 12)]: "Enc. Dos Mundos",
          [k2d(10, 31)]: "Igl. Evangelicas",
          [k2d(11,  1)]: "Todos los Santos",
          [k2d(12,  8)]: "Inmaculada",
          [k2d(12, 25)]: "Navidad",
        };
      };
      const feriados = calcularFeriados(anioActual);

      // ── Página 900×720mm landscape ───────────────────────────────────────────
      const doc = new jsPDF({ orientation: "landscape", unit: "mm", format: [900, 720] });
      const W = 900, H = 720;
      const margen    = 12;
      const anchoUtil = W - margen * 2;

      // ── Expandir y agrupar eventos por día ───────────────────────────────────
      const eventosExpandidosPDF = expandirEventos(eventos, anioActual, mesActual);
      const eventosPorDiaPDF = {};
      for (const ev of eventosExpandidosPDF) {
        const dy = ev._fecha.getDate();
        if (!eventosPorDiaPDF[dy]) eventosPorDiaPDF[dy] = [];
        eventosPorDiaPDF[dy].push(ev);
      }
      for (const dy in eventosPorDiaPDF) {
        eventosPorDiaPDF[dy].sort((a, b) => {
          const tA = a.fecha_inicio ? a.fecha_inicio.slice(11, 16) : "00:00";
          const tB = b.fecha_inicio ? b.fecha_inicio.slice(11, 16) : "00:00";
          return tA.localeCompare(tB);
        });
      }

      // ── Anchos de columna variables ───────────────────────────────────────────
      // Lun(0) Mie(2) Sab(5) se angostan si NO tienen ningún evento este mes
      const totalDias = diasEnMes(anioActual, mesActual);
      const pDia      = primerDiaMes(anioActual, mesActual);
      const COLS_EST  = new Set([0, 2, 5]);
      const colConEv  = Array(7).fill(false);
      for (let dia = 1; dia <= totalDias; dia++) {
        if (eventosPorDiaPDF[dia]?.length > 0)
          colConEv[(pDia + dia - 1) % 7] = true;
      }
      // columna estrecha = es "normalmente vacía" y no tiene eventos este mes
      const colEst    = Array.from({ length: 7 }, (_, i) => COLS_EST.has(i) && !colConEv[i]);
      const normalW   = anchoUtil / 7;
      const estrechoW = normalW * 0.45;
      const numEst    = colEst.filter(Boolean).length;
      const numNorm   = 7 - numEst;
      const ahorrado  = numEst * (normalW - estrechoW);
      const anchoNorm = numNorm > 0 ? normalW + ahorrado / numNorm : normalW;
      const colWidths = colEst.map(e => e ? estrechoW : anchoNorm);
      const colX      = colWidths.reduce((acc, w, i) => {
        acc.push(i === 0 ? margen : acc[i - 1] + colWidths[i - 1]);
        return acc;
      }, []);

      // ── Mapa id → prefijo de título (P. / O.) ─────────────────────────────────
      const tituloPor = {};
      for (const m of miembros) {
        const rolesLow = (m.roles || []).map(r => r.toLowerCase());
        if (rolesLow.includes('pastor'))      tituloPor[m.id] = 'P.';
        else if (rolesLow.includes('obispo')) tituloPor[m.id] = 'O.';
      }

      // ── Pre-cargar todas las fotos ────────────────────────────────────────────
      const fotosCache = {};
      const fotoUrls   = new Set();
      if (portero?.foto_url) fotoUrls.add(portero.foto_url);
      for (const evs of Object.values(eventosPorDiaPDF)) {
        for (const ev of evs) {
          if (ev.encargado_foto)   fotoUrls.add(ev.encargado_foto);
          if (ev.coordinador_foto) fotoUrls.add(ev.coordinador_foto);
          if (ev.predicador_foto)  fotoUrls.add(ev.predicador_foto);
        }
      }
      await Promise.all([...fotoUrls].map(async (url) => {
        const data = await cargarImagenBase64(url);
        if (data) fotosCache[url] = data;
      }));

      // ── Dimensiones ───────────────────────────────────────────────────────────
      const altoCabecera   = 44;
      const altoDiasLabel  = 17;
      const altoFooter     = 14;
      const topGrilla      = altoCabecera + altoDiasLabel;
      const altoDisponible = H - topGrilla - altoFooter - margen;
      const numFilas       = Math.ceil((pDia + totalDias) / 7);
      const altoCelda      = altoDisponible / numFilas;

      // ── CABECERA (color del mes) ───────────────────────────────────────────────
      doc.setFillColor(cR, cG, cB);
      doc.rect(0, 0, W, altoCabecera, "F");
      doc.setTextColor(255, 255, 255);
      doc.setFontSize(36);
      doc.setFont("helvetica", "bold");
      doc.text(`CALENDARIO ${MESES[mesActual].toUpperCase()} ${anioActual}`, W / 2, 30, { align: "center" });

      if (portero?.nombre) {
        const fotoPortero = portero.foto_url ? fotosCache[portero.foto_url] : null;
        const fotoW = 36;
        if (fotoPortero) doc.addImage(fotoPortero, "JPEG", W - margen - fotoW, 4, fotoW, fotoW);
        const xTxt = W - margen - (fotoPortero ? fotoW + 4 : 0);
        doc.setFontSize(12);
        doc.setFont("helvetica", "normal");
        doc.setTextColor(200, 225, 255);
        doc.text("Portero del Mes:", xTxt, 16, { align: "right" });
        doc.setFontSize(19);
        doc.setFont("helvetica", "bold");
        doc.setTextColor(255, 255, 255);
        doc.text(`${portero.nombre} ${portero.apellido}`, xTxt, 32, { align: "right" });
      }
      doc.setFontSize(11);
      doc.setFont("helvetica", "normal");
      doc.setTextColor(200, 225, 255);
      doc.text(`Generado: ${new Date().toLocaleDateString("es-CL")}`, margen, 40);

      // ── ENCABEZADO DÍAS ────────────────────────────────────────────────────────
      const DIAS_PDF   = ["Lunes", "Martes", "Miercoles", "Jueves", "Viernes", "Sabado", "Domingo"];
      const DIAS_CORTO = ["LUN",   "MAR",    "MIE",       "JUE",    "VIE",     "SAB",    "DOM"];
      DIAS_PDF.forEach((d, i) => {
        const esDom = i === 6;
        const cw    = colWidths[i];
        doc.setFillColor(esDom ? 241 : 229, esDom ? 235 : 237, esDom ? 251 : 255);
        doc.rect(colX[i], altoCabecera, cw, altoDiasLabel, "F");
        doc.setDrawColor(200, 210, 225);
        doc.setLineWidth(0.3);
        doc.rect(colX[i], altoCabecera, cw, altoDiasLabel);
        doc.setTextColor(50, 70, 120);
        doc.setFontSize(colEst[i] ? 11 : 14);
        doc.setFont("helvetica", "bold");
        doc.text(
          colEst[i] ? DIAS_CORTO[i] : d.toUpperCase(),
          colX[i] + cw / 2,
          altoCabecera + 12,
          { align: "center" }
        );
      });

      // ── GRILLA — celdas vacías pre-mes ─────────────────────────────────────────
      doc.setDrawColor(200, 210, 225);
      doc.setLineWidth(0.3);
      for (let c = 0; c < pDia; c++) {
        doc.setFillColor(246, 247, 250);
        doc.rect(colX[c], topGrilla, colWidths[c], altoCelda, "FD");
      }

      // ── Constantes de layout (jsPDF, helvetica sin emojis) ────────────────────
      const PAD    = 3;       // padding horizontal
      const NR     = 6;       // radio círculo número de día
      const fotoSz = 10;      // foto de persona (mm)
      const H_BAR  = 12;      // barra título evento
      const H_LUG  = 8;       // fila lugar
      const H_PERS = 10;      // fila persona — foto 10mm + texto 16pt
      const H_NLIN = 7;       // línea de nota
      const GAP    = 4;       // separación entre eventos
      const OY_INI = NR * 2 + 10;  // offset inicial desde top de celda (~22mm, deja espacio al número del día)

      let col = pDia, fila = 0;

      for (let dia = 1; dia <= totalDias; dia++) {
        const x      = colX[col];
        const cw     = colWidths[col];
        const y      = topGrilla + fila * altoCelda;
        const esHoy    = dia === hoy.getDate() && mesActual === hoy.getMonth() && anioActual === hoy.getFullYear();
        const esDomCol = col === 6;

        if (esHoy)         doc.setFillColor(219, 234, 254);
        else if (esDomCol) doc.setFillColor(253, 250, 255);
        else               doc.setFillColor(255, 255, 255);
        doc.rect(x, y, cw, altoCelda, "FD");

        // Número del día
        if (esHoy) {
          doc.setFillColor(cR, cG, cB);
          doc.circle(x + cw - NR - 4, y + NR + 3, NR, "F");
          doc.setTextColor(255, 255, 255);
        } else {
          doc.setTextColor(esDomCol ? 150 : 80, esDomCol ? 50 : 80, esDomCol ? 60 : 110);
        }
        doc.setFontSize(18);
        doc.setFont("helvetica", "bold");
        doc.text(String(dia), x + cw - NR - 4, y + NR + 7.5, { align: "center" });

        // Feriado chileno (texto rojo pequeño, sin tildes ni caracteres especiales)
        const keyF = `${mesActual + 1}-${dia}`;
        if (feriados[keyF]) {
          doc.setFontSize(8);
          doc.setFont("helvetica", "bold");
          doc.setTextColor(180, 20, 20);
          const maxFW = cw - PAD * 2 - NR * 2 - 8;
          doc.text(feriados[keyF].toUpperCase(), x + PAD + 1, y + 9, { maxWidth: maxFW > 5 ? maxFW : cw * 0.6 });
        }

        const evs = eventosPorDiaPDF[dia] || [];
        let oy = y + OY_INI;

        for (const ev of evs) {
          // Hora
          const horaDate = ev.fecha_inicio ? parseLocalDate(ev.fecha_inicio) : null;
          const hora = (horaDate && !(horaDate.getHours() === 0 && horaDate.getMinutes() === 0))
            ? horaDate.toLocaleTimeString("es-CL", { hour: "2-digit", minute: "2-digit" })
            : null;

          // Lugar / Zoom
          const esZoom =
            (ev.zoom_link && ev.zoom_link.trim()) ||
            (ev.descripcion && (ev.descripcion.includes("zoom.us") || ev.descripcion.includes("zoom.com"))) ||
            (ev.lugar && ev.lugar.toLowerCase().includes("zoom"));
          const lugarTexto = esZoom ? "Zoom" : (ev.lugar || null);

          // Notas
          let notaLines = [], altoNotas = 0;
          if (ev.notas) {
            doc.setFontSize(12);
            notaLines = doc.splitTextToSize(ev.notas, cw - PAD * 2 - 4);
            altoNotas = 4 + Math.min(notaLines.length, 2) * H_NLIN;
          }

          // Altura total del bloque
          const altoBloque =
            H_BAR + 1 +
            (lugarTexto            ? H_LUG  : 0) +
            (ev.encargado_nombre   ? H_PERS : 0) +
            (ev.coordinador_nombre ? H_PERS : 0) +
            (ev.predicador_nombre  ? H_PERS : 0) +
            altoNotas + GAP;

          if (oy + altoBloque > y + altoCelda - 1) break;

          // Barra coloreada: título + hora
          const [r, g, b] = hexToRgb(ev.color || "#3B82F6");
          doc.setFillColor(r, g, b);
          doc.roundedRect(x + PAD, oy, cw - PAD * 2, H_BAR, 2, 2, "F");
          doc.setTextColor(255, 255, 255);
          if (hora) {
            doc.setFontSize(11);
            doc.setFont("helvetica", "normal");
            const hw = doc.getTextWidth(hora);
            doc.text(hora, x + cw - PAD - 2.5, oy + 8.5, { align: "right" });
            doc.setFontSize(14);
            doc.setFont("helvetica", "bold");
            doc.text(ev.titulo, x + PAD + 3, oy + 8.5, { maxWidth: cw - PAD * 2 - hw - 7 });
          } else {
            doc.setFontSize(14);
            doc.setFont("helvetica", "bold");
            doc.text(ev.titulo, x + PAD + 3, oy + 8.5, { maxWidth: cw - PAD * 2 - 5 });
          }

          let innerY = oy + H_BAR + 1;

          // Lugar
          if (lugarTexto) {
            doc.setFontSize(12);
            doc.setFont("helvetica", "normal");
            doc.setTextColor(esZoom ? 30 : 35, esZoom ? 90 : 120, esZoom ? 220 : 35);
            doc.text(lugarTexto, x + PAD + 2.5, innerY + 6, { maxWidth: cw - PAD * 2 - 4 });
            innerY += H_LUG;
          }

          // Personas — nombres en 16pt BOLD: prioridad de legibilidad para 3ra edad
          const dibujarPersona = (nombre, apellido, fotoUrl, label, lColor, titulo = '') => {
            if (!nombre) return;
            const foto = fotoUrl ? fotosCache[fotoUrl] : null;
            if (foto) doc.addImage(foto, "JPEG", x + PAD + 1, innerY + 0.5, fotoSz, fotoSz);
            const textX = x + PAD + 1 + (foto ? fotoSz + 2 : 0);
            // Label (pequeño, en color)
            doc.setFontSize(10);
            doc.setFont("helvetica", "bold");
            doc.setTextColor(lColor[0], lColor[1], lColor[2]);
            doc.text(label, textX, innerY + 8);
            const lw = doc.getTextWidth(label);
            // Nombre — 16pt bold, negro intenso, con prefijo P./O. si corresponde
            doc.setFontSize(16);
            doc.setFont("helvetica", "bold");
            doc.setTextColor(15, 15, 50);
            const nombreCompleto = `${titulo ? titulo + ' ' : ''}${nombre} ${apellido || ''}`.trim();
            doc.text(
              nombreCompleto,
              textX + lw + 1.5,
              innerY + 8,
              { maxWidth: cw - (textX - x) - lw - PAD - 3 }
            );
            innerY += H_PERS;
          };

          dibujarPersona(ev.encargado_nombre,   ev.encargado_apellido,   ev.encargado_foto,   "Enc:",   [80, 80, 160],  tituloPor[ev.encargado_id]   || '');
          dibujarPersona(ev.coordinador_nombre, ev.coordinador_apellido, ev.coordinador_foto, "Coord:", [80, 80, 160],  tituloPor[ev.coordinador_id] || '');
          dibujarPersona(ev.predicador_nombre,  ev.predicador_apellido,  ev.predicador_foto,  "Pred:",  [110, 50, 140], tituloPor[ev.predicador_id]  || '');

          // Notas (fondo amarillo claro)
          if (ev.notas && altoNotas > 0) {
            doc.setFillColor(255, 251, 225);
            doc.roundedRect(x + PAD, innerY, cw - PAD * 2, altoNotas, 1.5, 1.5, "F");
            doc.setTextColor(130, 90, 20);
            doc.setFontSize(12);
            doc.setFont("helvetica", "italic");
            notaLines.slice(0, 2).forEach((linea, li) => {
              doc.text(linea, x + PAD + 3, innerY + H_NLIN + li * H_NLIN);
            });
          }

          oy += altoBloque;
        }

        col++;
        if (col === 7) { col = 0; fila++; }
      }

      // ── PIE DE PÁGINA ─────────────────────────────────────────────────────────
      const yFooter = H - altoFooter;
      doc.setFillColor(241, 245, 249);
      doc.rect(0, yFooter, W, altoFooter, "F");
      doc.setDrawColor(200, 210, 225);
      doc.setLineWidth(0.3);
      doc.line(0, yFooter, W, yFooter);
      doc.setTextColor(140, 155, 180);
      doc.setFontSize(14);
      doc.setFont("helvetica", "normal");
      doc.text("Iglesia Vida Nueva · vidanuevaimp.com", W / 2, yFooter + 10, { align: "center" });

      doc.save(`Calendario_${MESES[mesActual]}_${anioActual}.pdf`);
    } catch (err) {
      console.error("Error generando PDF:", err);
      alert("Error al generar el PDF");
    } finally {
      setGenerandoPDF(false);
    }
  };

  // Convierte una URL de imagen a base64 para jsPDF
  const cargarImagenBase64 = (url) => new Promise((resolve) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => {
      const canvas = document.createElement("canvas");
      canvas.width = img.naturalWidth;
      canvas.height = img.naturalHeight;
      canvas.getContext("2d").drawImage(img, 0, 0);
      resolve(canvas.toDataURL("image/jpeg", 0.85));
    };
    img.onerror = () => resolve(null);
    img.src = url.startsWith("/") ? window.location.origin + url : url;
  });

  // Convierte hex a [r,g,b]
  const hexToRgb = (hex) => {
    const r = parseInt(hex.slice(1, 3), 16);
    const g = parseInt(hex.slice(3, 5), 16);
    const b = parseInt(hex.slice(5, 7), 16);
    return [r, g, b];
  };

  const abrirNuevo = (diaInicio = null) => {
    setEditando(null);
    const fechaBase = diaInicio
      ? new Date(anioActual, mesActual, diaInicio)
      : new Date();
    const iso = toLocalISOString(fechaBase);
    setForm({ ...FORM_INICIAL, fecha_inicio: iso });
    // Cargar no disponibles para la fecha seleccionada
    const fechaStr = toLocalDateStr(fechaBase);
    cargarBloqueados(fechaStr);
    setModalAbierto(true);
  };

  const abrirEditar = (ev) => {
    setVistaEvento(null);
    setEditando(ev.id);
    setForm({
      titulo: ev.titulo || "",
      descripcion: ev.descripcion || "",
      imagen_url: ev.imagen_url || "",
      fecha_inicio: ev.fecha_inicio ? ev.fecha_inicio.slice(0, 16) : "",
      fecha_fin: ev.fecha_fin ? ev.fecha_fin.slice(0, 16) : "",
      lugar: ev.lugar || "",
      tipo: ev.tipo || "especial",
      recurrencia: ev.recurrencia || "ninguna",
      dia_semana: ev.dia_semana ?? "",
      encargado_id: ev.encargado_id || "",
      coordinador_id: ev.coordinador_id || "",
      predicador_id: ev.predicador_id || "",
      notas: ev.notas || "",
      color: ev.color || "#3B82F6",
      zoom_link: ev.zoom_link || "",
    });
    if (ev.fecha_inicio) cargarBloqueados(ev.fecha_inicio.slice(0, 10));
    setModalAbierto(true);
  };

  const cerrarModal = () => {
    setModalAbierto(false);
    setEditando(null);
    setForm(FORM_INICIAL);
  };

  // Sincroniza el formulario de ocurrencia al seleccionar un evento recurrente
  useEffect(() => {
    if (vistaEvento && vistaEvento.tipo === "recurrente") {
      setOcForm({
        encargado_id:   vistaEvento.encargado_id   ? String(vistaEvento.encargado_id)   : "",
        coordinador_id: vistaEvento.coordinador_id ? String(vistaEvento.coordinador_id) : "",
        predicador_id:  vistaEvento.predicador_id  ? String(vistaEvento.predicador_id)  : "",
        notas:          vistaEvento.notas || "",
      });
      // Cargar bloqueados para la ocurrencia seleccionada
      if (vistaEvento._fecha) cargarBloqueados(toLocalDateStr(vistaEvento._fecha));
    }
    if (!vistaEvento) setBloqueadosPorFecha(new Set());
  }, [vistaEvento]);

  // Actualizar bloqueados cuando cambia la fecha en el modal de crear/editar
  useEffect(() => {
    if (modalAbierto && form.fecha_inicio) cargarBloqueados(form.fecha_inicio.slice(0, 10));
  }, [form.fecha_inicio, modalAbierto]);

  const guardarOcurrencia = async () => {
    if (!vistaEvento || !vistaEvento._fecha) return;
    setGuardandoOc(true);
    try {
      const fecha = toLocalDateStr(vistaEvento._fecha);
      const res = await fetch(`${API}/api/eventos/${vistaEvento.id}/ocurrencias`, {
        method: "POST",
        headers: { ...headers(), "Content-Type": "application/json" },
        body: JSON.stringify({
          fecha,
          encargado_id:   ocForm.encargado_id   || null,
          coordinador_id: ocForm.coordinador_id || null,
          predicador_id:  ocForm.predicador_id  || null,
          notas:          ocForm.notas          || null,
        }),
      });
      if (!res.ok) throw new Error("Error al guardar");
      await cargar();
      setVistaEvento(null);
    } catch {
      alert("Error al guardar la asignación para esta fecha.");
    } finally {
      setGuardandoOc(false);
    }
  };

  const guardar = async () => {
    if (!form.titulo.trim() || !form.fecha_inicio) {
      alert("Título y fecha de inicio son obligatorios");
      return;
    }
    setGuardando(true);
    try {
      const url = editando ? `${API}/api/eventos/${editando}` : `${API}/api/eventos`;
      const method = editando ? "PUT" : "POST";
      const body = {
        ...form,
        dia_semana: form.dia_semana !== "" ? parseInt(form.dia_semana) : null,
        encargado_id: form.encargado_id || null,
        coordinador_id: form.coordinador_id || null,
        predicador_id: form.predicador_id || null,
      };
      const res = await fetch(url, {
        method,
        headers: { ...headers(), "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) throw new Error("Error al guardar");
      await cargar();
      cerrarModal();
    } catch (e) {
      alert("Error al guardar el evento");
    } finally {
      setGuardando(false);
    }
  };

  const eliminar = async (id) => {
    if (!confirm("¿Eliminar este evento?")) return;
    try {
      await fetch(`${API}/api/eventos/${id}`, { method: "DELETE", headers: headers() });
      setEventos(prev => prev.filter(e => e.id !== id));
      setVistaEvento(null);
    } catch (e) {
      alert("Error al eliminar");
    }
  };

  // Construir la grilla del mes
  const totalDias = diasEnMes(anioActual, mesActual);
  const primerDia = primerDiaMes(anioActual, mesActual);
  const eventosExpandidos = expandirEventos(eventos, anioActual, mesActual);

  const eventosPorDia = {};
  for (const ev of eventosExpandidos) {
    const dia = ev._fecha.getDate();
    if (!eventosPorDia[dia]) eventosPorDia[dia] = [];
    eventosPorDia[dia].push(ev);
  }
  for (const dia in eventosPorDia) {
    eventosPorDia[dia].sort((a, b) => {
      const tA = a.fecha_inicio ? a.fecha_inicio.slice(11, 16) : "00:00";
      const tB = b.fecha_inicio ? b.fecha_inicio.slice(11, 16) : "00:00";
      return tA.localeCompare(tB);
    });
  }

  const celdasVacias = Array(primerDia).fill(null);
  const dias = Array.from({ length: totalDias }, (_, i) => i + 1);

  const esHoy = (dia) =>
    dia === hoy.getDate() && mesActual === hoy.getMonth() && anioActual === hoy.getFullYear();

  // Vista lista de próximos eventos
  const proximosEventos = eventosExpandidos
    .filter(ev => {
      const f = ev._fecha;
      const hoyDate = new Date(hoy.getFullYear(), hoy.getMonth(), hoy.getDate());
      return f >= hoyDate;
    })
    .sort((a, b) => a._fecha - b._fecha)
    .slice(0, 8);

  return (
    <>
      <AdminNav />
      <div className="p-4 md:p-6 max-w-7xl mx-auto">
        {/* Encabezado */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
          <div>
            <h1 className="text-3xl font-bold text-gray-800">Calendario</h1>
            <p className="text-gray-500 mt-1">{eventos.length} evento{eventos.length !== 1 ? "s" : ""} registrado{eventos.length !== 1 ? "s" : ""}</p>
          </div>
          <button
            onClick={() => abrirNuevo()}
            className="bg-blue-600 hover:bg-blue-700 text-white font-semibold py-2 px-5 rounded-lg transition flex items-center gap-2"
          >
            <span className="text-xl leading-none">+</span> Nuevo Evento
          </button>
        </div>

        <div className="grid grid-cols-1 xl:grid-cols-4 gap-6">
          {/* Calendarioo */}
          <div className="xl:col-span-3">
            {/* Navegación mes */}
            <div className="flex items-center justify-between mb-3">
              <button onClick={mesAnterior} className="p-2 hover:bg-gray-100 rounded-full transition text-xl">‹</button>
              <h2 className="text-xl font-bold text-gray-800">
                {MESES[mesActual]} {anioActual}
              </h2>
              <div className="flex items-center gap-2">
                <button
                  onClick={async () => {
                    if (!confirm(`¿Borrar todas las asignaciones de ${MESES[mesActual]} ${anioActual}?\n\nSe eliminarán coordinadores, predicadores y portero del mes.\nLos encargados y eventos se conservan.`)) return;
                    try {
                      const res = await fetch(`${API}/api/calendario/${anioActual}/${mesActual + 1}/asignaciones`, {
                        method: "DELETE",
                        headers: headers(),
                      });
                      if (!res.ok) throw new Error();
                      // Recargar eventos y portero
                      const evRes = await fetch(`${API}/api/eventos`, { headers: headers() });
                      const evData = await evRes.json();
                      setEventos(evData);
                      setPorteroSeleccionado("");
                      setPortero(null);
                    } catch {
                      alert("Error al resetear asignaciones");
                    }
                  }}
                  className="text-xs text-red-500 hover:text-red-700 hover:bg-red-50 border border-red-200 px-2.5 py-1 rounded-lg transition font-medium flex items-center gap-1"
                  title="Borrar coordinadores, predicadores y portero de este mes"
                >
                  🗑 Resetear mes
                </button>
                <button onClick={mesSiguiente} className="p-2 hover:bg-gray-100 rounded-full transition text-xl">›</button>
              </div>
            </div>

            {/* Portero del mes + botón PDF */}
            <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3 mb-4 bg-white rounded-xl shadow-sm px-4 py-3">
              <div className="flex items-center gap-2 flex-1 min-w-0">
                <span className="text-lg">🚪</span>
                <label className="text-sm font-semibold text-gray-700 whitespace-nowrap">Portero del Mes:</label>
                {portero?.foto_url ? (
                  <img src={portero.foto_url} alt="" className="w-7 h-7 rounded-full object-cover border border-gray-200 flex-shrink-0" />
                ) : portero?.nombre ? (
                  <div className="w-7 h-7 rounded-full bg-indigo-100 flex items-center justify-center text-xs font-bold text-indigo-600 flex-shrink-0">
                    {portero.nombre[0]}{portero.apellido?.[0]}
                  </div>
                ) : null}
                <select
                  value={porteroSeleccionado}
                  onChange={e => {
                    setPorteroSeleccionado(e.target.value);
                    guardarPortero(e.target.value || null);
                  }}
                  disabled={guardandoPortero}
                  className="border border-gray-300 rounded-lg px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400 flex-1 min-w-0 max-w-xs disabled:opacity-60"
                >
                  <option value="">Sin asignar</option>
                  {miembros.map(m => (
                    <option key={m.id} value={m.id}>{m.nombre} {m.apellido}</option>
                  ))}
                </select>
                {guardandoPortero && <span className="text-xs text-gray-400">Guardando...</span>}
              </div>
              <button
                onClick={generarPDF}
                disabled={generandoPDF}
                className="flex items-center gap-2 bg-red-600 hover:bg-red-700 disabled:opacity-50 text-white text-sm font-semibold px-4 py-2 rounded-lg transition whitespace-nowrap"
              >
                {generandoPDF ? (
                  <><span className="inline-block w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" /> Generando...</>
                ) : (
                  <>📄 Descargar PDF</>
                )}
              </button>
            </div>

            {/* Grilla */}
            <div className="bg-white rounded-2xl shadow overflow-hidden">
              {/* Días de la semana */}
              <div className="grid grid-cols-7 bg-gray-100">
                {DIAS_SEMANA.map(d => (
                  <div key={d} className="text-center text-xs font-semibold text-gray-500 py-2">
                    {d.slice(0, 3)}
                  </div>
                ))}
              </div>

              {/* Celdas */}
              <div className="grid grid-cols-7">
                {celdasVacias.map((_, i) => (
                  <div key={`v-${i}`} className="border-t border-r border-gray-100 min-h-[80px] bg-gray-50/50 p-1" />
                ))}
                {dias.map(dia => {
                  const evsDia = eventosPorDia[dia] || [];
                  const activo = diaSeleccionado === dia;
                  return (
                    <div
                      key={dia}
                      onClick={() => setDiaSeleccionado(activo ? null : dia)}
                      className={`border-t border-r border-gray-100 min-h-[80px] p-1 cursor-pointer transition ${
                        activo ? "bg-blue-50" : "hover:bg-gray-50"
                      }`}
                    >
                      <div className={`text-xs font-semibold mb-1 w-6 h-6 flex items-center justify-center rounded-full ${
                        esHoy(dia) ? "bg-blue-600 text-white" : "text-gray-600"
                      }`}>{dia}</div>
                      <div className="space-y-0.5">
                        {evsDia.slice(0, 3).map(ev => (
                          <div
                            key={ev._key}
                            onClick={e => { e.stopPropagation(); setVistaEvento(ev); }}
                            className="text-xs truncate rounded px-1 py-0.5 text-white font-medium cursor-pointer hover:opacity-80 transition"
                            style={{ backgroundColor: ev.color || "#3B82F6" }}
                          >
                            {ev.titulo}
                          </div>
                        ))}
                        {evsDia.length > 3 && (
                          <div className="text-xs text-gray-400 pl-1">+{evsDia.length - 3} más</div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Detalle día seleccionado */}
            {diaSeleccionado && (
              <div className="mt-4 bg-white rounded-xl shadow p-4">
                <div className="flex justify-between items-center mb-3">
                  <h3 className="font-bold text-gray-800">
                    {diaSeleccionado} de {MESES[mesActual]} {anioActual}
                  </h3>
                  <button
                    onClick={() => abrirNuevo(diaSeleccionado)}
                    className="text-sm bg-blue-50 hover:bg-blue-100 text-blue-700 px-3 py-1 rounded font-medium transition"
                  >
                    + Agregar evento
                  </button>
                </div>
                {(eventosPorDia[diaSeleccionado] || []).length === 0 ? (
                  <p className="text-gray-400 text-sm">Sin eventos este día.</p>
                ) : (
                  <div className="space-y-2">
                    {(eventosPorDia[diaSeleccionado] || []).map(ev => (
                      <div
                        key={ev._key}
                        className="flex items-center gap-3 p-3 rounded-lg border hover:bg-gray-50 cursor-pointer transition"
                        onClick={() => setVistaEvento(ev)}
                      >
                        <div className="w-3 h-3 rounded-full flex-shrink-0" style={{ background: ev.color }} />
                        <div className="flex-1">
                          <p className="font-semibold text-gray-800 text-sm">{ev.titulo}</p>
                          {ev.lugar && <p className="text-xs text-gray-400">📍 {ev.lugar}</p>}
                        </div>
                        <span className={`text-xs px-2 py-0.5 rounded-full ${ev.tipo === "recurrente" ? "bg-purple-100 text-purple-700" : "bg-blue-100 text-blue-700"}`}>
                          {ev.tipo}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Sidebar — Próximos eventos */}
          <div className="space-y-4">
            <h3 className="font-bold text-gray-700 text-lg">Próximos Eventos</h3>
            {loading ? (
              <p className="text-gray-400 text-sm">Cargando...</p>
            ) : proximosEventos.length === 0 ? (
              <p className="text-gray-400 text-sm">No hay eventos próximos.</p>
            ) : (
              <div className="space-y-3">
                {proximosEventos.map(ev => (
                  <div
                    key={ev._key}
                    onClick={() => setVistaEvento(ev)}
                    className="bg-white rounded-xl shadow-sm p-3 cursor-pointer hover:shadow-md transition border-l-4"
                    style={{ borderLeftColor: ev.color }}
                  >
                    <p className="font-semibold text-gray-800 text-sm">{ev.titulo}</p>
                    <p className="text-xs text-gray-500 mt-0.5">
                      {ev._fecha.toLocaleDateString("es-CL", {
                        weekday: "long", day: "numeric", month: "short"
                      })}
                    </p>
                    {ev.lugar && <p className="text-xs text-gray-400 mt-0.5">📍 {ev.lugar}</p>}
                    {ev.encargado_nombre ? (
                      <div className="text-xs text-gray-500 mt-0.5">
                        <Avatar nombre={ev.encargado_nombre} apellido={ev.encargado_apellido} foto_url={ev.encargado_foto} />
                      </div>
                    ) : (
                      <>
                        {ev.coordinador_nombre && (
                          <div className="text-xs text-gray-500 mt-0.5">
                            <Avatar nombre={ev.coordinador_nombre} apellido={ev.coordinador_apellido} foto_url={ev.coordinador_foto} />
                          </div>
                        )}
                        {ev.predicador_nombre && (
                          <div className="text-xs text-gray-500 mt-0.5">
                            <Avatar nombre={ev.predicador_nombre} apellido={ev.predicador_apellido} foto_url={ev.predicador_foto} />
                          </div>
                        )}
                      </>
                    )}
                    <span className={`mt-1 inline-block text-xs px-2 py-0.5 rounded-full ${ev.tipo === "recurrente" ? "bg-purple-100 text-purple-700" : "bg-blue-100 text-blue-700"}`}>
                      {ev.tipo === "recurrente" ? `🔁 ${ev.recurrencia}` : "📅 especial"}
                    </span>
                    <div className="mt-2">
                      {heroEventoIds.has(ev.id) ? (
                        <button
                          onClick={e => { e.stopPropagation(); quitarDelHero(ev); }}
                          disabled={togglingHero === ev.id}
                          className="text-xs text-orange-600 hover:text-orange-800 bg-orange-50 hover:bg-orange-100 border border-orange-200 px-2.5 py-1 rounded-full transition font-medium disabled:opacity-50"
                        >
                          {togglingHero === ev.id ? "..." : "✕ Quitar del Hero"}
                        </button>
                      ) : (
                        <button
                          onClick={e => { e.stopPropagation(); agregarAlHero(ev); }}
                          disabled={togglingHero === ev.id}
                          className="text-xs text-indigo-600 hover:text-indigo-800 bg-indigo-50 hover:bg-indigo-100 border border-indigo-200 px-2.5 py-1 rounded-full transition font-medium disabled:opacity-50"
                        >
                          {togglingHero === ev.id ? "..." : "✦ Agregar al Hero"}
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Modal detalle evento */}
      {vistaEvento && !modalAbierto && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4">
          <div className="bg-white rounded-t-2xl sm:rounded-2xl shadow-2xl w-full sm:max-w-md max-h-[92vh] flex flex-col overflow-hidden">
            {vistaEvento.imagen_url && (
              <img src={normUrl(vistaEvento.imagen_url)} alt={vistaEvento.titulo} className="w-full h-40 object-cover rounded-t-2xl shrink-0" />
            )}
            <div className="p-6 overflow-y-auto flex-1">
              <div className="flex items-start gap-3 mb-4">
                <div className="w-4 h-4 rounded-full mt-1 flex-shrink-0" style={{ background: vistaEvento.color }} />
                <div>
                  <h3 className="text-xl font-bold text-gray-800">{vistaEvento.titulo}</h3>
                  <div className="flex flex-wrap items-center gap-2 mt-0.5">
                    <p className="text-sm text-gray-500 capitalize">
                      {vistaEvento._fecha.toLocaleDateString("es-CL", {
                        weekday: "long", year: "numeric", month: "long", day: "numeric"
                      })}
                    </p>
                    {vistaEvento.fecha_inicio && (() => {
                      const hora = parseLocalDate(vistaEvento.fecha_inicio);
                      if (hora && !(hora.getHours() === 0 && hora.getMinutes() === 0)) {
                        return (
                          <span className="inline-flex items-center gap-1 bg-blue-50 border border-blue-200 text-blue-700 text-xs font-semibold px-2.5 py-0.5 rounded-full">
                            🕐 {hora.toLocaleTimeString("es-CL", { hour: "2-digit", minute: "2-digit" })}
                          </span>
                        );
                      }
                      return null;
                    })()}
                  </div>
                </div>
              </div>
              {vistaEvento.descripcion && (
                <p className="text-gray-600 text-sm mb-3">{renderTexto(vistaEvento.descripcion)}</p>
              )}
              {vistaEvento.notas && (
                <div className="bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 mb-3">
                  <p className="text-xs font-semibold text-amber-700 mb-0.5">📝 Notas</p>
                  <p className="text-sm text-amber-900 whitespace-pre-wrap">{vistaEvento.notas}</p>
                </div>
              )}
              {vistaEvento.lugar && <p className="text-sm text-gray-500 mb-1">📍 {vistaEvento.lugar}</p>}
              {vistaEvento.encargado_nombre ? (
                <div className="text-sm text-gray-600 mb-1">
                  <Avatar nombre={vistaEvento.encargado_nombre} apellido={vistaEvento.encargado_apellido} foto_url={vistaEvento.encargado_foto} label="Encargado/a" />
                </div>
              ) : (
                <>
                  {vistaEvento.coordinador_nombre && (
                    <div className="text-sm text-gray-600 mb-1">
                      <Avatar nombre={vistaEvento.coordinador_nombre} apellido={vistaEvento.coordinador_apellido} foto_url={vistaEvento.coordinador_foto} label="Coordinador/a" />
                    </div>
                  )}
                  {vistaEvento.predicador_nombre && (
                    <div className="text-sm text-gray-600 mb-1">
                      <Avatar nombre={vistaEvento.predicador_nombre} apellido={vistaEvento.predicador_apellido} foto_url={vistaEvento.predicador_foto} label="Predicador/a" />
                    </div>
                  )}
                </>
              )}

              {/* Asignación específica para esta ocurrencia (solo recurrentes) */}
              {vistaEvento.tipo === "recurrente" && (
                <div className="border-t pt-4 mt-3">
                  <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">Asignar para esta fecha</p>
                  <div className="mb-2">
                    <label className="block text-xs font-medium text-gray-600 mb-1">
                      Encargado/a{(ocForm.coordinador_id || ocForm.predicador_id) ? " (bloqueado)" : ""}
                    </label>
                    <select
                      value={ocForm.encargado_id}
                      onChange={e => setOcForm(p => ({ ...p, encargado_id: e.target.value, coordinador_id: "", predicador_id: "" }))}
                      disabled={!!(ocForm.coordinador_id || ocForm.predicador_id)}
                      className={`w-full border rounded-lg px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400 ${
                        ocForm.coordinador_id || ocForm.predicador_id ? "opacity-40 cursor-not-allowed bg-gray-100" : ""
                      }`}
                    >
                      <option value="">Sin asignar</option>
                      {miembros.map(m => {
                        const bl = bloqueadosPorFecha.has(m.id);
                        return <option key={m.id} value={m.id} disabled={bl}>{bl ? `✕ ${m.nombre} ${m.apellido} — no disponible` : `${m.nombre} ${m.apellido}`}</option>;
                      })}
                    </select>
                  </div>
                  <p className="text-center text-xs text-gray-400 mb-2">— o separar en —</p>
                  <div className="grid grid-cols-2 gap-3 mb-3">
                    <div>
                      <label className="block text-xs font-medium text-gray-600 mb-1">
                        Coordinador/a{ocForm.encargado_id ? " (bloqueado)" : ""}
                      </label>
                      <select
                        value={ocForm.coordinador_id}
                        onChange={e => setOcForm(p => ({ ...p, coordinador_id: e.target.value, encargado_id: "" }))}
                        disabled={!!ocForm.encargado_id}
                        className={`w-full border rounded-lg px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-teal-400 ${
                          ocForm.encargado_id ? "opacity-40 cursor-not-allowed bg-gray-100" : ""
                        }`}
                      >
                        <option value="">Sin asignar</option>
                        {miembros.map(m => {
                          const bl = bloqueadosPorFecha.has(m.id);
                          return <option key={m.id} value={m.id} disabled={bl}>{bl ? `✕ ${m.nombre} ${m.apellido} — no disponible` : `${m.nombre} ${m.apellido}`}</option>;
                        })}
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-gray-600 mb-1">
                        Predicador/a{ocForm.encargado_id ? " (bloqueado)" : ""}
                      </label>
                      <select
                        value={ocForm.predicador_id}
                        onChange={e => setOcForm(p => ({ ...p, predicador_id: e.target.value, encargado_id: "" }))}
                        disabled={!!ocForm.encargado_id}
                        className={`w-full border rounded-lg px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-teal-400 ${
                          ocForm.encargado_id ? "opacity-40 cursor-not-allowed bg-gray-100" : ""
                        }`}
                      >
                        <option value="">Sin asignar</option>
                        {miembros.map(m => {
                          const bl = bloqueadosPorFecha.has(m.id);
                          return <option key={m.id} value={m.id} disabled={bl}>{bl ? `✕ ${m.nombre} ${m.apellido} — no disponible` : `${m.nombre} ${m.apellido}`}</option>;
                        })}
                      </select>
                    </div>
                  </div>
                  <div className="mb-3">
                    <label className="block text-xs font-medium text-gray-600 mb-1">Notas para esta fecha</label>
                    <textarea
                      rows={3}
                      value={ocForm.notas}
                      onChange={e => setOcForm(p => ({ ...p, notas: e.target.value }))}
                      className="w-full border rounded-lg px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-teal-400 resize-none"
                      placeholder="Anuncios, cambios, instrucciones especiales..."
                    />
                  </div>
                  <button
                    onClick={guardarOcurrencia}
                    disabled={guardandoOc}
                    className="w-full bg-teal-500 hover:bg-teal-600 text-white text-sm font-semibold py-2 rounded-lg transition disabled:opacity-50"
                  >
                    {guardandoOc ? "Guardando..." : "💾 Guardar para esta fecha"}
                  </button>
                </div>
              )}
              <p className="text-sm mt-3">
                <span className={`px-2 py-1 rounded-full text-xs font-semibold ${
                  vistaEvento.tipo === "recurrente" ? "bg-purple-100 text-purple-700" : "bg-blue-100 text-blue-700"
                }`}>
                  {vistaEvento.tipo === "recurrente"
                    ? `🔁 Recurrente · ${vistaEvento.recurrencia}`
                    : "📅 Evento especial"}
                </span>
              </p>
            </div>
            <div className="p-4 border-t bg-gray-50 rounded-b-2xl shrink-0 space-y-2">
              {heroEventoIds.has(vistaEvento.id) ? (
                <button
                  onClick={() => quitarDelHero(vistaEvento)}
                  disabled={togglingHero === vistaEvento.id}
                  className="w-full bg-orange-100 hover:bg-orange-200 text-orange-700 font-semibold py-2.5 rounded-lg transition text-sm disabled:opacity-50"
                >
                  {togglingHero === vistaEvento.id ? "Procesando..." : "✕ Quitar del HeroSection"}
                </button>
              ) : (
                <button
                  onClick={() => agregarAlHero(vistaEvento)}
                  disabled={togglingHero === vistaEvento.id}
                  className="w-full bg-indigo-100 hover:bg-indigo-200 text-indigo-700 font-semibold py-2.5 rounded-lg transition text-sm disabled:opacity-50"
                >
                  {togglingHero === vistaEvento.id ? "Procesando..." : "✦ Agregar al HeroSection"}
                </button>
              )}
              <div className="flex gap-3">
                <button
                  onClick={() => abrirEditar(vistaEvento)}
                  className="flex-1 bg-amber-100 hover:bg-amber-200 text-amber-700 font-semibold py-2.5 rounded-lg transition text-sm"
                >
                  Editar
                </button>
                <button
                  onClick={() => eliminar(vistaEvento.id)}
                  className="flex-1 bg-red-100 hover:bg-red-200 text-red-600 font-semibold py-2.5 rounded-lg transition text-sm"
                >
                  Eliminar
                </button>
                <button
                  onClick={() => setVistaEvento(null)}
                  className="flex-1 bg-gray-100 hover:bg-gray-200 text-gray-600 font-semibold py-2.5 rounded-lg transition text-sm"
                >
                  Cerrar
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Modal crear/editar evento */}
      {modalAbierto && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-end sm:items-center justify-center">
          <div className="bg-white rounded-t-2xl sm:rounded-2xl shadow-2xl w-full sm:max-w-xl max-h-[92vh] flex flex-col">
            <div className="flex items-center justify-between p-6 border-b shrink-0">
              <h2 className="text-xl font-bold text-gray-800">
                {editando ? "Editar Evento" : "Nuevo Evento"}
              </h2>
              <button onClick={cerrarModal} className="text-gray-400 hover:text-gray-600 text-2xl leading-none">&times;</button>
            </div>

            <div className="p-6 space-y-4 overflow-y-auto flex-1">
              {/* Título */}
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1">Título *</label>
                <input
                  type="text"
                  value={form.titulo}
                  onChange={e => setForm(p => ({ ...p, titulo: e.target.value }))}
                  className="w-full border rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-400"
                />
              </div>

              {/* Fechas */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-1">Fecha/Hora inicio *</label>
                  <input
                    type="datetime-local"
                    value={form.fecha_inicio}
                    onChange={e => setForm(p => ({ ...p, fecha_inicio: e.target.value }))}
                    className="w-full border rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-400"
                  />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-1">Fecha/Hora término</label>
                  <input
                    type="datetime-local"
                    value={form.fecha_fin}
                    onChange={e => setForm(p => ({ ...p, fecha_fin: e.target.value }))}
                    className="w-full border rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-400"
                  />
                </div>
              </div>

              {/* Tipo y recurrencia */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-1">Tipo</label>
                  <select
                    value={form.tipo}
                    onChange={e => setForm(p => ({
                      ...p,
                      tipo: e.target.value,
                      recurrencia: e.target.value === "especial"
                        ? "ninguna"
                        : (p.recurrencia === "ninguna" ? "semanal" : p.recurrencia),
                    }))}
                    className="w-full border rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-400"
                  >
                    <option value="especial">📅 Especial (una sola vez)</option>
                    <option value="recurrente">🔁 Recurrente</option>
                  </select>
                </div>
                {form.tipo === "recurrente" && (
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-1">Frecuencia</label>
                    <select
                      value={form.recurrencia}
                      onChange={e => setForm(p => ({ ...p, recurrencia: e.target.value }))}
                      className="w-full border rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-400"
                    >
                      <option value="semanal">Semanal</option>
                      <option value="quincenal">Quincenal</option>
                      <option value="mensual">Mensual</option>
                      <option value="anual">Anual</option>
                    </select>
                  </div>
                )}
              </div>

              {/* Día de semana para recurrentes semanales/quincenales */}
              {form.tipo === "recurrente" && (form.recurrencia === "semanal" || form.recurrencia === "quincenal") && (
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-1">Día de la semana</label>
                  <select
                    value={form.dia_semana}
                    onChange={e => setForm(p => ({ ...p, dia_semana: e.target.value }))}
                    className="w-full border rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-400"
                  >
                    <option value="">Usar el día de la fecha de inicio</option>
                    {[
                      { label: "Lunes",     jsDay: 1 },
                      { label: "Martes",    jsDay: 2 },
                      { label: "Miércoles", jsDay: 3 },
                      { label: "Jueves",    jsDay: 4 },
                      { label: "Viernes",   jsDay: 5 },
                      { label: "Sábado",    jsDay: 6 },
                      { label: "Domingo",   jsDay: 0 },
                    ].map(({ label, jsDay }) => (
                      <option key={jsDay} value={jsDay}>{label}</option>
                    ))}
                  </select>
                </div>
              )}

              {/* Lugar */}
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1">Lugar</label>
                <input
                  type="text"
                  value={form.lugar}
                  onChange={e => setForm(p => ({ ...p, lugar: e.target.value }))}
                  placeholder="Templo, Salón, etc."
                  className="w-full border rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-400"
                />
              </div>

              {/* Responsables (exclusión mutua: Encargado vs Coordinador+Predicador) */}
              <div className="space-y-3 border rounded-xl p-3 bg-gray-50">
                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Responsables</p>
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-1">
                    Encargado/a{(form.coordinador_id || form.predicador_id) ? " (bloqueado)" : ""}
                  </label>
                  <select
                    value={form.encargado_id}
                    onChange={e => setForm(p => ({ ...p, encargado_id: e.target.value, coordinador_id: "", predicador_id: "" }))}
                    disabled={!!(form.coordinador_id || form.predicador_id)}
                    className={`w-full border rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-400 ${
                      form.coordinador_id || form.predicador_id ? "opacity-40 cursor-not-allowed bg-gray-100" : ""
                    }`}
                  >
                    <option value="">Sin asignar</option>
                    {miembros.map(m => {
                      const bl = bloqueadosPorFecha.has(m.id);
                      return <option key={m.id} value={m.id} disabled={bl}>{bl ? `✕ ${m.nombre} ${m.apellido} — no disponible` : `${m.nombre} ${m.apellido}`}</option>;
                    })}
                  </select>
                </div>
                <p className="text-center text-xs text-gray-400">— o separar en —</p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-1">
                      Coordinador/a{form.encargado_id ? " (bloqueado)" : ""}
                    </label>
                    <select
                      value={form.coordinador_id}
                      onChange={e => setForm(p => ({ ...p, coordinador_id: e.target.value, encargado_id: "" }))}
                      disabled={!!form.encargado_id}
                      className={`w-full border rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-400 ${
                        form.encargado_id ? "opacity-40 cursor-not-allowed bg-gray-100" : ""
                      }`}
                    >
                      <option value="">Sin asignar</option>
                      {miembros.map(m => {
                        const bl = bloqueadosPorFecha.has(m.id);
                        return <option key={m.id} value={m.id} disabled={bl}>{bl ? `✕ ${m.nombre} ${m.apellido} — no disponible` : `${m.nombre} ${m.apellido}`}</option>;
                      })}
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-1">
                      Predicador/a{form.encargado_id ? " (bloqueado)" : ""}
                    </label>
                    <select
                      value={form.predicador_id}
                      onChange={e => setForm(p => ({ ...p, predicador_id: e.target.value, encargado_id: "" }))}
                      disabled={!!form.encargado_id}
                      className={`w-full border rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-400 ${
                        form.encargado_id ? "opacity-40 cursor-not-allowed bg-gray-100" : ""
                      }`}
                    >
                      <option value="">Sin asignar</option>
                      {miembros.map(m => {
                        const bl = bloqueadosPorFecha.has(m.id);
                        return <option key={m.id} value={m.id} disabled={bl}>{bl ? `✕ ${m.nombre} ${m.apellido} — no disponible` : `${m.nombre} ${m.apellido}`}</option>;
                      })}
                    </select>
                  </div>
                </div>
              </div>

              {/* Descripción */}
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1">Descripción</label>
                <textarea
                  rows={3}
                  value={form.descripcion}
                  onChange={e => setForm(p => ({ ...p, descripcion: e.target.value }))}
                  className="w-full border rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-400 resize-none"
                  placeholder="Detalles del evento..."
                />
              </div>

              {/* Notas */}
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1">Notas</label>
                <textarea
                  rows={3}
                  value={form.notas}
                  onChange={e => setForm(p => ({ ...p, notas: e.target.value }))}
                  className="w-full border rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-amber-400 resize-none"
                  placeholder="Notas internas, instrucciones generales del evento..."
                />
              </div>

              {/* Link Zoom */}
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1">Link de Zoom <span className="font-normal text-gray-400">(solo visible para usuarios con sesión)</span></label>
                <input
                  type="url"
                  value={form.zoom_link}
                  onChange={e => setForm(p => ({ ...p, zoom_link: e.target.value }))}
                  placeholder="https://us06web.zoom.us/j/..."
                  className="w-full border rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-400"
                />
              </div>

              {/* Imagen */}
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1">URL Imagen</label>
                <input
                  type="text"
                  value={form.imagen_url}
                  onChange={e => setForm(p => ({ ...p, imagen_url: e.target.value }))}
                  placeholder="https://... o /carpeta/imagen.jpg"
                  className="w-full border rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-400"
                />
                {form.imagen_url && (
                  <img
                    src={normUrl(form.imagen_url)}
                    alt="preview"
                    className="mt-2 h-24 w-full object-cover rounded-lg border"
                    onError={e => { e.target.style.display = "none"; }}
                    onLoad={e => { e.target.style.display = "block"; }}
                  />
                )}
              </div>

              {/* Color */}
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">Color del evento</label>
                <div className="flex flex-wrap gap-2">
                  {COLORES_EVENTO.map(c => (
                    <button
                      key={c.value}
                      type="button"
                      onClick={() => setForm(p => ({ ...p, color: c.value }))}
                      className={`w-8 h-8 rounded-full border-4 transition ${
                        form.color === c.value ? "border-gray-800 scale-110" : "border-transparent"
                      }`}
                      style={{ backgroundColor: c.value }}
                      title={c.label}
                    />
                  ))}
                </div>
              </div>
            </div>

            <div className="flex gap-3 px-6 py-4 border-t bg-gray-50 rounded-b-2xl shrink-0">
              <button onClick={cerrarModal} className="flex-1 border border-gray-300 text-gray-600 hover:bg-gray-100 font-medium py-2.5 rounded-lg transition text-sm">
                Cancelar
              </button>
              <button
                onClick={guardar}
                disabled={guardando}
                className="flex-1 bg-blue-600 hover:bg-blue-700 text-white font-semibold py-2.5 rounded-lg transition disabled:opacity-50 text-sm"
              >
                {guardando ? "Guardando..." : editando ? "Guardar Cambios" : "Crear Evento"}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
