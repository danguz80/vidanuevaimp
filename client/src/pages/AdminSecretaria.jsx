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
const labelAsistencia = (v) => TIPOS_ASISTENCIA.find(t => t.value === v)?.label || v;

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
      doc.setDrawColor(200);
      doc.setLineWidth(0.1);

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
        const rowLines  = Math.max(tipoLines.length, descLines.length, 1);
        const rowH      = rowLines * 4.5 + 3;

        checkBreak(rowH + 2);
        doc.setFontSize(8);
        doc.text(tipoLines,           colTipoX  + 1, y);
        doc.text(fechaStr,            colFechaX + 1, y);
        if (descLines.length) doc.text(descLines, colDescX + 1, y);
        y += rowH;
        doc.line(ML, y, PW - MR, y);
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
          // Ordenar: presentes primero, luego ausentes
          const sorted = [
            ...registros.filter(r => r.presente),
            ...registros.filter(r => !r.presente),
          ];

          const halfW = (CW - 6) / 2;
          doc.setFontSize(8);

          for (let i = 0; i < sorted.length; i += 2) {
            checkBreak(5);
            const r1 = sorted[i];
            const r2 = i + 1 < sorted.length ? sorted[i + 1] : null;

            const formatNombre = (r) => {
              const n = r.nombre && r.apellido
                ? `${r.apellido}, ${r.nombre}`
                : r.nombre_visitante || "(Sin nombre)";
              return `${r.presente ? "✓" : "–"}  ${n}${!r.nombre ? " (*)" : ""}`;
            };

            doc.setFont("helvetica", "normal");
            doc.setTextColor(r1.presente ? 0 : 140);
            doc.text(formatNombre(r1), ML + 2, y);

            if (r2) {
              doc.setTextColor(r2.presente ? 0 : 140);
              doc.text(formatNombre(r2), ML + 4 + halfW, y);
            }
            doc.setTextColor(0);
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

// ─── Sección: Ingresar nuevo evento ───────────────────────────────────────────
function IngresoEvento({ getToken }) {
  const [tipo, setTipo] = useState("");
  const [nombreEvento, setNombreEvento] = useState("");
  const [fecha, setFecha] = useState("");
  const [descripcion, setDescripcion] = useState("");
  const [guardando, setGuardando] = useState(false);
  const [mensaje, setMensaje] = useState(null);

  const hoy = new Date().toISOString().split("T")[0];

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
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Error al guardar");
      setMensaje({ tipo: "ok", texto: "Evento ingresado correctamente." });
      setTipo("");
      setNombreEvento("");
      setFecha("");
      setDescripcion("");
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
  const [form, setForm] = useState({ tipo: "", nombre_evento: "", fecha: "", descripcion: "" });
  const [guardando, setGuardando] = useState(false);
  const [mensaje, setMensaje] = useState(null);
  const [buscado, setBuscado] = useState(false);

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
      descripcion: ev.descripcion || "",
    });
    setMensaje(null);
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

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Descripción</label>
            <textarea
              value={form.descripcion}
              onChange={e => setForm(f => ({ ...f, descripcion: e.target.value }))}
              rows={4}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-cyan-500 resize-none"
            />
          </div>

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

  // ── Paso 1: Configuración ─────────────────────────────────────────────────
  if (paso === 1) {
    return (
      <div className="bg-white rounded-xl shadow p-6 space-y-5">
        <h2 className="text-xl font-bold text-gray-800">Registro de Asistencia</h2>

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
            {TIPOS_ASISTENCIA.map(t => (
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
  const labelTipoAsist = TIPOS_ASISTENCIA.find(t => t.value === tipoEvento)?.label || tipoEvento;
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

        {!accion && (
          <div className="bg-gray-50 border border-dashed border-gray-300 rounded-xl p-12 text-center text-gray-400">
            Selecciona una acción para comenzar
          </div>
        )}
      </div>
    </>
  );
}
