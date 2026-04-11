import React, { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import AdminNav from "../components/AdminNav";
import {
  CalendarDays, Plus, Trash2, X, Save, Loader2, ArrowLeft,
  FileText, Music2, Tag, ChevronUp, ChevronDown, Download, Pencil, GripVertical, ChevronRight
} from "lucide-react";
import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";
import ChordProRenderer from "../components/ChordProRenderer";

const API = import.meta.env.VITE_BACKEND_URL;

const TIPOS_EVENTO = [
  { value: "culto_jueves",  label: "Culto Jueves" },
  { value: "culto_domingo", label: "Culto Domingo" },
  { value: "otro",          label: "Otro..." },
];

function etiquetaTipo(tipo, nombre) {
  if (tipo === "culto_jueves")  return "Culto Jueves";
  if (tipo === "culto_domingo") return "Culto Domingo";
  return nombre || "Evento";
}

function formatFecha(iso) {
  if (!iso) return "";
  const d = new Date(iso);
  return d.toLocaleDateString("es-CL", { weekday: "long", year: "numeric", month: "long", day: "numeric" })
    + " · " + d.toLocaleTimeString("es-CL", { hour: "2-digit", minute: "2-digit" });
}

function formatFechaCorta(iso) {
  if (!iso) return "";
  const d = new Date(iso);
  return d.toLocaleDateString("es-CL", { day: "2-digit", month: "2-digit", year: "numeric" })
    + " " + d.toLocaleTimeString("es-CL", { hour: "2-digit", minute: "2-digit" });
}

// Convierte datetime-local value ↔ ISO string
function toInputValue(iso) {
  if (!iso) return "";
  const d = new Date(iso);
  const pad = n => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

// ─── Generador de PDF ─────────────────────────────────────────────────────────
function generarPDF(plan) {
  const titulo = etiquetaTipo(plan.tipo, plan.nombre);
  const fecha  = formatFecha(plan.fecha);

  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
  const margen = 18;
  const ancho  = doc.internal.pageSize.getWidth();
  let y = margen;

  // Cabecera
  doc.setFillColor(109, 40, 217); // violeta
  doc.rect(0, 0, ancho, 28, "F");
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(16);
  doc.setFont("helvetica", "bold");
  doc.text(titulo, margen, 13);
  doc.setFontSize(9);
  doc.setFont("helvetica", "normal");
  doc.text(fecha, margen, 22);

  y = 36;
  doc.setTextColor(30, 30, 30);

  const items = plan.items || [];
  if (!items.length) {
    doc.setFontSize(10);
    doc.text("Sin elementos en el programa.", margen, y);
  }

  let num = 0;
  for (const item of items) {
    if (y > 270) { doc.addPage(); y = margen; }

    if (item.tipo === "etiqueta") {
      // Separador de sección
      y += 4;
      doc.setFillColor(245, 243, 255);
      doc.setDrawColor(109, 40, 217);
      doc.roundedRect(margen - 2, y - 5, ancho - margen * 2 + 4, 9, 2, 2, "FD");
      doc.setFontSize(10);
      doc.setFont("helvetica", "bold");
      doc.setTextColor(109, 40, 217);
      doc.text(item.texto.toUpperCase(), margen + 2, y + 1);
      doc.setTextColor(30, 30, 30);
      y += 10;
    } else if (item.tipo === "cancion") {
      num++;
      doc.setFontSize(10);
      doc.setFont("helvetica", "bold");
      const lineTitulo = `${num}. ${item.titulo}`;
      doc.text(lineTitulo, margen + 4, y);
      y += 5;
      if (item.artista || item.tono) {
        doc.setFontSize(8.5);
        doc.setFont("helvetica", "normal");
        doc.setTextColor(100, 100, 100);
        const sub = [item.artista, item.tono ? `Tono: ${item.tono}` : ""].filter(Boolean).join("  ·  ");
        doc.text(sub, margen + 7, y);
        doc.setTextColor(30, 30, 30);
        y += 6;
      } else {
        y += 2;
      }
    }
  }

  // Pie
  const totalPages = doc.internal.getNumberOfPages();
  for (let p = 1; p <= totalPages; p++) {
    doc.setPage(p);
    doc.setFontSize(8);
    doc.setTextColor(160, 160, 160);
    doc.text(`Página ${p} de ${totalPages}`, ancho / 2, 292, { align: "center" });
  }

  const nombreArchivo = `${titulo.replace(/\s+/g, "_")}_${formatFechaCorta(plan.fecha).replace(/[/:]/g, "-")}.pdf`;
  doc.save(nombreArchivo);
}

// ─── Modal de selector de canciones ──────────────────────────────────────────
function ModalCanciones({ onSeleccionar, onCerrar, hdrs }) {
  const [canciones, setCanciones] = useState([]);
  const [loading, setLoading]     = useState(true);
  const [busqueda, setBusqueda]   = useState("");

  useEffect(() => {
    fetch(`${API}/api/chordpro`, { headers: hdrs() })
      .then(r => r.json())
      .then(d => { setCanciones(d); setLoading(false); })
      .catch(() => setLoading(false));
  }, []);

  const filtradas = canciones.filter(c =>
    c.titulo.toLowerCase().includes(busqueda.toLowerCase()) ||
    (c.artista || "").toLowerCase().includes(busqueda.toLowerCase())
  );

  return (
    <div className="fixed inset-0 bg-black/50 z-[60] flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg flex flex-col max-h-[80vh]">
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
          <h3 className="font-bold text-gray-800 flex items-center gap-2">
            <Music2 size={17} className="text-violet-500" /> Agregar canción
          </h3>
          <button onClick={onCerrar} className="text-gray-400 hover:text-gray-600"><X size={19} /></button>
        </div>
        <div className="px-4 pt-3 pb-2">
          <input
            type="text"
            value={busqueda}
            onChange={e => setBusqueda(e.target.value)}
            placeholder="Buscar canción..."
            autoFocus
            className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-violet-300"
          />
        </div>
        <div className="overflow-y-auto flex-1 divide-y divide-gray-100 px-2 pb-3">
          {loading ? (
            <div className="flex items-center justify-center gap-2 py-10 text-gray-400 text-sm">
              <Loader2 size={17} className="animate-spin" /> Cargando...
            </div>
          ) : filtradas.length === 0 ? (
            <p className="text-center text-gray-400 text-sm py-10">Sin resultados</p>
          ) : filtradas.map(c => (
            <button
              key={c.id}
              onClick={() => onSeleccionar(c)}
              className="w-full text-left px-3 py-3 rounded-xl hover:bg-violet-50 transition"
            >
              <p className="font-semibold text-gray-800 text-sm">{c.titulo}</p>
              <p className="text-xs text-gray-400">
                {c.artista && <span>{c.artista}</span>}
                {c.artista && c.tono && <span className="mx-1">·</span>}
                {c.tono && <span className="text-violet-600 font-medium">Tono: {c.tono}</span>}
              </p>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

// ─── Editor de programa (lista de items con drag conceptual) ─────────────────
function EditorPrograma({ items, onChange }) {
  const agregar = (nuevoItem) => onChange([...items, nuevoItem]);
  const eliminar = (idx) => onChange(items.filter((_, i) => i !== idx));
  const mover = (idx, dir) => {
    const arr = [...items];
    const target = idx + dir;
    if (target < 0 || target >= arr.length) return;
    [arr[idx], arr[target]] = [arr[target], arr[idx]];
    onChange(arr);
  };

  const [mostrarCanciones, setMostrarCanciones]   = useState(false);
  const [inputEtiqueta, setInputEtiqueta]         = useState("");
  const [mostrarInputEtq, setMostrarInputEtq]     = useState(false);
  const { getToken } = useAuth?.() || {};
  const hdrs = useCallback(() => ({
    Authorization: `Bearer ${getToken ? getToken() : ""}`,
    "Content-Type": "application/json",
  }), [getToken]);

  const agregarEtiqueta = () => {
    if (!inputEtiqueta.trim()) return;
    agregar({ tipo: "etiqueta", texto: inputEtiqueta.trim() });
    setInputEtiqueta("");
    setMostrarInputEtq(false);
  };

  return (
    <div className="space-y-3">
      {/* Lista de items */}
      <div className="space-y-1.5">
        {items.length === 0 && (
          <p className="text-sm text-gray-400 text-center py-4 border-2 border-dashed border-gray-200 rounded-xl">
            El programa está vacío — agrega etiquetas y canciones
          </p>
        )}
        {items.map((item, idx) => (
          <div
            key={idx}
            className={`flex items-center gap-2 rounded-xl px-3 py-2.5 border ${
              item.tipo === "etiqueta"
                ? "bg-amber-50 border-amber-200"
                : "bg-white border-gray-200"
            }`}
          >
            <GripVertical size={14} className="text-gray-300 flex-shrink-0" />

            <div className="flex-1 min-w-0">
              {item.tipo === "etiqueta" ? (
                <p className="text-xs font-bold text-amber-600 uppercase tracking-widest">{item.texto}</p>
              ) : (
                <>
                  <p className="text-sm font-semibold text-gray-800 truncate">{item.titulo}</p>
                  <p className="text-xs text-gray-400">
                    {item.artista && <span>{item.artista}</span>}
                    {item.artista && item.tono && <span className="mx-1">·</span>}
                    {item.tono && <span className="text-violet-600 font-medium">Tono: {item.tono}</span>}
                  </p>
                </>
              )}
            </div>

            <div className="flex items-center gap-0.5 flex-shrink-0">
              <button onClick={() => mover(idx, -1)} disabled={idx === 0}
                className="p-1 rounded hover:bg-gray-100 text-gray-400 disabled:opacity-30 transition">
                <ChevronUp size={14} />
              </button>
              <button onClick={() => mover(idx, 1)} disabled={idx === items.length - 1}
                className="p-1 rounded hover:bg-gray-100 text-gray-400 disabled:opacity-30 transition">
                <ChevronDown size={14} />
              </button>
              <button onClick={() => eliminar(idx)}
                className="p-1 rounded hover:bg-red-50 text-gray-400 hover:text-red-500 transition">
                <Trash2 size={14} />
              </button>
            </div>
          </div>
        ))}
      </div>

      {/* Botones para agregar */}
      <div className="flex flex-wrap gap-2 pt-1">
        {/* Etiqueta */}
        {mostrarInputEtq ? (
          <div className="flex items-center gap-2 w-full">
            <Tag size={15} className="text-amber-500 flex-shrink-0" />
            <input
              type="text"
              value={inputEtiqueta}
              onChange={e => setInputEtiqueta(e.target.value)}
              onKeyDown={e => { if (e.key === "Enter") agregarEtiqueta(); if (e.key === "Escape") { setMostrarInputEtq(false); setInputEtiqueta(""); }}}
              placeholder="Ej: Alabanza, Oración, Palabra..."
              autoFocus
              className="flex-1 border border-amber-300 rounded-xl px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-amber-200"
            />
            <button onClick={agregarEtiqueta}
              className="bg-amber-500 hover:bg-amber-600 text-white px-3 py-1.5 rounded-xl text-sm font-semibold transition">
              Agregar
            </button>
            <button onClick={() => { setMostrarInputEtq(false); setInputEtiqueta(""); }}
              className="text-gray-400 hover:text-gray-600 p-1.5">
              <X size={15} />
            </button>
          </div>
        ) : (
          <button
            onClick={() => setMostrarInputEtq(true)}
            className="flex items-center gap-2 border border-amber-300 text-amber-600 hover:bg-amber-50 px-3 py-1.5 rounded-xl text-sm font-semibold transition"
          >
            <Tag size={14} /> Agregar sección
          </button>
        )}

        {/* Canción */}
        <button
          onClick={() => setMostrarCanciones(true)}
          className="flex items-center gap-2 border border-violet-300 text-violet-600 hover:bg-violet-50 px-3 py-1.5 rounded-xl text-sm font-semibold transition"
        >
          <Music2 size={14} /> Agregar canción
        </button>
      </div>

      {mostrarCanciones && (
        <ModalCanciones
          hdrs={hdrs}
          onCerrar={() => setMostrarCanciones(false)}
          onSeleccionar={(c) => {
            agregar({ tipo: "cancion", cancion_id: c.id, titulo: c.titulo, artista: c.artista || "", tono: c.tono || "" });
            setMostrarCanciones(false);
          }}
        />
      )}
    </div>
  );
}

// ─── Componente principal ─────────────────────────────────────────────────────
export default function AdminPlanificacion() {
  const navigate  = useNavigate();
  const { getToken } = useAuth();
  const hdrs = useCallback(() => ({
    Authorization: `Bearer ${getToken()}`,
    "Content-Type": "application/json",
  }), [getToken]);

  const [planes, setPlanes]     = useState([]);
  const [loading, setLoading]   = useState(true);

  // Modal crear/editar
  const [modal, setModal]       = useState(null); // null | "nuevo" | { ...plan }
  const [form, setForm]         = useState({ fecha: "", tipo: "culto_domingo", nombre: "", items: [] });
  const [guardando, setGuardando] = useState(false);
  const [errorForm, setErrorForm] = useState(null);

  // Vista detalle
  const [vistaPlan, setVistaPlan]         = useState(null);
  const [loadingVista, setLoadingVista]   = useState(false);

  // Vista canción dentro del plan
  const [vistaCancion, setVistaCancion]   = useState(null);
  const [loadingCancion, setLoadingCancion] = useState(false);
  const [semitonos, setSemitonos]         = useState(0);

  // Confirmar borrado
  const [borrandoId, setBorrandoId] = useState(null);

  // Descargando PDF
  const [descargando, setDescargando] = useState(null);

  const cargar = async () => {
    setLoading(true);
    try {
      const r = await fetch(`${API}/api/planificacion`, { headers: hdrs() });
      const data = await r.json();
      setPlanes(Array.isArray(data) ? data : []);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { cargar(); }, []);

  const abrirNuevo = () => {
    // Próximo domingo por defecto
    const d = new Date();
    d.setDate(d.getDate() + ((7 - d.getDay()) % 7 || 7));
    d.setHours(11, 0, 0, 0);
    setForm({ fecha: toInputValue(d.toISOString()), tipo: "culto_domingo", nombre: "", items: [] });
    setErrorForm(null);
    setModal("nuevo");
  };

  const abrirEditar = async (plan) => {
    setErrorForm(null);
    const r  = await fetch(`${API}/api/planificacion/${plan.id}`, { headers: hdrs() });
    const d  = await r.json();
    setForm({ fecha: toInputValue(d.fecha), tipo: d.tipo, nombre: d.nombre || "", items: d.items || [] });
    setModal(d);
  };

  const cerrarModal = () => { setModal(null); setErrorForm(null); };

  const guardar = async () => {
    if (!form.fecha) { setErrorForm("La fecha es obligatoria"); return; }
    if (form.tipo === "otro" && !form.nombre.trim()) { setErrorForm("Escribe el nombre del evento"); return; }
    setGuardando(true);
    setErrorForm(null);
    try {
      const esEdicion = modal && modal !== "nuevo";
      const url    = esEdicion ? `${API}/api/planificacion/${modal.id}` : `${API}/api/planificacion`;
      const r      = await fetch(url, {
        method: esEdicion ? "PUT" : "POST",
        headers: hdrs(),
        body: JSON.stringify({ ...form, fecha: new Date(form.fecha).toISOString() }),
      });
      const data = await r.json();
      if (!r.ok) { setErrorForm(data.error || "Error al guardar"); return; }
      await cargar();
      cerrarModal();
    } catch {
      setErrorForm("Error de red");
    } finally {
      setGuardando(false);
    }
  };

  const borrar = async (id) => {
    await fetch(`${API}/api/planificacion/${id}`, { method: "DELETE", headers: hdrs() });
    setBorrandoId(null);
    await cargar();
  };

  const verPlan = async (plan) => {
    setLoadingVista(true);
    setVistaPlan(null);
    const r    = await fetch(`${API}/api/planificacion/${plan.id}`, { headers: hdrs() });
    const data = await r.json();
    setVistaPlan(data);
    setLoadingVista(false);
  };

  const verCancion = async (item) => {
    if (!item.cancion_id) return;
    setSemitonos(0);
    setLoadingCancion(true);
    setVistaCancion(null);
    const r    = await fetch(`${API}/api/chordpro/${item.cancion_id}`, { headers: hdrs() });
    const data = await r.json();
    setVistaCancion(data);
    setLoadingCancion(false);
  };

  const descargarPDF = async (plan) => {
    setDescargando(plan.id);
    try {
      // Cargar plan completo (con items)
      const r = await fetch(`${API}/api/planificacion/${plan.id}`, { headers: hdrs() });
      const full = await r.json();
      generarPDF(full);
    } finally {
      setDescargando(null);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <AdminNav />

      <div className="max-w-4xl mx-auto px-4 py-8 space-y-5">
        {/* Encabezado */}
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <button
              onClick={() => navigate("/admin")}
              className="p-1.5 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-200 transition"
            >
              <ArrowLeft size={18} />
            </button>
            <h1 className="text-xl font-bold text-gray-800 flex items-center gap-2">
              <CalendarDays size={20} className="text-blue-500" />
              Planificación
            </h1>
          </div>
          <button
            onClick={abrirNuevo}
            className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-xl text-sm font-semibold transition"
          >
            <Plus size={16} /> Nuevo plan
          </button>
        </div>

        {/* Lista de planes */}
        <div className="bg-white rounded-2xl shadow-sm divide-y divide-gray-100">
          {loading ? (
            <div className="flex items-center justify-center gap-2 py-12 text-gray-400 text-sm">
              <Loader2 size={18} className="animate-spin" /> Cargando...
            </div>
          ) : planes.length === 0 ? (
            <div className="py-12 text-center text-gray-400 text-sm">
              No hay planes aún — crea el primero
            </div>
          ) : planes.map(plan => (
            <div
              key={plan.id}
              onClick={() => verPlan(plan)}
              className="flex items-center gap-3 px-5 py-4 cursor-pointer hover:bg-gray-50 transition"
            >
              <div className="flex-1 min-w-0">
                <p className="font-semibold text-gray-800">{etiquetaTipo(plan.tipo, plan.nombre)}</p>
                <p className="text-sm text-gray-400">{formatFecha(plan.fecha)}</p>
              </div>
              <div className="flex items-center gap-2 flex-shrink-0">
                <button
                  onClick={e => { e.stopPropagation(); descargarPDF(plan); }}
                  disabled={descargando === plan.id}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm text-blue-600 hover:bg-blue-50 disabled:opacity-50 transition font-medium"
                  title="Descargar PDF"
                >
                  {descargando === plan.id
                    ? <Loader2 size={14} className="animate-spin" />
                    : <Download size={14} />}
                  PDF
                </button>
                <button
                  onClick={e => { e.stopPropagation(); abrirEditar(plan); }}
                  className="p-2 rounded-lg text-gray-400 hover:text-blue-600 hover:bg-blue-50 transition"
                  title="Editar"
                >
                  <Pencil size={16} />
                </button>
                <button
                  onClick={e => { e.stopPropagation(); setBorrandoId(plan.id); }}
                  className="p-2 rounded-lg text-gray-400 hover:text-red-500 hover:bg-red-50 transition"
                  title="Eliminar"
                >
                  <Trash2 size={16} />
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Panel de vista detalle */}
      {(vistaPlan || loadingVista) && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-start justify-center p-4 overflow-y-auto">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg my-8">
            {/* Cabecera */}
            <div className="sticky top-0 bg-white flex items-center gap-3 px-5 py-4 border-b border-gray-100 rounded-t-2xl">
              <button
                onClick={() => setVistaPlan(null)}
                className="p-1.5 rounded-lg text-gray-400 hover:bg-gray-100 transition flex-shrink-0"
              >
                <X size={20} />
              </button>
              <div className="flex-1 min-w-0">
                <p className="font-bold text-gray-800 truncate">
                  {vistaPlan ? etiquetaTipo(vistaPlan.tipo, vistaPlan.nombre) : ""}
                </p>
                {vistaPlan && (
                  <p className="text-xs text-gray-400">{formatFecha(vistaPlan.fecha)}</p>
                )}
              </div>
              {vistaPlan && (
                <div className="flex items-center gap-2 flex-shrink-0">
                  <button
                    onClick={() => descargarPDF(vistaPlan)}
                    disabled={descargando === vistaPlan.id}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm text-blue-600 hover:bg-blue-50 disabled:opacity-50 transition font-medium"
                  >
                    {descargando === vistaPlan.id
                      ? <Loader2 size={14} className="animate-spin" />
                      : <Download size={14} />}
                    PDF
                  </button>
                  <button
                    onClick={() => { setVistaPlan(null); abrirEditar(vistaPlan); }}
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold rounded-lg transition"
                  >
                    <Pencil size={14} /> Editar
                  </button>
                </div>
              )}
            </div>

            {/* Contenido */}
            <div className="p-6">
              {loadingVista ? (
                <div className="flex items-center justify-center gap-2 py-16 text-gray-400">
                  <Loader2 size={20} className="animate-spin" /> Cargando...
                </div>
              ) : (
                <div className="space-y-1.5">
                  {(!vistaPlan.items || vistaPlan.items.length === 0) ? (
                    <p className="text-gray-400 text-sm text-center py-8">Este plan no tiene elementos aún</p>
                  ) : vistaPlan.items.map((item, idx) => (
                    item.tipo === "etiqueta" ? (
                      <div key={idx} className="pt-3 pb-1">
                        <p className="text-xs font-bold text-amber-600 uppercase tracking-widest"
                           style={{ letterSpacing: "0.1em" }}>
                          {item.texto}
                        </p>
                        <div className="h-px bg-amber-100 mt-1" />
                      </div>
                    ) : (
                      <div
                        key={idx}
                        onClick={() => verCancion(item)}
                        className={`flex items-center gap-3 py-2.5 pl-2 pr-2 rounded-xl transition ${
                          item.cancion_id
                            ? "cursor-pointer hover:bg-violet-50 active:bg-violet-100"
                            : ""
                        }`}
                      >
                        <Music2 size={14} className="text-violet-400 flex-shrink-0" />
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-semibold text-gray-800 truncate">{item.titulo}</p>
                          {(item.artista || item.tono) && (
                            <p className="text-xs text-gray-400">
                              {item.artista && <span>{item.artista}</span>}
                              {item.artista && item.tono && <span className="mx-1">·</span>}
                              {item.tono && <span className="text-violet-600 font-medium">Tono: {item.tono}</span>}
                            </p>
                          )}
                        </div>
                        {item.cancion_id && (
                          <ChevronRight size={14} className="text-gray-300 flex-shrink-0" />
                        )}
                      </div>
                    )
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Vista canción — PANTALLA COMPLETA */}
      {(vistaCancion || loadingCancion) && (
        <div className="fixed inset-0 bg-white z-[60] flex flex-col">
          {/* Barra superior */}
          <div className="flex items-center gap-3 px-4 py-3 border-b border-gray-100 bg-white flex-shrink-0">
            <button
              onClick={() => { setVistaCancion(null); setSemitonos(0); }}
              className="p-2 rounded-xl text-gray-500 hover:bg-gray-100 active:bg-gray-200 transition flex-shrink-0"
            >
              <ArrowLeft size={22} />
            </button>
            <div className="flex-1 min-w-0">
              <p className="font-bold text-gray-900 text-base leading-tight truncate">{vistaCancion?.titulo || ""}</p>
              {vistaCancion?.artista && (
                <p className="text-sm text-gray-400 truncate">{vistaCancion.artista}</p>
              )}
            </div>
            {/* Transposición */}
            <div className="flex items-center gap-0.5 bg-gray-100 rounded-xl px-1 py-1 flex-shrink-0">
              <button
                onClick={() => setSemitonos(s => s - 1)}
                className="p-2 rounded-lg hover:bg-white active:bg-gray-200 transition text-gray-600"
              >
                <ChevronDown size={18} />
              </button>
              <span className="text-sm font-bold text-violet-700 w-16 text-center select-none">
                {semitonos === 0 ? "Original" : semitonos > 0 ? `+${semitonos}` : semitonos}
              </span>
              <button
                onClick={() => setSemitonos(s => s + 1)}
                className="p-2 rounded-lg hover:bg-white active:bg-gray-200 transition text-gray-600"
              >
                <ChevronUp size={18} />
              </button>
              {semitonos !== 0 && (
                <button
                  onClick={() => setSemitonos(0)}
                  className="p-1.5 rounded-lg hover:bg-white transition text-gray-400"
                >
                  <X size={14} />
                </button>
              )}
            </div>
          </div>

          {/* Contenido scrolleable */}
          <div className="flex-1 overflow-y-auto px-5 py-5">
            {loadingCancion ? (
              <div className="flex items-center justify-center gap-2 h-full text-gray-400">
                <Loader2 size={24} className="animate-spin" /> Cargando...
              </div>
            ) : (
              <>
                {vistaCancion?.tono && (
                  <div className="mb-5">
                    <span className="inline-block bg-violet-100 text-violet-700 text-sm font-semibold px-3 py-1 rounded-full">
                      Tono original: {vistaCancion.tono}
                    </span>
                  </div>
                )}
                <div className="text-xl leading-relaxed">
                  <ChordProRenderer contenido={vistaCancion?.contenido || ""} transponer={semitonos} escala="grande" />
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {/* Modal crear/editar */}
      {modal !== null && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-start justify-center p-4 overflow-y-auto">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-2xl my-8">
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
              <h2 className="font-bold text-gray-800">
                {modal === "nuevo" ? "Nuevo plan de evento" : "Editar plan"}
              </h2>
              <button onClick={cerrarModal} className="text-gray-400 hover:text-gray-600">
                <X size={20} />
              </button>
            </div>

            <div className="p-6 space-y-5">
              {/* Fecha y hora */}
              <div className="space-y-1">
                <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Fecha y hora *</label>
                <input
                  type="datetime-local"
                  value={form.fecha}
                  onChange={e => setForm(f => ({ ...f, fecha: e.target.value }))}
                  className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300"
                />
              </div>

              {/* Tipo de evento */}
              <div className="space-y-1">
                <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Tipo de evento *</label>
                <div className="flex flex-wrap gap-2">
                  {TIPOS_EVENTO.map(t => (
                    <button
                      key={t.value}
                      onClick={() => setForm(f => ({ ...f, tipo: t.value }))}
                      className={`px-4 py-2 rounded-xl text-sm font-semibold border transition ${
                        form.tipo === t.value
                          ? "bg-blue-600 border-blue-600 text-white"
                          : "bg-white border-gray-200 text-gray-600 hover:border-blue-300"
                      }`}
                    >
                      {t.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Nombre personalizado (solo si tipo === "otro") */}
              {form.tipo === "otro" && (
                <div className="space-y-1">
                  <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Nombre del evento *</label>
                  <input
                    type="text"
                    value={form.nombre}
                    onChange={e => setForm(f => ({ ...f, nombre: e.target.value }))}
                    placeholder="Ej: Vigilia, Aniversario, Retiro..."
                    autoFocus
                    className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300"
                  />
                </div>
              )}

              {/* Programa */}
              <div className="space-y-2">
                <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide flex items-center gap-1.5">
                  <FileText size={13} /> Programa del evento
                </label>
                <EditorPrograma
                  items={form.items}
                  onChange={items => setForm(f => ({ ...f, items }))}
                />
              </div>

              {errorForm && <p className="text-red-500 text-sm">{errorForm}</p>}

              <div className="flex justify-end gap-3 pt-2">
                <button onClick={cerrarModal}
                  className="px-4 py-2 rounded-xl text-sm text-gray-600 hover:bg-gray-100 transition">
                  Cancelar
                </button>
                <button
                  onClick={guardar}
                  disabled={guardando}
                  className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white px-5 py-2 rounded-xl text-sm font-semibold transition"
                >
                  {guardando ? <Loader2 size={15} className="animate-spin" /> : <Save size={15} />}
                  {guardando ? "Guardando..." : "Guardar"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Confirmar borrado */}
      {borrandoId && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-xl p-6 max-w-sm w-full space-y-4">
            <h3 className="font-bold text-gray-800">¿Eliminar este plan?</h3>
            <p className="text-sm text-gray-500">Esta acción no se puede deshacer.</p>
            <div className="flex justify-end gap-3">
              <button onClick={() => setBorrandoId(null)}
                className="px-4 py-2 rounded-xl text-sm text-gray-600 hover:bg-gray-100 transition">
                Cancelar
              </button>
              <button
                onClick={() => borrar(borrandoId)}
                className="px-4 py-2 rounded-xl text-sm bg-red-600 hover:bg-red-700 text-white font-semibold transition">
                Eliminar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
