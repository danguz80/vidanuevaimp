import React, { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { jsPDF } from "jspdf";
import AdminNav from "../components/AdminNav";
import { useAuth } from "../context/AuthContext";

const API = import.meta.env.VITE_BACKEND_URL;

const ROLES_SECRETARIA = ["admin", "Pastor", "Obispo", "Secretario"];

const TIPOS_EVENTO = [
  { value: "culto_domingo",   label: "Culto Domingo" },
  { value: "culto_jueves",    label: "Culto Jueves" },
  { value: "estudio_biblico", label: "Estudio bíblico" },
  { value: "dorcas",          label: "Dorcas" },
  { value: "cadena_oracion",  label: "Cadena Oración" },
  { value: "esc_dominical",   label: "Esc. Dominical" },

  { value: "cumpleanos",      label: "Cumpleaños" },
  { value: "presentaciones",  label: "Presentaciones" },
  { value: "defunciones",     label: "Defunciones" },
  { value: "bautizos",        label: "Bautizos" },
  { value: "matrimonios",     label: "Matrimonios" },
  { value: "evento_especial", label: "Evento especial" },
];

const TIPOS_ASISTENCIA = [
  { value: "estudio_biblico", label: "Estudio bíblico" },
  { value: "dorcas",          label: "Dorcas" },
  { value: "culto_jueves",    label: "Culto Jueves" },
  { value: "cadena_oracion",  label: "Cadena Oración" },
  { value: "esc_dominical",   label: "Esc. Dominical" },
  { value: "culto_domingo",   label: "Culto Domingo" },
  { value: "evento_especial", label: "Evento Especial" },
];

const MESES_ES = [
  "Enero","Febrero","Marzo","Abril","Mayo","Junio",
  "Julio","Agosto","Septiembre","Octubre","Noviembre","Diciembre",
];

const labelEvento     = (v) => TIPOS_EVENTO.find(t => t.value === v)?.label || v;
const labelAsistencia = (v) => TIPOS_EVENTO.find(t => t.value === v)?.label || v;

// ─── Generador PDF Bitácora ───────────────────────────────────────────────────
async function generarBitacoraPDF(mesPicker, getToken, setCargandoPDF) {
  setCargandoPDF(true);
  try {
    const [anio, mes] = mesPicker.split("-");
    const desde = `${anio}-${mes}-01`;
    const diasEnMes = new Date(parseInt(anio), parseInt(mes), 0).getDate();
    const hasta = `${anio}-${mes}-${String(diasEnMes).padStart(2, "0")}`;

    const res = await fetch(`${API}/api/secretaria/bitacora?desde=${desde}&hasta=${hasta}`, {
      headers: { Authorization: `Bearer ${getToken()}` },
    });
    if (!res.ok) throw new Error("Error al obtener datos del servidor");
    const { eventos, asistencias } = await res.json();

    const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
    const PW = doc.internal.pageSize.getWidth();
    const PH = doc.internal.pageSize.getHeight();
    const ML = 14;
    const MR = 14;
    const CW = PW - ML - MR;
    const BOTTOM = PH - 14;
    let y = 16;

    const checkBreak = (needed = 10) => {
      if (y + needed > BOTTOM) {
        doc.addPage();
        y = 16;
      }
    };

    const mesNombre = MESES_ES[parseInt(mes) - 1];

    // ── Encabezado ─────────────────────────────────────────────
    doc.setFontSize(15);
    doc.setFont("helvetica", "bold");
    doc.text("IGLESIA VIDA NUEVA IMP", PW / 2, y, { align: "center" });
    y += 7;
    doc.setFontSize(12);
    doc.text(`BITÁCORA — ${mesNombre.toUpperCase()} ${anio}`, PW / 2, y, { align: "center" });
    y += 5;
    doc.setFontSize(8);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(100);
    doc.text(`Generado el ${new Date().toLocaleDateString("es-CL")}`, PW / 2, y, { align: "center" });
    doc.setTextColor(0);
    y += 4;
    doc.setLineWidth(0.5);
    doc.setDrawColor(60);
    doc.line(ML, y, PW - MR, y);
    y += 8;

    // ── Sección: Eventos ────────────────────────────────────────
    doc.setFontSize(11);
    doc.setFont("helvetica", "bold");
    doc.text(`EVENTOS DEL MES (${eventos.length})`, ML, y);
    y += 6;

    if (eventos.length === 0) {
      doc.setFontSize(9);
      doc.setFont("helvetica", "italic");
      doc.setTextColor(130);
      doc.text("Sin eventos registrados en este mes.", ML, y);
      doc.setTextColor(0);
      y += 7;
    } else {
      // Cabecera tabla
      const colTipoX = ML,     colTipoW = 58;
      const colFechaX = ML+58, colFechaW = 22;
      const colDescX  = ML+80, colDescW  = CW - 80;

      doc.setFontSize(8);
      doc.setFont("helvetica", "bold");
      doc.setFillColor(220, 220, 220);
      doc.rect(ML, y - 4, CW, 6.5, "F");
      doc.text("TIPO / NOMBRE",  colTipoX  + 1, y);
      doc.text("FECHA",          colFechaX + 1, y);
      doc.text("DESCRIPCIÓN",    colDescX  + 1, y);
      y += 4;
      doc.setLineWidth(0.3);
      doc.setDrawColor(100);
      doc.line(ML, y, PW - MR, y);
      y += 4;

      doc.setFont("helvetica", "normal");
      doc.setFontSize(8);
      const lineH = 4.5; // interlineado fijo en mm para fontSize 8

      eventos.forEach((ev) => {
        const tipoStr = ev.tipo === "evento_especial" && ev.nombre_evento
          ? `${labelEvento(ev.tipo)}\n(${ev.nombre_evento})`
          : labelEvento(ev.tipo);
        const fechaStr = ev.fecha
          ? ev.fecha.split("T")[0].split("-").reverse().join("/")
          : "";
        const tipoLines = doc.splitTextToSize(tipoStr, colTipoW - 2);
        const descLines = ev.descripcion
          ? doc.splitTextToSize(ev.descripcion, colDescW - 2)
          : [];

        const rowLines = Math.max(tipoLines.length, descLines.length, 1);
        const rowH     = rowLines * lineH + 3; // +3 mm de separación entre filas

        checkBreak(rowH + 2);
        doc.text(tipoLines,           colTipoX  + 1, y);
        doc.text(fechaStr,            colFechaX + 1, y);
        if (descLines.length) doc.text(descLines, colDescX + 1, y);
        y += rowH;
      });
      y += 7;
    }

    // ── Sección: Asistencias ────────────────────────────────────
    checkBreak(16);
    doc.setFontSize(11);
    doc.setFont("helvetica", "bold");
    doc.setDrawColor(60);
    doc.setLineWidth(0.5);
    doc.line(ML, y, PW - MR, y);
    y += 6;
    doc.text(`ASISTENCIAS (${asistencias.length} sesión/es)`, ML, y);
    y += 7;

    if (asistencias.length === 0) {
      doc.setFontSize(9);
      doc.setFont("helvetica", "italic");
      doc.setTextColor(130);
      doc.text("Sin registros de asistencia en este mes.", ML, y);
      doc.setTextColor(0);
      y += 7;
    } else {
      asistencias.forEach((sesion) => {
        const tipoLbl = sesion.tipo_evento === "evento_especial" && sesion.nombre_evento
          ? `${labelAsistencia(sesion.tipo_evento)}: ${sesion.nombre_evento}`
          : labelAsistencia(sesion.tipo_evento);
        const fechaSesion = sesion.fecha
          ? sesion.fecha.split("T")[0].split("-").reverse().join("/")
          : "";
        const registros = sesion.registros || [];
        const presentes = registros.filter(r => r.presente).length;

        checkBreak(16);

        // Cabecera sesión
        doc.setFontSize(9.5);
        doc.setFont("helvetica", "bold");
        doc.setFillColor(235, 240, 255);
        doc.rect(ML, y - 4.5, CW, 7, "F");
        doc.setDrawColor(160, 170, 220);
        doc.setLineWidth(0.3);
        doc.rect(ML, y - 4.5, CW, 7, "S");
        doc.setTextColor(20);
        doc.text(`${tipoLbl}  —  ${fechaSesion}`, ML + 2, y);
        doc.setFont("helvetica", "normal");
        doc.setFontSize(8.5);
        doc.setTextColor(80);
        doc.text(`Presentes: ${presentes} / ${registros.length}`, PW - MR - 1, y, { align: "right" });
        doc.setTextColor(0);
        y += 4;
        doc.setLineWidth(0.1);
        doc.setDrawColor(200);
        doc.line(ML, y, PW - MR, y);
        y += 4;

        if (registros.length === 0) {
          doc.setFontSize(8);
          doc.setFont("helvetica", "italic");
          doc.setTextColor(150);
          doc.text("Sin registros.", ML + 2, y);
          doc.setTextColor(0);
          y += 5;
        } else {
          // Solo presentes en el PDF
          const sorted = registros.filter(r => r.presente);

          const halfW = (CW - 6) / 2;
          doc.setFontSize(8);

          for (let i = 0; i < sorted.length; i += 2) {
            checkBreak(5);
            const r1 = sorted[i];
            const r2 = i + 1 < sorted.length ? sorted[i + 1] : null;

            const formatNombre = (r) => {
              const n = r.nombre && r.apellido
                ? `${r.nombre} ${r.apellido}`
                : r.nombre_visitante || "(Sin nombre)";
              return `✓  ${n}${!r.nombre ? " (*)" : ""}`;
            };

            doc.setFont("helvetica", "normal");
            doc.setTextColor(0);
            doc.text(formatNombre(r1), ML + 2, y);

            if (r2) {
              doc.text(formatNombre(r2), ML + 4 + halfW, y);
            }
            y += 4.5;
          }
          // Nota visita
          const hayVisitantes = sorted.some(r => !r.nombre);
          if (hayVisitantes) {
            doc.setFontSize(7);
            doc.setFont("helvetica", "italic");
            doc.setTextColor(130);
            doc.text("(*) Visitante externo", ML + 2, y);
            doc.setTextColor(0);
            y += 4;
          }
        }
        y += 5;
      });
    }

    // ── Pie de página en todas las páginas ─────────────────────
    const totalPags = doc.internal.getNumberOfPages();
    for (let i = 1; i <= totalPags; i++) {
      doc.setPage(i);
      doc.setFontSize(7.5);
      doc.setTextColor(150);
      doc.setFont("helvetica", "normal");
      doc.text(
        `Página ${i} de ${totalPags}`,
        PW - MR, PH - 5, { align: "right" }
      );
      doc.text(
        "Iglesia Vida Nueva IMP — Documento Reservado",
        ML, PH - 5
      );
    }
    doc.setTextColor(0);

    doc.save(`bitacora-${mesNombre.toLowerCase()}-${anio}.pdf`);
  } catch (e) {
    alert("Error al generar PDF: " + e.message);
  } finally {
    setCargandoPDF(false);
  }
}

// ─── Sección: Ver todos los eventos ──────────────────────────────────────────
function VerEventos({ getToken }) {
  const ahora = new Date();
  const mesActual = `${ahora.getFullYear()}-${String(ahora.getMonth() + 1).padStart(2, "0")}`;
  const [mesPicker, setMesPicker] = useState(mesActual);
  const [eventos, setEventos] = useState([]);
  const [cargando, setCargando] = useState(false);
  const [buscado, setBuscado] = useState(false);
  const [eventoDetalle, setEventoDetalle] = useState(null);
  const [cargandoDetalle, setCargandoDetalle] = useState(false);

  const buscar = useCallback(async (picker) => {
    const [anio, mes] = (picker || mesPicker).split("-");
    const desde = `${anio}-${mes}-01`;
    const diasEnMes = new Date(parseInt(anio), parseInt(mes), 0).getDate();
    const hasta = `${anio}-${mes}-${diasEnMes}`;
    setCargando(true);
    setBuscado(true);
    setEventoDetalle(null);
    try {
      const res = await fetch(`${API}/api/secretaria/eventos?desde=${desde}&hasta=${hasta}`, {
        headers: { Authorization: `Bearer ${getToken()}` },
      });
      const data = await res.json();
      setEventos(Array.isArray(data) ? data : []);
    } catch {
      setEventos([]);
    } finally {
      setCargando(false);
    }
  }, [mesPicker, getToken]);

  useEffect(() => { buscar(mesActual); }, []); // eslint-disable-line

  const abrirDetalle = async (ev) => {
    setCargandoDetalle(true);
    setEventoDetalle({ ...ev, asistencias: null }); // muestra skeleton
    try {
      const res = await fetch(`${API}/api/secretaria/eventos/${ev.id}`, {
        headers: { Authorization: `Bearer ${getToken()}` },
      });
      const data = await res.json();
      setEventoDetalle(data);
    } catch {
      setEventoDetalle({ ...ev, asistencias: [] });
    } finally {
      setCargandoDetalle(false);
    }
  };

  const labelTipoEv = (ev) => {
    const base = labelEvento(ev.tipo);
    return ev.tipo === "evento_especial" && ev.nombre_evento
      ? `${base}: ${ev.nombre_evento}`
      : base;
  };

  const formatFecha = (f) =>
    f ? f.split("T")[0].split("-").reverse().join("/") : "—";

  // ── Vista detalle ──────────────────────────────────────────────────────────
  if (eventoDetalle) {
    const totalAsistencias = eventoDetalle.asistencias
      ? eventoDetalle.asistencias.reduce((acc, s) => acc + (s.registros || []).filter(r => r.presente).length, 0)
      : 0;

    return (
      <div className="bg-white rounded-xl shadow p-6 space-y-5">
        <button
          onClick={() => setEventoDetalle(null)}
          className="flex items-center gap-2 text-sm text-cyan-600 hover:text-cyan-800 font-semibold transition"
        >
          ← Atrás
        </button>

        {/* Cabecera evento */}
        <div className="border-b pb-4 space-y-1">
          <h2 className="text-2xl font-bold text-gray-900">{labelTipoEv(eventoDetalle)}</h2>
          <p className="text-sm text-gray-500">
            Fecha: <span className="font-medium text-gray-700">{formatFecha(eventoDetalle.fecha)}</span>
          </p>
          {eventoDetalle.creado_por && (
            <p className="text-sm text-gray-500">
              Ingresado por: <span className="font-medium text-gray-700">{eventoDetalle.creado_por}</span>
            </p>
          )}
          {eventoDetalle.updated_at && eventoDetalle.updated_at !== eventoDetalle.created_at && (
            <p className="text-xs text-gray-400">
              Última modificación: {new Date(eventoDetalle.updated_at).toLocaleString("es-CL")}
            </p>
          )}
        </div>

        {/* Descripción */}
        <div>
          <h3 className="text-sm font-semibold text-gray-600 uppercase tracking-wide mb-2">
            Descripción
          </h3>
          {eventoDetalle.descripcion ? (
            <p className="text-gray-800 whitespace-pre-wrap leading-relaxed">
              {eventoDetalle.descripcion}
            </p>
          ) : (
            <p className="text-gray-400 italic">Sin descripción registrada.</p>
          )}
        </div>

        {/* Asistencia vinculada */}
        <div className="border-t pt-5">
          <h3 className="text-sm font-semibold text-gray-600 uppercase tracking-wide mb-3">
            Asistencia vinculada
          </h3>

          {cargandoDetalle ? (
            <div className="flex items-center gap-2 text-gray-400 text-sm">
              <span className="animate-spin inline-block w-4 h-4 border-2 border-gray-300 border-t-gray-600 rounded-full" />
              Cargando asistencia...
            </div>
          ) : !eventoDetalle.asistencias || eventoDetalle.asistencias.length === 0 ? (
            <p className="text-gray-400 text-sm italic">
              No hay registros de asistencia vinculados a este evento.
            </p>
          ) : (
            eventoDetalle.asistencias.map((sesion) => {
              const sortApellido = (a, b) =>
                (a.apellido || a.nombre_visitante || "").localeCompare(b.apellido || b.nombre_visitante || "", "es");
              const presentes  = (sesion.registros || []).filter(r => r.presente).sort(sortApellido);
              const ausentes   = (sesion.registros || []).filter(r => !r.presente).sort(sortApellido);
              const visitantes = presentes.filter(r => !r.nombre);

              const nombrePersona = (r) =>
                r.nombre && r.apellido
                  ? `${r.nombre} ${r.apellido}`
                  : r.nombre_visitante || "(Sin nombre)";

              return (
                <div key={sesion.id} className="mb-5">
                  <div className="flex items-center justify-between mb-2">
                    <p className="text-sm font-medium text-gray-700">
                      {formatFecha(sesion.fecha)}
                      {sesion.nombre_evento && (
                        <span className="ml-1 text-gray-500">— {sesion.nombre_evento}</span>
                      )}
                    </p>
                    <span className="text-sm bg-green-100 text-green-700 px-2 py-0.5 rounded-full font-semibold">
                      {presentes.length} presente{presentes.length !== 1 ? "s" : ""}
                      {" / "}
                      {(sesion.registros || []).length} total
                    </span>
                  </div>

                  {/* Presentes */}
                  {presentes.length > 0 && (
                    <div className="mb-2">
                      <p className="text-xs text-green-600 font-semibold uppercase tracking-wide mb-1">
                        Presentes ({presentes.length})
                      </p>
                      <div className="grid grid-cols-2 sm:grid-cols-3 gap-x-4 gap-y-0.5">
                        {presentes.map((r, i) => (
                          <p key={i} className="text-sm text-gray-800">
                            {nombrePersona(r)}
                            {!r.nombre && (
                              <span className="ml-1 text-xs text-blue-500">(visitante)</span>
                            )}
                          </p>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Ausentes */}
                  {ausentes.length > 0 && (
                    <div>
                      <p className="text-xs text-gray-400 font-semibold uppercase tracking-wide mb-1">
                        Ausentes ({ausentes.length})
                      </p>
                      <div className="grid grid-cols-2 sm:grid-cols-3 gap-x-4 gap-y-0.5">
                        {ausentes.map((r, i) => (
                          <p key={i} className="text-sm text-gray-400">{nombrePersona(r)}</p>
                        ))}
                      </div>
                    </div>
                  )}

                  {visitantes.length > 0 && (
                    <p className="text-xs text-gray-400 mt-1 italic">
                      * Incluye {visitantes.length} visitante(s) externo(s)
                    </p>
                  )}
                </div>
              );
            })
          )}
        </div>

        <button
          onClick={() => setEventoDetalle(null)}
          className="bg-gray-200 hover:bg-gray-300 text-gray-700 font-semibold px-5 py-2 rounded-lg transition"
        >
          ← Volver a la lista
        </button>
      </div>
    );
  }

  // ── Vista tabla ────────────────────────────────────────────────────────────
  return (
    <div className="bg-white rounded-xl shadow p-6 space-y-5">
      <h2 className="text-xl font-bold text-gray-800">Todos los eventos registrados</h2>

      <div className="flex flex-wrap gap-3 items-end">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Mes</label>
          <input
            type="month"
            value={mesPicker}
            onChange={e => setMesPicker(e.target.value)}
            className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-cyan-500"
          />
        </div>
        <button
          onClick={() => buscar(mesPicker)}
          disabled={cargando}
          className="bg-cyan-600 hover:bg-cyan-700 disabled:opacity-60 text-white font-semibold px-5 py-2 rounded-lg transition"
        >
          {cargando ? "Cargando..." : "Buscar"}
        </button>
      </div>

      {buscado && !cargando && (
        eventos.length === 0 ? (
          <p className="text-gray-500 text-sm">No hay eventos registrados en ese mes.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm border-collapse">
              <thead>
                <tr className="bg-gray-100 text-gray-600 text-xs uppercase">
                  <th className="text-left px-3 py-2 w-10">#</th>
                  <th className="text-left px-3 py-2">Fecha</th>
                  <th className="text-left px-3 py-2">Tipo / Nombre</th>
                  <th className="text-left px-3 py-2">Descripción</th>
                  <th className="text-left px-3 py-2">Ingresado por</th>
                </tr>
              </thead>
              <tbody>
                {eventos.map((ev, idx) => (
                  <tr
                    key={ev.id}
                    onClick={() => abrirDetalle(ev)}
                    className={`cursor-pointer transition-colors ${
                      idx % 2 === 0 ? "bg-white" : "bg-gray-50"
                    } hover:bg-cyan-50`}
                  >
                    <td className="px-3 py-2 text-gray-400">{idx + 1}</td>
                    <td className="px-3 py-2 whitespace-nowrap">{formatFecha(ev.fecha)}</td>
                    <td className="px-3 py-2 font-medium text-cyan-700 hover:underline underline-offset-2">
                      {labelTipoEv(ev)}
                    </td>
                    <td className="px-3 py-2 text-gray-600 max-w-xs">
                      {ev.descripcion
                        ? <span className="line-clamp-2">{ev.descripcion}</span>
                        : <span className="text-gray-300 italic">Sin descripción</span>
                      }
                    </td>
                    <td className="px-3 py-2 text-gray-400 text-xs">{ev.creado_por || "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <p className="text-xs text-gray-400 mt-2">
              {eventos.length} evento(s) — haz clic en una fila para ver el detalle completo
            </p>
          </div>
        )
      )}
    </div>
  );
}

// ─── Sub-componente: Selector de anotaciones (cumpleaños, presentaciones, declaración de fe) ──
function AnotacionesSelector({ anotaciones, setAnotaciones, getToken, miembros }) {
  const TIPOS_ANOT = [
    { value: "cumpleanos",      label: "Cumpleaños" },
    { value: "presentacion",    label: "Presentación" },
    { value: "declaracion_fe",  label: "Declaración de Fe" },
  ];

  const [activos, setActivos] = useState({ cumpleanos: false, presentacion: false, declaracion_fe: false });
  const [busqueda, setBusqueda] = useState({ cumpleanos: "", presentacion: "", declaracion_fe: "" });
  const [sugerencias, setSugerencias] = useState({ cumpleanos: [], presentacion: [], declaracion_fe: [] });

  const buscarMiembro = (tipo, texto) => {
    setBusqueda(b => ({ ...b, [tipo]: texto }));
    if (!texto.trim()) { setSugerencias(s => ({ ...s, [tipo]: [] })); return; }
    const q = texto.toLowerCase();
    const found = miembros.filter(m =>
      `${m.nombre} ${m.apellido}`.toLowerCase().includes(q)
    ).slice(0, 6);
    setSugerencias(s => ({ ...s, [tipo]: found }));
  };

  const agregarMiembro = (tipo, m) => {
    // Evitar duplicados
    if (anotaciones.some(a => a.tipo === tipo && a.miembro_id === m.id)) return;
    setAnotaciones(prev => [...prev, { tipo, miembro_id: m.id, nombre: `${m.nombre} ${m.apellido}`, foto_url: m.foto_url }]);
    setBusqueda(b => ({ ...b, [tipo]: "" }));
    setSugerencias(s => ({ ...s, [tipo]: [] }));
  };

  const agregarLibre = (tipo, nombre) => {
    if (!nombre.trim()) return;
    setAnotaciones(prev => [...prev, { tipo, miembro_id: null, nombre: nombre.trim() }]);
    setBusqueda(b => ({ ...b, [tipo]: "" }));
    setSugerencias(s => ({ ...s, [tipo]: [] }));
  };

  const quitar = (idx) => setAnotaciones(prev => prev.filter((_, i) => i !== idx));

  return (
    <div className="border border-indigo-100 rounded-xl p-4 space-y-4 bg-indigo-50/40">
      <p className="text-sm font-semibold text-indigo-700">Anotaciones del culto</p>

      {TIPOS_ANOT.map(({ value, label }) => (
        <div key={value} className="space-y-2">
          <label className="flex items-center gap-2 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={activos[value]}
              onChange={e => setActivos(a => ({ ...a, [value]: e.target.checked }))}
              className="rounded accent-indigo-600"
            />
            <span className="text-sm font-medium text-gray-700">{label}</span>
          </label>

          {activos[value] && (
            <div className="ml-6 space-y-2">
              {/* Chips agregados */}
              {anotaciones.filter(a => a.tipo === value).length > 0 && (
                <div className="flex flex-wrap gap-2">
                  {anotaciones.filter(a => a.tipo === value).map((a, idx) => {
                    const realIdx = anotaciones.indexOf(a);
                    return (
                      <span key={idx} className="flex items-center gap-1 bg-indigo-100 text-indigo-800 text-xs px-2 py-1 rounded-full">
                        {a.foto_url && (
                          <img src={a.foto_url} alt="" className="w-4 h-4 rounded-full object-cover" />
                        )}
                        {a.nombre}
                        {!a.miembro_id && <span className="text-indigo-400 italic">(nuevo)</span>}
                        <button onClick={() => quitar(realIdx)} className="ml-1 text-indigo-400 hover:text-red-500 font-bold">×</button>
                      </span>
                    );
                  })}
                </div>
              )}
              {/* Input búsqueda */}
              <div className="relative">
                <input
                  type="text"
                  value={busqueda[value]}
                  onChange={e => buscarMiembro(value, e.target.value)}
                  placeholder="Buscar miembro o escribir nombre..."
                  className="w-full border border-gray-300 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400"
                />
                {sugerencias[value].length > 0 && (
                  <ul className="absolute z-10 left-0 right-0 bg-white border border-gray-200 rounded-lg shadow-lg mt-1 max-h-40 overflow-y-auto">
                    {sugerencias[value].map(m => (
                      <li
                        key={m.id}
                        onClick={() => agregarMiembro(value, m)}
                        className="flex items-center gap-2 px-3 py-2 hover:bg-indigo-50 cursor-pointer text-sm"
                      >
                        {m.foto_url
                          ? <img src={m.foto_url} alt="" className="w-6 h-6 rounded-full object-cover" />
                          : <div className="w-6 h-6 rounded-full bg-gray-200 flex items-center justify-center text-xs font-bold text-gray-500">{m.nombre[0]}</div>
                        }
                        {m.nombre} {m.apellido}
                      </li>
                    ))}
                    {/* Opción agregar como nuevo */}
                    {busqueda[value].trim() && (
                      <li
                        onClick={() => agregarLibre(value, busqueda[value])}
                        className="px-3 py-2 hover:bg-yellow-50 cursor-pointer text-sm text-yellow-700 border-t border-gray-100"
                      >
                        ＋ Agregar "{busqueda[value].trim()}" como nuevo miembro (editar después)
                      </li>
                    )}
                  </ul>
                )}
                {busqueda[value].trim() && sugerencias[value].length === 0 && (
                  <button
                    type="button"
                    onClick={() => agregarLibre(value, busqueda[value])}
                    className="mt-1 text-xs text-yellow-700 underline"
                  >
                    ＋ Agregar "{busqueda[value].trim()}" como nombre libre (nuevo miembro)
                  </button>
                )}
              </div>
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

// ─── Sección: Ingresar nuevo evento ───────────────────────────────────────────
function IngresoEvento({ getToken }) {
  const [tipo, setTipo] = useState("");
  const [nombreEvento, setNombreEvento] = useState("");
  const [fecha, setFecha] = useState("");
  const [horaInicio, setHoraInicio] = useState("");
  const [horaFin, setHoraFin] = useState("");
  const [descripcion, setDescripcion] = useState("");
  const [anotaciones, setAnotaciones] = useState([]);
  const [miembros, setMiembros] = useState([]);
  const [guardando, setGuardando] = useState(false);
  const [mensaje, setMensaje] = useState(null);

  const hoy = new Date().toISOString().split("T")[0];
  const mostrarAnotaciones = tipo === "culto_jueves" || tipo === "culto_domingo";

  // Cargar miembros cuando se selecciona un culto
  useEffect(() => {
    if (!mostrarAnotaciones) { setAnotaciones([]); return; }
    if (miembros.length > 0) return;
    fetch(`${API}/api/miembros`, { headers: { Authorization: `Bearer ${getToken()}` } })
      .then(r => r.json())
      .then(data => setMiembros(Array.isArray(data) ? data.filter(m => m.estado === "activo") : []))
      .catch(() => {});
  }, [mostrarAnotaciones, getToken]); // eslint-disable-line

  const guardar = async () => {
    if (!tipo || !fecha) {
      setMensaje({ tipo: "error", texto: "Selecciona el tipo de evento y la fecha." });
      return;
    }
    if (tipo === "evento_especial" && !nombreEvento.trim()) {
      setMensaje({ tipo: "error", texto: "Ingresa el nombre del evento especial." });
      return;
    }
    setGuardando(true);
    setMensaje(null);
    try {
      const res = await fetch(`${API}/api/secretaria/eventos`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${getToken()}`,
        },
        body: JSON.stringify({
          tipo,
          nombre_evento: tipo === "evento_especial" ? nombreEvento.trim() : null,
          fecha,
          descripcion,
          hora_inicio: horaInicio || null,
          hora_fin: horaFin || null,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Error al guardar");

      // Guardar anotaciones vinculadas al evento creado
      if (anotaciones.length > 0) {
        await Promise.all(anotaciones.map(a =>
          fetch(`${API}/api/secretaria/anotaciones`, {
            method: "POST",
            headers: { "Content-Type": "application/json", Authorization: `Bearer ${getToken()}` },
            body: JSON.stringify({
              evento_id: data.id,
              fecha,
              tipo: a.tipo,
              miembro_id: a.miembro_id || null,
              nombre_libre: a.miembro_id ? null : a.nombre,
            }),
          })
        ));
      }

      setMensaje({ tipo: "ok", texto: "Evento ingresado correctamente." });
      setTipo("");
      setNombreEvento("");
      setFecha("");
      setHoraInicio("");
      setHoraFin("");
      setDescripcion("");
      setAnotaciones([]);
    } catch (e) {
      setMensaje({ tipo: "error", texto: e.message });
    } finally {
      setGuardando(false);
    }
  };

  return (
    <div className="bg-white rounded-xl shadow p-6 space-y-5">
      <h2 className="text-xl font-bold text-gray-800">Ingresar nuevo evento</h2>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Tipo de evento</label>
        <select
          value={tipo}
          onChange={e => { setTipo(e.target.value); setNombreEvento(""); }}
          className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-cyan-500"
        >
          <option value="">— Selecciona —</option>
          {TIPOS_EVENTO.map(t => (
            <option key={t.value} value={t.value}>{t.label}</option>
          ))}
        </select>
      </div>

      {tipo === "evento_especial" && (
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Nombre del evento</label>
          <input
            type="text"
            value={nombreEvento}
            onChange={e => setNombreEvento(e.target.value)}
            placeholder="Ej: Aniversario de la iglesia"
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-cyan-500"
          />
        </div>
      )}

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Fecha</label>
        <input
          type="date"
          value={fecha}
          max={hoy}
          onChange={e => setFecha(e.target.value)}
          className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-cyan-500"
        />
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Hora inicio <span className="text-gray-400 font-normal">(opcional)</span></label>
          <input
            type="time"
            value={horaInicio}
            onChange={e => setHoraInicio(e.target.value)}
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-cyan-500"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Hora fin <span className="text-gray-400 font-normal">(opcional)</span></label>
          <input
            type="time"
            value={horaFin}
            onChange={e => setHoraFin(e.target.value)}
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-cyan-500"
          />
        </div>
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Descripción</label>
        <textarea
          value={descripcion}
          onChange={e => setDescripcion(e.target.value)}
          rows={4}
          placeholder="Describe el evento..."
          className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-cyan-500 resize-none"
        />
      </div>

      {mostrarAnotaciones && (
        <AnotacionesSelector
          anotaciones={anotaciones}
          setAnotaciones={setAnotaciones}
          getToken={getToken}
          miembros={miembros}
        />
      )}

      {mensaje && (
        <p className={`text-sm font-medium ${mensaje.tipo === "ok" ? "text-green-600" : "text-red-600"}`}>
          {mensaje.texto}
        </p>
      )}

      <button
        onClick={guardar}
        disabled={guardando}
        className="bg-cyan-600 hover:bg-cyan-700 disabled:opacity-60 text-white font-semibold px-6 py-2 rounded-lg transition"
      >
        {guardando ? "Guardando..." : "Guardar evento"}
      </button>
    </div>
  );
}

// ─── Sección: Modificar evento ────────────────────────────────────────────────
function ModificarEvento({ getToken }) {
  const hoy = new Date().toISOString().split("T")[0];
  const unMesAtras = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split("T")[0];

  const [desde, setDesde] = useState(unMesAtras);
  const [hasta, setHasta] = useState(hoy);
  const [eventos, setEventos] = useState([]);
  const [cargando, setCargando] = useState(false);
  const [editando, setEditando] = useState(null);
  const [form, setForm] = useState({ tipo: "", nombre_evento: "", fecha: "", hora_inicio: "", hora_fin: "", descripcion: "" });
  const [guardando, setGuardando] = useState(false);
  const [mensaje, setMensaje] = useState(null);
  const [buscado, setBuscado] = useState(false);
  const [anotaciones, setAnotaciones] = useState([]);
  const [anotacionesOriginales, setAnotacionesOriginales] = useState([]);
  const [miembros, setMiembros] = useState([]);

  const buscar = async () => {
    if (!desde || !hasta) return;
    setCargando(true);
    setBuscado(true);
    setEditando(null);
    setMensaje(null);
    try {
      const res = await fetch(`${API}/api/secretaria/eventos?desde=${desde}&hasta=${hasta}`, {
        headers: { Authorization: `Bearer ${getToken()}` },
      });
      const data = await res.json();
      setEventos(Array.isArray(data) ? data : []);
    } catch {
      setEventos([]);
    } finally {
      setCargando(false);
    }
  };

  const abrirEditar = (ev) => {
    setEditando(ev.id);
    setForm({
      tipo: ev.tipo,
      nombre_evento: ev.nombre_evento || "",
      fecha: ev.fecha.split("T")[0],
      hora_inicio: ev.hora_inicio ? ev.hora_inicio.slice(0, 5) : "",
      hora_fin: ev.hora_fin ? ev.hora_fin.slice(0, 5) : "",
      descripcion: ev.descripcion || "",
    });
    setMensaje(null);
    setAnotaciones([]);
    setAnotacionesOriginales([]);
    // Cargar anotaciones y miembros si es culto
    if (ev.tipo === "culto_domingo" || ev.tipo === "culto_jueves") {
      fetch(`${API}/api/secretaria/anotaciones/evento/${ev.id}`, {
        headers: { Authorization: `Bearer ${getToken()}` },
      })
        .then(r => r.json())
        .then(data => {
          if (Array.isArray(data)) {
            const mapped = data.map(a => ({
              id: a.id,
              tipo: a.tipo,
              miembro_id: a.miembro_id,
              nombre: a.miembro_id
                ? `${a.miembro_nombre || ""} ${a.miembro_apellido || ""}`.trim()
                : a.nombre_libre,
              foto_url: a.foto_url || null,
            }));
            setAnotaciones(mapped);
            setAnotacionesOriginales(mapped);
          }
        })
        .catch(() => {});
      if (miembros.length === 0) {
        fetch(`${API}/api/miembros`, { headers: { Authorization: `Bearer ${getToken()}` } })
          .then(r => r.json())
          .then(data => setMiembros(Array.isArray(data) ? data.filter(m => m.estado === "activo") : []))
          .catch(() => {});
      }
    }
  };

  const guardar = async () => {
    if (!form.tipo || !form.fecha) {
      setMensaje({ tipo: "error", texto: "Tipo y fecha son requeridos." });
      return;
    }
    if (form.tipo === "evento_especial" && !form.nombre_evento.trim()) {
      setMensaje({ tipo: "error", texto: "Ingresa el nombre del evento especial." });
      return;
    }
    setGuardando(true);
    setMensaje(null);
    try {
      const res = await fetch(`${API}/api/secretaria/eventos/${editando}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${getToken()}`,
        },
        body: JSON.stringify({
          ...form,
          nombre_evento: form.tipo === "evento_especial" ? form.nombre_evento.trim() : null,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Error al actualizar");

      // Sincronizar anotaciones: eliminar las removidas, agregar las nuevas
      const eliminar_ids = anotacionesOriginales
        .filter(o => !anotaciones.some(a => a.id === o.id))
        .map(o => o.id);
      const nuevas = anotaciones.filter(a => !a.id);

      await Promise.all([
        ...eliminar_ids.map(id =>
          fetch(`${API}/api/secretaria/anotaciones/${id}`, {
            method: "DELETE",
            headers: { Authorization: `Bearer ${getToken()}` },
          })
        ),
        ...nuevas.map(a =>
          fetch(`${API}/api/secretaria/anotaciones`, {
            method: "POST",
            headers: { "Content-Type": "application/json", Authorization: `Bearer ${getToken()}` },
            body: JSON.stringify({
              evento_id: editando,
              fecha: form.fecha,
              tipo: a.tipo,
              miembro_id: a.miembro_id || null,
              nombre_libre: a.miembro_id ? null : a.nombre,
            }),
          })
        ),
      ]);

      setMensaje({ tipo: "ok", texto: "Evento actualizado." });
      setEditando(null);
      buscar();
    } catch (e) {
      setMensaje({ tipo: "error", texto: e.message });
    } finally {
      setGuardando(false);
    }
  };

  const eliminar = async (id) => {
    if (!window.confirm("¿Eliminar este evento?")) return;
    try {
      await fetch(`${API}/api/secretaria/eventos/${id}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${getToken()}` },
      });
      setEventos(prev => prev.filter(e => e.id !== id));
      if (editando === id) setEditando(null);
    } catch {
      alert("Error al eliminar");
    }
  };

  const labelTipo = (v) => TIPOS_EVENTO.find(t => t.value === v)?.label || v;

  return (
    <div className="bg-white rounded-xl shadow p-6 space-y-5">
      <h2 className="text-xl font-bold text-gray-800">Modificar evento</h2>

      {/* Rango de fechas */}
      <div className="flex flex-wrap gap-4 items-end">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Desde</label>
          <input
            type="date"
            value={desde}
            onChange={e => setDesde(e.target.value)}
            className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-cyan-500"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Hasta</label>
          <input
            type="date"
            value={hasta}
            onChange={e => setHasta(e.target.value)}
            className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-cyan-500"
          />
        </div>
        <button
          onClick={buscar}
          disabled={cargando}
          className="bg-cyan-600 hover:bg-cyan-700 disabled:opacity-60 text-white font-semibold px-5 py-2 rounded-lg transition"
        >
          {cargando ? "Buscando..." : "Buscar"}
        </button>
      </div>

      {/* Lista */}
      {buscado && !cargando && (
        <div className="space-y-2">
          {eventos.length === 0 ? (
            <p className="text-gray-500 text-sm">No hay eventos en ese rango.</p>
          ) : (
            eventos.map(ev => (
              <div
                key={ev.id}
                className={`border rounded-lg p-3 cursor-pointer transition ${
                  editando === ev.id ? "border-cyan-500 bg-cyan-50" : "border-gray-200 hover:border-cyan-300"
                }`}
                onClick={() => abrirEditar(ev)}
              >
                <div className="flex justify-between items-center">
                  <div>
                    <span className="font-medium text-gray-800">
                      {labelTipo(ev.tipo)}
                      {ev.tipo === "evento_especial" && ev.nombre_evento && (
                        <span className="text-gray-500 font-normal"> — {ev.nombre_evento}</span>
                      )}
                    </span>
                    <span className="text-gray-500 text-sm ml-3">{ev.fecha.split("T")[0]}</span>
                  </div>
                  <button
                    onClick={e => { e.stopPropagation(); eliminar(ev.id); }}
                    className="text-red-500 hover:text-red-700 text-xs font-semibold px-2 py-1 rounded"
                  >
                    Eliminar
                  </button>
                </div>
                {ev.descripcion && (
                  <p className="text-gray-500 text-xs mt-1 truncate">{ev.descripcion}</p>
                )}
              </div>
            ))
          )}
        </div>
      )}

      {/* Formulario de edición */}
      {editando && (
        <div className="border-t pt-5 space-y-4">
          <h3 className="font-semibold text-gray-700">Editando evento</h3>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Tipo</label>
            <select
              value={form.tipo}
              onChange={e => setForm(f => ({ ...f, tipo: e.target.value }))}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-cyan-500"
            >
              {TIPOS_EVENTO.map(t => (
                <option key={t.value} value={t.value}>{t.label}</option>
              ))}
            </select>
          </div>

          {form.tipo === "evento_especial" && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Nombre del evento</label>
              <input
                type="text"
                value={form.nombre_evento}
                onChange={e => setForm(f => ({ ...f, nombre_evento: e.target.value }))}
                placeholder="Ej: Aniversario de la iglesia"
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-cyan-500"
              />
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Fecha</label>
            <input
              type="date"
              value={form.fecha}
              onChange={e => setForm(f => ({ ...f, fecha: e.target.value }))}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-cyan-500"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Hora inicio <span className="text-gray-400 font-normal">(opcional)</span></label>
              <input
                type="time"
                value={form.hora_inicio}
                onChange={e => setForm(f => ({ ...f, hora_inicio: e.target.value }))}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-cyan-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Hora fin <span className="text-gray-400 font-normal">(opcional)</span></label>
              <input
                type="time"
                value={form.hora_fin}
                onChange={e => setForm(f => ({ ...f, hora_fin: e.target.value }))}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-cyan-500"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Descripción</label>
            <textarea
              value={form.descripcion}
              onChange={e => setForm(f => ({ ...f, descripcion: e.target.value }))}
              rows={4}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-cyan-500 resize-none"
            />
          </div>

          {(form.tipo === "culto_domingo" || form.tipo === "culto_jueves") && (
            <AnotacionesSelector
              anotaciones={anotaciones}
              setAnotaciones={setAnotaciones}
              getToken={getToken}
              miembros={miembros}
            />
          )}

          {mensaje && (
            <p className={`text-sm font-medium ${mensaje.tipo === "ok" ? "text-green-600" : "text-red-600"}`}>
              {mensaje.texto}
            </p>
          )}

          <div className="flex gap-3">
            <button
              onClick={guardar}
              disabled={guardando}
              className="bg-cyan-600 hover:bg-cyan-700 disabled:opacity-60 text-white font-semibold px-5 py-2 rounded-lg transition"
            >
              {guardando ? "Guardando..." : "Guardar cambios"}
            </button>
            <button
              onClick={() => { setEditando(null); setMensaje(null); }}
              className="bg-gray-200 hover:bg-gray-300 text-gray-700 font-semibold px-5 py-2 rounded-lg transition"
            >
              Cancelar
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Sección: Asistencia ──────────────────────────────────────────────────────
function RegistroAsistencia({ getToken }) {
  const hoy = new Date().toISOString().split("T")[0];

  const [vistaModificar, setVistaModificar] = useState(false);

  // Paso 1: configuración
  const [fecha, setFecha] = useState(hoy);
  const [tipoEvento, setTipoEvento] = useState("");
  const [nombreEvento, setNombreEvento] = useState("");
  const [paso, setPaso] = useState(1); // 1 = configurar, 2 = marcar asistencia

  // Paso 2: miembros y asistencia
  const [miembros, setMiembros] = useState([]);
  const [cargandoMiembros, setCargandoMiembros] = useState(false);
  const [presentes, setPresentes] = useState(new Set()); // Set de miembro_id (numbers)

  // Visitantes adicionales
  const [visitantes, setVisitantes] = useState([]);
  const [nuevoVisitante, setNuevoVisitante] = useState("");
  const [registrarComoMiembro, setRegistrarComoMiembro] = useState(false);

  const [guardando, setGuardando] = useState(false);
  const [mensaje, setMensaje] = useState(null);

  const cargarMiembros = useCallback(async () => {
    setCargandoMiembros(true);
    try {
      const res = await fetch(`${API}/api/miembros`, {
        headers: { Authorization: `Bearer ${getToken()}` },
      });
      const data = await res.json();
      const activos = Array.isArray(data)
        ? data.filter(m => m.estado === "activo")
        : [];
      setMiembros(activos);
    } catch {
      setMiembros([]);
    } finally {
      setCargandoMiembros(false);
    }
  }, [getToken]);

  const irAPaso2 = () => {
    if (!fecha || !tipoEvento) {
      setMensaje({ tipo: "error", texto: "Selecciona fecha y tipo de evento." });
      return;
    }
    if (tipoEvento === "evento_especial" && !nombreEvento.trim()) {
      setMensaje({ tipo: "error", texto: "Ingresa el nombre del evento especial." });
      return;
    }
    setMensaje(null);
    setPaso(2);
    cargarMiembros();
  };

  const togglePresente = (id) => {
    setPresentes(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const agregarVisitante = () => {
    if (!nuevoVisitante.trim()) return;
    setVisitantes(prev => [
      ...prev,
      { nombre: nuevoVisitante.trim(), registrar_como_miembro: registrarComoMiembro },
    ]);
    setNuevoVisitante("");
    setRegistrarComoMiembro(false);
  };

  const quitarVisitante = (idx) => {
    setVisitantes(prev => prev.filter((_, i) => i !== idx));
  };

  const guardar = async () => {
    setGuardando(true);
    setMensaje(null);

    const registrosMiembros = miembros.map(m => ({
      miembro_id: m.id,
      presente: presentes.has(m.id),
    }));

    const registrosVisitantes = visitantes.map(v => ({
      nombre_visitante: v.nombre,
      registrar_como_miembro: v.registrar_como_miembro,
      presente: true,
    }));

    try {
      const res = await fetch(`${API}/api/secretaria/asistencia`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${getToken()}`,
        },
        body: JSON.stringify({
          fecha,
          tipo_evento: tipoEvento,
          nombre_evento: tipoEvento === "evento_especial" ? nombreEvento.trim() : null,
          registros: [...registrosMiembros, ...registrosVisitantes],
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Error al guardar");
      setMensaje({ tipo: "ok", texto: `Asistencia guardada. Presentes: ${presentes.size} miembros + ${visitantes.length} visitante(s).` });
      // Resetear
      setPresentes(new Set());
      setVisitantes([]);
      setPaso(1);
      setTipoEvento("");
      setNombreEvento("");
      setFecha(hoy);
    } catch (e) {
      setMensaje({ tipo: "error", texto: e.message });
    } finally {
      setGuardando(false);
    }
  };

  // ── Vista modificar ─────────────────────────────────────────────────────
  if (vistaModificar) {
    return (
      <div className="space-y-4">
        <button
          onClick={() => setVistaModificar(false)}
          className="text-sm text-cyan-600 hover:text-cyan-800 font-semibold"
        >
          ← Volver a Registro de Asistencia
        </button>
        <ModificarAsistencia getToken={getToken} />
      </div>
    );
  }

  // ── Paso 1: Configuración ─────────────────────────────────────────────────
  if (paso === 1) {
    return (
      <div className="bg-white rounded-xl shadow p-6 space-y-5">
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-bold text-gray-800">Registro de Asistencia</h2>
          <button
            onClick={() => setVistaModificar(true)}
            className="text-sm bg-gray-100 hover:bg-gray-200 text-gray-700 font-semibold px-4 py-2 rounded-lg transition"
          >
            ✏️ Modificar asistencia registrada
          </button>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Fecha</label>
          <input
            type="date"
            value={fecha}
            onChange={e => setFecha(e.target.value)}
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-cyan-500"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Tipo de evento</label>
          <select
            value={tipoEvento}
            onChange={e => { setTipoEvento(e.target.value); setNombreEvento(""); }}
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-cyan-500"
          >
            <option value="">— Selecciona —</option>
            {TIPOS_EVENTO.map(t => (
              <option key={t.value} value={t.value}>{t.label}</option>
            ))}
          </select>
        </div>

        {tipoEvento === "evento_especial" && (
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Nombre del evento</label>
            <input
              type="text"
              value={nombreEvento}
              onChange={e => setNombreEvento(e.target.value)}
              placeholder="Ej: Aniversario de la iglesia"
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-cyan-500"
            />
          </div>
        )}

        {mensaje && (
          <p className={`text-sm font-medium ${mensaje.tipo === "ok" ? "text-green-600" : "text-red-600"}`}>
            {mensaje.texto}
          </p>
        )}

        <button
          onClick={irAPaso2}
          className="bg-cyan-600 hover:bg-cyan-700 text-white font-semibold px-6 py-2 rounded-lg transition"
        >
          Continuar →
        </button>
      </div>
    );
  }

  // ── Paso 2: Marcar asistencia ──────────────────────────────────────────────
  const labelTipoAsist = TIPOS_EVENTO.find(t => t.value === tipoEvento)?.label || tipoEvento;
  const tituloEvento = tipoEvento === "evento_especial" ? nombreEvento : labelTipoAsist;
  const totalPresentes = presentes.size;

  return (
    <div className="bg-white rounded-xl shadow p-6 space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-bold text-gray-800">Asistencia</h2>
          <p className="text-sm text-gray-500">
            {tituloEvento} — {fecha} &nbsp;·&nbsp;
            <span className="text-green-600 font-semibold">{totalPresentes} presente(s)</span>
          </p>
        </div>
        <button
          onClick={() => { setPaso(1); setMensaje(null); }}
          className="text-sm text-gray-500 hover:text-gray-700 underline"
        >
          ← Cambiar configuración
        </button>
      </div>

      {/* Grid miembros */}
      {cargandoMiembros ? (
        <div className="flex justify-center py-8">
          <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-cyan-600" />
        </div>
      ) : (
        <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 xl:grid-cols-8 gap-3">
          {miembros.map(m => {
            const presente = presentes.has(m.id);
            return (
              <button
                key={m.id}
                onClick={() => togglePresente(m.id)}
                title={`${m.nombre} ${m.apellido}`}
                className={`flex flex-col items-center gap-1 p-2 rounded-xl transition-transform hover:scale-105 focus:outline-none ${
                  presente ? "ring-2 ring-offset-1 ring-[#00ff44]" : ""
                }`}
              >
                <div
                  className={`w-14 h-14 rounded-full overflow-hidden flex-shrink-0 transition-all duration-200 ${
                    presente ? "" : "grayscale"
                  }`}
                  style={presente ? { boxShadow: "0 0 0 3px #00ff44" } : {}}
                >
                  {m.foto_url ? (
                    <img
                      src={m.foto_url}
                      alt={`${m.nombre} ${m.apellido}`}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <div className="w-full h-full bg-gray-300 flex items-center justify-center text-gray-500 text-lg font-bold">
                      {(m.nombre?.[0] || "?").toUpperCase()}
                    </div>
                  )}
                </div>
                <span className={`text-xs text-center leading-tight line-clamp-2 ${presente ? "text-green-700 font-semibold" : "text-gray-500"}`}>
                  {m.nombre} {m.apellido}
                </span>
              </button>
            );
          })}
        </div>
      )}

      {/* Agregar visitante */}
      <div className="border-t pt-5 space-y-3">
        <h3 className="font-semibold text-gray-700">Agregar asistente externo (visitante)</h3>
        <div className="flex flex-wrap gap-3 items-end">
          <div className="flex-1 min-w-[200px]">
            <label className="block text-xs text-gray-500 mb-1">Nombre completo</label>
            <input
              type="text"
              value={nuevoVisitante}
              onChange={e => setNuevoVisitante(e.target.value)}
              onKeyDown={e => e.key === "Enter" && agregarVisitante()}
              placeholder="Ej: Juan Pérez"
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-cyan-500"
            />
          </div>
          <label className="flex items-center gap-2 text-sm text-gray-600 cursor-pointer pb-2">
            <input
              type="checkbox"
              checked={registrarComoMiembro}
              onChange={e => setRegistrarComoMiembro(e.target.checked)}
              className="rounded"
            />
            Registrar como nuevo miembro
          </label>
          <button
            onClick={agregarVisitante}
            disabled={!nuevoVisitante.trim()}
            className="bg-gray-700 hover:bg-gray-800 disabled:opacity-50 text-white text-sm font-semibold px-4 py-2 rounded-lg transition"
          >
            + Agregar
          </button>
        </div>

        {visitantes.length > 0 && (
          <ul className="space-y-1">
            {visitantes.map((v, idx) => (
              <li key={idx} className="flex items-center justify-between bg-gray-50 rounded-lg px-3 py-2 text-sm">
                <span className="text-gray-800">
                  {v.nombre}
                  {v.registrar_como_miembro && (
                    <span className="ml-2 text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full">
                      Nuevo miembro
                    </span>
                  )}
                </span>
                <button
                  onClick={() => quitarVisitante(idx)}
                  className="text-red-500 hover:text-red-700 text-xs"
                >
                  ✕
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* Guardar */}
      <div className="border-t pt-5 space-y-3">
        {mensaje && (
          <p className={`text-sm font-medium ${mensaje.tipo === "ok" ? "text-green-600" : "text-red-600"}`}>
            {mensaje.texto}
          </p>
        )}
        <button
          onClick={guardar}
          disabled={guardando}
          className="bg-cyan-600 hover:bg-cyan-700 disabled:opacity-60 text-white font-semibold px-8 py-2.5 rounded-lg transition"
        >
          {guardando ? "Guardando..." : `Guardar asistencia (${totalPresentes} presentes + ${visitantes.length} visitante(s))`}
        </button>
      </div>
    </div>
  );
}

// ─── Sección: Modificar asistencia ────────────────────────────────────────────
function ModificarAsistencia({ getToken }) {
  const hoy = new Date().toISOString().split("T")[0];
  const unMesAtras = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split("T")[0];

  const [desde, setDesde] = useState(unMesAtras);
  const [hasta, setHasta] = useState(hoy);
  const [sesiones, setSesiones] = useState([]);
  const [cargando, setCargando] = useState(false);
  const [buscado, setBuscado] = useState(false);

  // Edición
  const [editando, setEditando] = useState(null); // sesión completa cargada
  const [form, setForm] = useState({ fecha: "", tipo_evento: "", nombre_evento: "" });
  const [miembros, setMiembros] = useState([]);
  const [presentes, setPresentes] = useState(new Set());
  const [visitantes, setVisitantes] = useState([]); // {id?, nombre, presente, nombre_visitante}
  const [nuevoVisitante, setNuevoVisitante] = useState("");
  const [cargandoEdicion, setCargandoEdicion] = useState(false);
  const [guardando, setGuardando] = useState(false);
  const [mensaje, setMensaje] = useState(null);

  const buscar = async () => {
    if (!desde || !hasta) return;
    setCargando(true);
    setBuscado(true);
    setEditando(null);
    setMensaje(null);
    try {
      const res = await fetch(`${API}/api/secretaria/asistencia?desde=${desde}&hasta=${hasta}`, {
        headers: { Authorization: `Bearer ${getToken()}` },
      });
      const data = await res.json();
      setSesiones(Array.isArray(data) ? data : []);
    } catch {
      setSesiones([]);
    } finally {
      setCargando(false);
    }
  };

  const abrirEditar = async (sesion) => {
    setCargandoEdicion(true);
    setMensaje(null);
    setEditando(sesion);
    setForm({
      fecha: sesion.fecha.split("T")[0],
      tipo_evento: sesion.tipo_evento,
      nombre_evento: sesion.nombre_evento || "",
    });
    try {
      // Cargar detalle con registros
      const [resSesion, resMiembros] = await Promise.all([
        fetch(`${API}/api/secretaria/asistencia/${sesion.id}`, {
          headers: { Authorization: `Bearer ${getToken()}` },
        }),
        fetch(`${API}/api/miembros`, {
          headers: { Authorization: `Bearer ${getToken()}` },
        }),
      ]);
      const detalle = await resSesion.json();
      const todosM = await resMiembros.json();
      const activos = Array.isArray(todosM) ? todosM.filter(m => m.estado === "activo") : [];
      setMiembros(activos);

      const registros = detalle.registros || [];
      const presentesSet = new Set(
        registros.filter(r => r.miembro_id && r.presente).map(r => r.miembro_id)
      );
      setPresentes(presentesSet);

      const visitas = registros
        .filter(r => !r.miembro_id)
        .map(r => ({ nombre: r.nombre_visitante || "", presente: r.presente }));
      setVisitantes(visitas);
    } catch {
      setMensaje({ tipo: "error", texto: "Error al cargar detalle de la sesión." });
    } finally {
      setCargandoEdicion(false);
    }
  };

  const togglePresente = (id) => {
    setPresentes(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const agregarVisitante = () => {
    if (!nuevoVisitante.trim()) return;
    setVisitantes(prev => [...prev, { nombre: nuevoVisitante.trim(), presente: true }]);
    setNuevoVisitante("");
  };

  const quitarVisitante = (idx) => setVisitantes(prev => prev.filter((_, i) => i !== idx));

  const guardar = async () => {
    if (!form.fecha || !form.tipo_evento) {
      setMensaje({ tipo: "error", texto: "Fecha y tipo de evento son requeridos." });
      return;
    }
    if (form.tipo_evento === "evento_especial" && !form.nombre_evento.trim()) {
      setMensaje({ tipo: "error", texto: "Ingresa el nombre del evento especial." });
      return;
    }
    setGuardando(true);
    setMensaje(null);
    const registrosMiembros = miembros.map(m => ({
      miembro_id: m.id,
      presente: presentes.has(m.id),
    }));
    const registrosVisitantes = visitantes.map(v => ({
      nombre_visitante: v.nombre,
      presente: true,
    }));
    try {
      const res = await fetch(`${API}/api/secretaria/asistencia/${editando.id}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${getToken()}`,
        },
        body: JSON.stringify({
          fecha: form.fecha,
          tipo_evento: form.tipo_evento,
          nombre_evento: form.tipo_evento === "evento_especial" ? form.nombre_evento.trim() : null,
          registros: [...registrosMiembros, ...registrosVisitantes],
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Error al guardar");
      setMensaje({ tipo: "ok", texto: "Asistencia actualizada correctamente." });
      setEditando(null);
      buscar();
    } catch (e) {
      setMensaje({ tipo: "error", texto: e.message });
    } finally {
      setGuardando(false);
    }
  };

  const labelSesion = (s) => {
    const base = TIPOS_EVENTO.find(t => t.value === s.tipo_evento)?.label || s.tipo_evento;
    return s.tipo_evento === "evento_especial" && s.nombre_evento
      ? `${base}: ${s.nombre_evento}`
      : base;
  };

  // ── Vista detalle / edición ──────────────────────────────────────────────
  if (editando) {
    return (
      <div className="bg-white rounded-xl shadow p-6 space-y-5">
        <button
          onClick={() => { setEditando(null); setMensaje(null); }}
          className="text-sm text-cyan-600 hover:text-cyan-800 font-semibold"
        >
          ← Volver al listado
        </button>
        <h2 className="text-xl font-bold text-gray-800">Editar asistencia</h2>

        {cargandoEdicion ? (
          <div className="flex justify-center py-10">
            <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-cyan-600" />
          </div>
        ) : (
          <>
            {/* Fecha y tipo */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Fecha</label>
                <input
                  type="date"
                  value={form.fecha}
                  onChange={e => setForm(f => ({ ...f, fecha: e.target.value }))}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-cyan-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Tipo de evento</label>
                <select
                  value={form.tipo_evento}
                  onChange={e => setForm(f => ({ ...f, tipo_evento: e.target.value, nombre_evento: "" }))}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-cyan-500"
                >
                  <option value="">— Selecciona —</option>
                  {TIPOS_EVENTO.map(t => (
                    <option key={t.value} value={t.value}>{t.label}</option>
                  ))}
                </select>
              </div>
            </div>

            {form.tipo_evento === "evento_especial" && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Nombre del evento</label>
                <input
                  type="text"
                  value={form.nombre_evento}
                  onChange={e => setForm(f => ({ ...f, nombre_evento: e.target.value }))}
                  placeholder="Ej: Aniversario de la iglesia"
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-cyan-500"
                />
              </div>
            )}

            {/* Grid miembros */}
            <div>
              <p className="text-sm font-semibold text-gray-600 mb-3">
                Miembros — <span className="text-green-600">{presentes.size} presentes</span>
              </p>
              <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 xl:grid-cols-8 gap-3">
                {miembros.map(m => {
                  const presente = presentes.has(m.id);
                  return (
                    <button
                      key={m.id}
                      onClick={() => togglePresente(m.id)}
                      title={`${m.nombre} ${m.apellido}`}
                      className={`flex flex-col items-center gap-1 p-2 rounded-xl transition-transform hover:scale-105 focus:outline-none ${
                        presente ? "ring-2 ring-offset-1 ring-[#00ff44]" : ""
                      }`}
                    >
                      <div
                        className={`w-14 h-14 rounded-full overflow-hidden flex-shrink-0 transition-all duration-200 ${
                          presente ? "" : "grayscale"
                        }`}
                        style={presente ? { boxShadow: "0 0 0 3px #00ff44" } : {}}
                      >
                        {m.foto_url ? (
                          <img
                            src={m.foto_url}
                            alt={`${m.nombre} ${m.apellido}`}
                            className="w-full h-full object-cover"
                          />
                        ) : (
                          <div className="w-full h-full bg-gray-300 flex items-center justify-center text-gray-500 text-lg font-bold">
                            {(m.nombre?.[0] || "?").toUpperCase()}
                          </div>
                        )}
                      </div>
                      <span className={`text-xs text-center leading-tight line-clamp-2 ${presente ? "text-green-700 font-semibold" : "text-gray-500"}`}>
                        {m.nombre} {m.apellido}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Visitantes */}
            <div className="border-t pt-4 space-y-3">
              <h3 className="font-semibold text-gray-700 text-sm">Visitantes externos</h3>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={nuevoVisitante}
                  onChange={e => setNuevoVisitante(e.target.value)}
                  onKeyDown={e => e.key === "Enter" && agregarVisitante()}
                  placeholder="Nombre del visitante"
                  className="flex-1 border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-cyan-500"
                />
                <button
                  onClick={agregarVisitante}
                  disabled={!nuevoVisitante.trim()}
                  className="bg-gray-700 hover:bg-gray-800 disabled:opacity-50 text-white text-sm font-semibold px-4 py-2 rounded-lg transition"
                >
                  + Agregar
                </button>
              </div>
              {visitantes.length > 0 && (
                <ul className="space-y-1">
                  {visitantes.map((v, idx) => (
                    <li key={idx} className="flex items-center justify-between bg-gray-50 rounded-lg px-3 py-2 text-sm">
                      <span className="text-gray-800">{v.nombre}</span>
                      <button
                        onClick={() => quitarVisitante(idx)}
                        className="text-red-500 hover:text-red-700 text-xs"
                      >
                        ✕
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            {/* Guardar */}
            <div className="border-t pt-4 space-y-3">
              {mensaje && (
                <p className={`text-sm font-medium ${mensaje.tipo === "ok" ? "text-green-600" : "text-red-600"}`}>
                  {mensaje.texto}
                </p>
              )}
              <button
                onClick={guardar}
                disabled={guardando}
                className="bg-cyan-600 hover:bg-cyan-700 disabled:opacity-60 text-white font-semibold px-6 py-2 rounded-lg transition"
              >
                {guardando ? "Guardando..." : "Guardar cambios"}
              </button>
            </div>
          </>
        )}
      </div>
    );
  }

  // ── Vista listado ────────────────────────────────────────────────────────
  return (
    <div className="bg-white rounded-xl shadow p-6 space-y-5">
      <h2 className="text-xl font-bold text-gray-800">Modificar asistencia</h2>

      <div className="flex flex-wrap gap-4 items-end">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Desde</label>
          <input
            type="date"
            value={desde}
            onChange={e => setDesde(e.target.value)}
            className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-cyan-500"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Hasta</label>
          <input
            type="date"
            value={hasta}
            onChange={e => setHasta(e.target.value)}
            className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-cyan-500"
          />
        </div>
        <button
          onClick={buscar}
          disabled={cargando}
          className="bg-cyan-600 hover:bg-cyan-700 disabled:opacity-60 text-white font-semibold px-5 py-2 rounded-lg transition"
        >
          {cargando ? "Buscando..." : "Buscar"}
        </button>
      </div>

      {buscado && !cargando && (
        <div className="space-y-2">
          {sesiones.length === 0 ? (
            <p className="text-gray-500 text-sm">No hay sesiones de asistencia en ese rango.</p>
          ) : (
            sesiones.map(s => (
              <div
                key={s.id}
                className="border border-gray-200 hover:border-cyan-400 rounded-lg p-3 flex justify-between items-center cursor-pointer transition"
                onClick={() => abrirEditar(s)}
              >
                <div>
                  <span className="font-medium text-gray-800">{labelSesion(s)}</span>
                  <span className="text-gray-500 text-sm ml-3">
                    {s.fecha.split("T")[0].split("-").reverse().join("/")}
                  </span>
                </div>
                <span className="text-xs text-cyan-600 font-semibold">Editar →</span>
              </div>
            ))
          )}
        </div>
      )}

      {mensaje && (
        <p className={`text-sm font-medium ${mensaje.tipo === "ok" ? "text-green-600" : "text-red-600"}`}>
          {mensaje.texto}
        </p>
      )}
    </div>
  );
}

// ─── Dashboard Secretaría ─────────────────────────────────────────────────────
function DashboardSecretaria({ getToken }) {
  const ahora = new Date();
  const mesActual = `${ahora.getFullYear()}-${String(ahora.getMonth() + 1).padStart(2, "0")}`;
  const [mes, setMes] = useState(mesActual);
  const [data, setData] = useState(null);
  const [cargando, setCargando] = useState(false);

  const cargar = useCallback(async (mesVal) => {
    setCargando(true);
    setData(null);
    const [anio, m] = mesVal.split("-");
    const desde = `${anio}-${m}-01`;
    const diasEnMes = new Date(parseInt(anio), parseInt(m), 0).getDate();
    const hasta = `${anio}-${m}-${String(diasEnMes).padStart(2, "0")}`;
    try {
      const res = await fetch(`${API}/api/secretaria/dashboard?desde=${desde}&hasta=${hasta}`, {
        headers: { Authorization: `Bearer ${getToken()}` },
      });
      const json = await res.json();
      setData(json);
    } catch {
      setData({ asistencia: [], horarios: [] });
    } finally {
      setCargando(false);
    }
  }, [getToken]);

  useEffect(() => { cargar(mesActual); }, []); // eslint-disable-line

  const mesNombre = MESES_ES[parseInt(mes.split("-")[1]) - 1];
  const anio = mes.split("-")[0];

  const fmtMin = (min) => {
    if (min == null) return "—";
    const h = Math.floor(min / 60);
    const m = min % 60;
    return h > 0 ? `${h}h ${m > 0 ? m + "min" : ""}`.trim() : `${m}min`;
  };

  // Separar eventos_especiales del resto
  const asistNormal   = data?.asistencia.filter(r => r.tipo_evento !== "evento_especial") || [];
  const asistEspecial = data?.asistencia.filter(r => r.tipo_evento === "evento_especial") || [];
  const horNormal     = data?.horarios.filter(r => r.tipo !== "evento_especial") || [];
  const horEspecial   = data?.horarios.filter(r => r.tipo === "evento_especial") || [];

  return (
    <div className="space-y-6">
      {/* Cabecera con selector de mes */}
      <div className="flex flex-wrap items-center justify-between gap-3 bg-white rounded-xl shadow px-6 py-4">
        <div>
          <h2 className="text-lg font-bold text-gray-800">Dashboard — {mesNombre} {anio}</h2>
          <p className="text-xs text-gray-500 mt-0.5">Estadísticas de asistencia y horarios del mes</p>
        </div>
        <div className="flex items-center gap-2">
          <input
            type="month"
            value={mes}
            onChange={e => { setMes(e.target.value); cargar(e.target.value); }}
            className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-cyan-500"
          />
        </div>
      </div>

      {cargando && (
        <div className="flex justify-center py-16">
          <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-cyan-600" />
        </div>
      )}

      {!cargando && data && (
        <>
          {/* ── Asistencia por tipo de evento ─────────────────────────── */}
          <div className="bg-white rounded-xl shadow p-6">
            <h3 className="text-sm font-bold text-gray-600 uppercase tracking-wide mb-4">
              Asistencia por tipo de evento
            </h3>
            {asistNormal.length === 0 && asistEspecial.length === 0 ? (
              <p className="text-gray-400 text-sm italic">Sin registros de asistencia en este mes.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-xs text-gray-500 uppercase border-b">
                      <th className="text-left pb-2 pr-4">Tipo</th>
                      <th className="text-center pb-2 px-3">Sesiones</th>
                      <th className="text-center pb-2 px-3">Promedio</th>
                      <th className="text-center pb-2 px-3">Máximo</th>
                      <th className="text-center pb-2 px-3">Mínimo</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {asistNormal.map((r, i) => (
                      <tr key={i} className="hover:bg-gray-50">
                        <td className="py-2 pr-4 font-medium text-gray-800">
                          {TIPOS_EVENTO.find(t => t.value === r.tipo_evento)?.label || r.tipo_evento}
                        </td>
                        <td className="text-center py-2 px-3 text-gray-600">{r.sesiones}</td>
                        <td className="text-center py-2 px-3">
                          <span className="bg-cyan-100 text-cyan-800 font-semibold px-2 py-0.5 rounded-full">
                            {r.promedio_presentes}
                          </span>
                        </td>
                        <td className="text-center py-2 px-3">
                          <span className="bg-green-100 text-green-700 font-semibold px-2 py-0.5 rounded-full">
                            {r.max_presentes}
                          </span>
                        </td>
                        <td className="text-center py-2 px-3">
                          <span className="bg-red-100 text-red-700 font-semibold px-2 py-0.5 rounded-full">
                            {r.min_presentes}
                          </span>
                        </td>
                      </tr>
                    ))}
                    {asistEspecial.length > 0 && (
                      <>
                        <tr>
                          <td colSpan={5} className="pt-4 pb-1 text-xs font-bold text-gray-400 uppercase tracking-wide">
                            Eventos Especiales
                          </td>
                        </tr>
                        {asistEspecial.map((r, i) => (
                          <tr key={`esp-${i}`} className="hover:bg-gray-50">
                            <td className="py-2 pr-4 font-medium text-gray-800">
                              {r.nombre_evento || "Evento especial"}
                            </td>
                            <td className="text-center py-2 px-3 text-gray-600">{r.sesiones}</td>
                            <td className="text-center py-2 px-3">
                              <span className="bg-cyan-100 text-cyan-800 font-semibold px-2 py-0.5 rounded-full">
                                {r.promedio_presentes}
                              </span>
                            </td>
                            <td className="text-center py-2 px-3">
                              <span className="bg-green-100 text-green-700 font-semibold px-2 py-0.5 rounded-full">
                                {r.max_presentes}
                              </span>
                            </td>
                            <td className="text-center py-2 px-3">
                              <span className="bg-red-100 text-red-700 font-semibold px-2 py-0.5 rounded-full">
                                {r.min_presentes}
                              </span>
                            </td>
                          </tr>
                        ))}
                      </>
                    )}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* ── Horarios por tipo de evento ───────────────────────────── */}
          <div className="bg-white rounded-xl shadow p-6">
            <h3 className="text-sm font-bold text-gray-600 uppercase tracking-wide mb-1">
              Horarios y duración de eventos
            </h3>
            <p className="text-xs text-gray-400 mb-4">Solo eventos con hora de inicio registrada</p>
            {horNormal.length === 0 && horEspecial.length === 0 ? (
              <p className="text-gray-400 text-sm italic">Sin eventos con hora registrada en este mes.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-xs text-gray-500 border-b">
                      <th className="text-left pb-2 pr-4 font-semibold uppercase tracking-wide">Tipo</th>
                      <th className="text-center pb-2 px-2 font-semibold uppercase tracking-wide">Hora inicio<br/>promedio</th>
                      <th className="text-center pb-2 px-2 font-semibold uppercase tracking-wide">Inicio más<br/>temprano</th>
                      <th className="text-center pb-2 px-2 font-semibold uppercase tracking-wide">Término<br/>más tarde</th>
                      <th className="text-center pb-2 px-2 font-semibold uppercase tracking-wide">Duración<br/>promedio</th>
                      <th className="text-center pb-2 px-2 font-semibold uppercase tracking-wide">Mayor<br/>duración</th>
                      <th className="text-center pb-2 px-2 font-semibold uppercase tracking-wide">Menor<br/>duración</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {[...horNormal, ...(horEspecial.length > 0 ? [{ _separador: true }, ...horEspecial] : [])].map((r, i) => {
                      if (r._separador) return (
                        <tr key="sep">
                          <td colSpan={7} className="pt-4 pb-1 text-xs font-bold text-gray-400 uppercase tracking-wide">
                            Eventos Especiales
                          </td>
                        </tr>
                      );
                      const fmtFecha = (f) => f ? f.split("T")[0].split("-").reverse().slice(0, 2).join("/") : null;
                      return (
                        <tr key={i} className="hover:bg-gray-50">
                          <td className="py-3 pr-4 font-medium text-gray-800">
                            {r.tipo === "evento_especial"
                              ? (r.nombre_evento || "Evento especial")
                              : (TIPOS_EVENTO.find(t => t.value === r.tipo)?.label || r.tipo)}
                            <span className="block text-xs text-gray-400">{r.total} evento(s)</span>
                          </td>
                          {/* Hora inicio promedio */}
                          <td className="text-center py-3 px-2 font-semibold text-gray-700">
                            {r.inicio_promedio || "—"}
                          </td>
                          {/* Inicio más temprano */}
                          <td className="text-center py-3 px-2">
                            <span className="font-semibold text-gray-700">{r.inicio_mas_temprano || "—"}</span>
                            {fmtFecha(r.fecha_inicio_min) && (
                              <span className="block text-xs italic text-gray-400">{fmtFecha(r.fecha_inicio_min)}</span>
                            )}
                          </td>
                          {/* Término más tarde */}
                          <td className="text-center py-3 px-2">
                            <span className="font-semibold text-gray-700">{r.termino_mas_tarde || "—"}</span>
                            {fmtFecha(r.fecha_fin_max) && (
                              <span className="block text-xs italic text-gray-400">{fmtFecha(r.fecha_fin_max)}</span>
                            )}
                          </td>
                          {/* Duración promedio */}
                          <td className="text-center py-3 px-2">
                            {r.duracion_prom_min != null
                              ? <span className="font-semibold text-purple-700">{fmtMin(r.duracion_prom_min)}</span>
                              : <span className="text-gray-400 text-xs">Sin hora fin</span>}
                          </td>
                          {/* Mayor duración */}
                          <td className="text-center py-3 px-2">
                            {r.duracion_max_min != null ? (
                              <>
                                <span className="font-semibold text-green-700">{fmtMin(r.duracion_max_min)}</span>
                                {fmtFecha(r.fecha_dur_max) && (
                                  <span className="block text-xs italic text-gray-400">{fmtFecha(r.fecha_dur_max)}</span>
                                )}
                              </>
                            ) : <span className="text-gray-400 text-xs">—</span>}
                          </td>
                          {/* Menor duración */}
                          <td className="text-center py-3 px-2">
                            {r.duracion_min_min != null ? (
                              <>
                                <span className="font-semibold text-red-600">{fmtMin(r.duracion_min_min)}</span>
                                {fmtFecha(r.fecha_dur_min) && (
                                  <span className="block text-xs italic text-gray-400">{fmtFecha(r.fecha_dur_min)}</span>
                                )}
                              </>
                            ) : <span className="text-gray-400 text-xs">—</span>}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* ── Anotaciones Especiales ────────────────────────────────── */}
          {(() => {
            const cumpleaniosMes   = data?.cumpleanos || [];
            const cumpleanosCulto  = (data?.anotaciones || []).filter(a => a.tipo === "cumpleanos");
            const bautizos         = (data?.anotaciones || []).filter(a => a.tipo === "bautizo");
            const declaraciones    = (data?.anotaciones || []).filter(a => a.tipo === "declaracion_fe");
            const presentaciones   = (data?.anotaciones || []).filter(a => a.tipo === "presentacion");
            const nuevosMiembros   = data?.nuevosMiembros || [];

            const hayAlgo = cumpleaniosMes.length > 0 || cumpleanosCulto.length > 0
              || bautizos.length > 0 || declaraciones.length > 0
              || presentaciones.length > 0 || nuevosMiembros.length > 0;

            if (!hayAlgo) return null;

            const fmtDiaMes = (fecha) => {
              if (!fecha) return "";
              const soloFecha = String(fecha).split("T")[0];
              const d = new Date(soloFecha + "T12:00:00");
              if (isNaN(d)) return "";
              return d.toLocaleDateString("es-CL", { day: "numeric", month: "long" });
            };

            return (
              <div className="bg-white rounded-xl shadow p-6 space-y-6">
                <h3 className="text-sm font-bold text-gray-600 uppercase tracking-wide">
                  Anotaciones Especiales — {mesNombre} {anio}
                </h3>

                {/* Cumpleaños del mes (por fecha_nacimiento) */}
                {cumpleaniosMes.length > 0 && (
                  <div>
                    <p className="text-xs font-semibold text-yellow-700 uppercase tracking-wide mb-3">
                      🎂 Cumpleaños del mes
                    </p>
                    <div className="flex flex-wrap gap-3">
                      {cumpleaniosMes.map(m => (
                        <div key={m.id} className="flex items-center gap-2 bg-yellow-50 border border-yellow-100 rounded-xl px-3 py-2">
                          {m.foto_url
                            ? <img src={m.foto_url} alt="" className="w-9 h-9 rounded-full object-cover" />
                            : <div className="w-9 h-9 rounded-full bg-yellow-200 flex items-center justify-center text-sm font-bold text-yellow-700">{m.nombre[0]}</div>
                          }
                          <div>
                            <p className="text-sm font-semibold text-gray-800">{m.nombre} {m.apellido}</p>
                            <p className="text-xs text-yellow-600">{fmtDiaMes(m.fecha_nacimiento_este_anio || m.fecha_nacimiento)}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Cumpleaños celebrados en cultos */}
                {cumpleanosCulto.length > 0 && (
                  <div>
                    <p className="text-xs font-semibold text-orange-700 uppercase tracking-wide mb-3">
                      🎉 Cumpleaños celebrados en culto
                    </p>
                    <div className="flex flex-wrap gap-2">
                      {cumpleanosCulto.map((a, i) => (
                        <span key={i} className="flex items-center gap-1.5 bg-orange-50 border border-orange-100 text-sm text-gray-800 px-3 py-1.5 rounded-full">
                          {a.foto_url && <img src={a.foto_url} alt="" className="w-5 h-5 rounded-full object-cover" />}
                          {a.miembro_nombre
                            ? `${a.miembro_nombre} ${a.miembro_apellido || ""}`.trim()
                            : a.nombre_libre}
                          <span className="text-xs text-orange-400 italic ml-1">{fmtDiaMes(a.fecha)}</span>
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                {/* Presentaciones */}
                {presentaciones.length > 0 && (
                  <div>
                    <p className="text-xs font-semibold text-sky-700 uppercase tracking-wide mb-3">
                      👶 Presentaciones
                    </p>
                    <div className="flex flex-wrap gap-2">
                      {presentaciones.map((a, i) => (
                        <span key={i} className="flex items-center gap-1.5 bg-sky-50 border border-sky-100 text-sm text-gray-800 px-3 py-1.5 rounded-full">
                          {a.foto_url && <img src={a.foto_url} alt="" className="w-5 h-5 rounded-full object-cover" />}
                          {a.miembro_nombre
                            ? `${a.miembro_nombre} ${a.miembro_apellido || ""}`.trim()
                            : a.nombre_libre}
                          <span className="text-xs text-sky-400 italic ml-1">{fmtDiaMes(a.fecha)}</span>
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                {/* Declaraciones de Fe */}
                {declaraciones.length > 0 && (
                  <div>
                    <p className="text-xs font-semibold text-emerald-700 uppercase tracking-wide mb-3">
                      ✝️ Declaraciones de Fe
                    </p>
                    <div className="flex flex-wrap gap-2">
                      {declaraciones.map((a, i) => (
                        <span key={i} className="flex items-center gap-1.5 bg-emerald-50 border border-emerald-100 text-sm text-gray-800 px-3 py-1.5 rounded-full">
                          {a.foto_url && <img src={a.foto_url} alt="" className="w-5 h-5 rounded-full object-cover" />}
                          {a.miembro_nombre
                            ? `${a.miembro_nombre} ${a.miembro_apellido || ""}`.trim()
                            : a.nombre_libre}
                          <span className="text-xs text-emerald-400 italic ml-1">{fmtDiaMes(a.fecha)}</span>
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                {/* Bautizos */}
                {bautizos.length > 0 && (
                  <div>
                    <p className="text-xs font-semibold text-blue-700 uppercase tracking-wide mb-3">
                      💧 Bautizos
                    </p>
                    <div className="flex flex-wrap gap-2">
                      {bautizos.map((a, i) => (
                        <span key={i} className="flex items-center gap-1.5 bg-blue-50 border border-blue-100 text-sm text-gray-800 px-3 py-1.5 rounded-full">
                          {a.foto_url && <img src={a.foto_url} alt="" className="w-5 h-5 rounded-full object-cover" />}
                          {a.miembro_nombre
                            ? `${a.miembro_nombre} ${a.miembro_apellido || ""}`.trim()
                            : a.nombre_libre}
                          <span className="text-xs text-blue-400 italic ml-1">{fmtDiaMes(a.fecha)}</span>
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                {/* Nuevos miembros */}
                {nuevosMiembros.length > 0 && (
                  <div>
                    <p className="text-xs font-semibold text-violet-700 uppercase tracking-wide mb-3">
                      🌱 Nuevos miembros
                    </p>
                    <div className="flex flex-wrap gap-3">
                      {nuevosMiembros.map(m => (
                        <div key={m.id} className="flex items-center gap-2 bg-violet-50 border border-violet-100 rounded-xl px-3 py-2">
                          {m.foto_url
                            ? <img src={m.foto_url} alt="" className="w-9 h-9 rounded-full object-cover" />
                            : <div className="w-9 h-9 rounded-full bg-violet-200 flex items-center justify-center text-sm font-bold text-violet-700">{m.nombre[0]}</div>
                          }
                          <div>
                            <p className="text-sm font-semibold text-gray-800">{m.nombre} {m.apellido}</p>
                            <p className="text-xs text-violet-500">Ingresó el {fmtDiaMes(m.created_at?.split("T")[0])}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            );
          })()}
        </>
      )}
    </div>
  );
}

// ─── Página principal ─────────────────────────────────────────────────────────
export default function AdminSecretaria() {
  const { roles, getToken } = useAuth();
  const navigate = useNavigate();
  const [accion, setAccion] = useState("");

  const ahora = new Date();
  const mesActual = `${ahora.getFullYear()}-${String(ahora.getMonth() + 1).padStart(2, "0")}`;
  const [mesPDF, setMesPDF] = useState(mesActual);
  const [cargandoPDF, setCargandoPDF] = useState(false);

  // Control de acceso por rol
  useEffect(() => {
    if (roles.length > 0 && !roles.some(r => ROLES_SECRETARIA.includes(r))) {
      navigate("/admin");
    }
  }, [roles, navigate]);

  return (
    <>
      <AdminNav />
      <div className="p-6 max-w-5xl mx-auto space-y-6">
        {/* Barra de controles */}
        <div className="flex flex-wrap items-center gap-3">
          <h1 className="text-2xl font-bold text-gray-900">Secretaría</h1>

          <select
            value={accion}
            onChange={e => setAccion(e.target.value)}
            className="border border-gray-300 rounded-lg px-4 py-2 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-cyan-500 bg-white"
          >
            <option value="">— Selecciona una acción —</option>
            <option value="ver_eventos">Ver todos los eventos</option>
            <option value="ingresar">Ingresar nuevo evento</option>
            <option value="modificar">Modificar evento</option>
            <option value="asistencia">Asistencia</option>
          </select>

          {/* Botón Bitácora PDF */}
          <div className="flex items-center gap-2 ml-auto">
            <label className="text-sm text-gray-600 font-medium">Bitácora PDF — mes:</label>
            <input
              type="month"
              value={mesPDF}
              onChange={e => setMesPDF(e.target.value)}
              className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gray-400"
            />
            <button
              onClick={() => generarBitacoraPDF(mesPDF, getToken, setCargandoPDF)}
              disabled={cargandoPDF}
              className="bg-gray-800 hover:bg-gray-900 disabled:opacity-60 text-white text-sm font-semibold px-4 py-2 rounded-lg transition flex items-center gap-2"
            >
              {cargandoPDF
                ? <><span className="animate-spin inline-block w-4 h-4 border-2 border-white border-t-transparent rounded-full" /> Generando...</>
                : "📄 Descargar PDF"
              }
            </button>
          </div>
        </div>

        {accion === "ver_eventos" && <VerEventos getToken={getToken} />}
        {accion === "ingresar"    && <IngresoEvento getToken={getToken} />}
        {accion === "modificar"   && <ModificarEvento getToken={getToken} />}
        {accion === "asistencia"  && <RegistroAsistencia getToken={getToken} />}

        {!accion && <DashboardSecretaria getToken={getToken} />}
      </div>
    </>
  );
}
