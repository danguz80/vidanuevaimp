import React, { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import AdminNav from "../components/AdminNav";
import ModalComprobante from "../components/ModalComprobante";
import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";
import { PlusCircle, Trash2, TrendingUp, TrendingDown, DollarSign, Wallet, Pencil, X, FileText, Receipt, CheckCircle, Clock } from "lucide-react";

const API = import.meta.env.VITE_BACKEND_URL;

const ROLES_TESORERIA = ["admin", "Tesorero"];

const CATEGORIAS_INGRESO = [
  { value: "ofrendas",       label: "Ofrendas" },
  { value: "cuotas_diezmos", label: "Cuotas / Diezmos" },
  { value: "cumpleanos",     label: "Cumpleaños" },
  { value: "otros",          label: "Otros" },
];

const CATEGORIAS_EGRESO = [
  { value: "gastos_comunes",          label: "Gastos comunes" },
  { value: "materiales_construccion", label: "Materiales construcción" },
  { value: "insumos",                 label: "Insumos" },
  { value: "otros",                   label: "Otros" },
];

const FMT = (n) => `$${Math.round(parseFloat(n || 0)).toLocaleString("es-CL")}`;

const mesPrevio = (mes) => {
  const [y, m] = mes.split("-").map(Number);
  if (m === 1) return `${y - 1}-12`;
  return `${y}-${String(m - 1).padStart(2, "0")}`;
};

const FORM_VACIO = { tipo: "ingreso", categoria: "", monto: "", descripcion: "", tipo_culto: "", notas: "", fecha: new Date().toISOString().split("T")[0] };

const MESES_ES = ["Enero","Febrero","Marzo","Abril","Mayo","Junio","Julio","Agosto","Septiembre","Octubre","Noviembre","Diciembre"];

async function generarTesoreriaPDF({ mesFiltro, movimientos, saldoAnterior, saldoNoData, getToken }) {
  const [anio, mes] = mesFiltro.split("-");
  const mesNombre = MESES_ES[parseInt(mes) - 1];

  const CAT_INGRESO = { ofrendas: "Ofrendas", cuotas_diezmos: "Cuotas / Diezmos", cumpleanos: "Cumplea\u00f1os", otros: "Otros" };
  const CAT_EGRESO  = { gastos_comunes: "Gastos comunes", materiales_construccion: "Materiales construcci\u00f3n", insumos: "Insumos", otros: "Otros" };
  const labelCat = (tipo, cat) => (tipo === "ingreso" ? CAT_INGRESO[cat] : CAT_EGRESO[cat]) || cat;
  const fmtFecha = (f) => f ? String(f).split("T")[0].split("-").reverse().join("/") : "\u2014";
  const fmtMonto = (n) => `$${Math.round(parseFloat(n || 0)).toLocaleString("es-CL")}`;

  const ingresos = movimientos.filter(m => m.tipo === "ingreso");
  const egresos  = movimientos.filter(m => m.tipo === "egreso");
  const totalIng = ingresos.reduce((s, m) => s + parseFloat(m.monto), 0);
  const totalEgr = egresos.reduce((s, m)  => s + parseFloat(m.monto), 0);
  const saldoPrev = saldoNoData ? 0 : (saldoAnterior ?? 0);
  const balance   = saldoPrev + totalIng - totalEgr;

  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
  const PW = doc.internal.pageSize.getWidth();
  const PH = doc.internal.pageSize.getHeight();
  const ML = 14;
  const MR = 14;
  const BOTTOM = PH - 14;
  let y = 16;

  const checkBreak = (needed = 10) => {
    if (y + needed > BOTTOM) { doc.addPage(); y = 16; }
  };

  // Encabezado
  doc.setFontSize(15);
  doc.setFont("helvetica", "bold");
  doc.text("IGLESIA VIDA NUEVA IMP", PW / 2, y, { align: "center" });
  y += 7;
  doc.setFontSize(12);
  doc.text(`BALANCE TESORER\u00cdA \u2014 ${mesNombre.toUpperCase()} ${anio}`, PW / 2, y, { align: "center" });
  y += 5;
  doc.setDrawColor(30, 80, 50);
  doc.setLineWidth(0.6);
  doc.line(ML, y, PW - MR, y);
  y += 7;

  // Resumen financiero
  doc.setFontSize(9);
  doc.setFont("helvetica", "normal");
  doc.setFillColor(240, 247, 240);
  doc.roundedRect(ML, y, PW - ML - MR, 22, 2, 2, "F");
  doc.setFont("helvetica", "bold");
  const col = (PW - ML - MR) / 4;
  const labels = [
    { t: "Saldo Anterior", v: saldoNoData ? "Sin datos" : fmtMonto(saldoPrev), c: [80, 80, 80] },
    { t: "Total Ingresos",  v: fmtMonto(totalIng),  c: [22, 101, 52] },
    { t: "Total Egresos",   v: fmtMonto(totalEgr),  c: [185, 28, 28] },
    { t: "Balance Final",   v: fmtMonto(balance),   c: balance >= 0 ? [29, 78, 216] : [194, 65, 12] },
  ];
  labels.forEach((l, i) => {
    const cx = ML + col * i + col / 2;
    doc.setFontSize(8);
    doc.setTextColor(100, 100, 100);
    doc.setFont("helvetica", "normal");
    doc.text(l.t, cx, y + 7, { align: "center" });
    doc.setFontSize(11);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(...l.c);
    doc.text(l.v, cx, y + 15, { align: "center" });
  });
  doc.setTextColor(0, 0, 0);
  y += 28;

  // Tabla de movimientos
  const rows = movimientos.map(m => {
    let desc = "\u2014";
    if (m.tipo_culto === "culto_domingo") desc = "Culto Domingo";
    else if (m.tipo_culto === "culto_jueves") desc = "Culto Jueves";
    else if (m.descripcion) desc = m.descripcion;
    return [
      fmtFecha(m.fecha),
      m.tipo === "ingreso" ? "Ingreso" : "Egreso",
      labelCat(m.tipo, m.categoria),
      desc,
      fmtMonto(m.monto),
      m.notas || "",
    ];
  });

  autoTable(doc, {
    startY: y,
    head: [["Fecha", "Tipo", "Categor\u00eda", "Descripci\u00f3n", "Monto", "Detalle"]],
    body: rows,
    margin: { left: ML, right: MR },
    styles: { fontSize: 8, cellPadding: 2.5, overflow: "linebreak" },
    headStyles: { fillColor: [30, 80, 50], textColor: 255, fontStyle: "bold", halign: "center" },
    columnStyles: {
      0: { cellWidth: 20 },
      1: { cellWidth: 22, halign: "center" },
      2: { cellWidth: 36 },
      3: { cellWidth: 34 },
      4: { cellWidth: 26, halign: "right" },
      5: { cellWidth: "auto" },
    },
    bodyStyles: { textColor: [40, 40, 40] },
    alternateRowStyles: { fillColor: [245, 250, 245] },
    didParseCell: (data) => {
      if (data.section === "body" && data.column.index === 1) {
        const v = data.cell.raw || "";
        data.cell.styles.textColor = v.includes("Ingreso") ? [22, 101, 52] : [185, 28, 28];
      }
      if (data.section === "body" && data.column.index === 4) {
        const v = data.row.raw?.[1] || "";
        data.cell.styles.textColor = v.includes("Ingreso") ? [22, 101, 52] : [185, 28, 28];
        data.cell.styles.fontStyle = "bold";
      }
    },
  });

  // Pie de página
  const totalPages = doc.getNumberOfPages();
  for (let i = 1; i <= totalPages; i++) {
    doc.setPage(i);
    doc.setFontSize(8);
    doc.setTextColor(150);
    doc.text(`P\u00e1gina ${i} de ${totalPages}`, PW / 2, PH - 8, { align: "center" });
    doc.text(`Generado el ${new Date().toLocaleDateString("es-CL")}`, PW - MR, PH - 8, { align: "right" });
    doc.setTextColor(0);
  }

  doc.save(`tesoreria-${mesNombre.toLowerCase()}-${anio}.pdf`);
}

export default function AdminTesoreria() {
  const navigate = useNavigate();
  const { roles, getToken } = useAuth();

  const tieneAcceso = roles.some(r => ROLES_TESORERIA.includes(r));

  const ahora = new Date();
  const mesActual = `${ahora.getFullYear()}-${String(ahora.getMonth() + 1).padStart(2, "0")}`;
  const [mesFiltro, setMesFiltro] = useState(mesActual);
  const [movimientos, setMovimientos] = useState([]);
  const [cargando, setCargando] = useState(false);
  const [form, setForm] = useState(FORM_VACIO);
  const [guardando, setGuardando] = useState(false);
  const [mensaje, setMensaje] = useState(null);
  const [tabActiva, setTabActiva] = useState("ingreso");
  const [saldoAnterior, setSaldoAnterior] = useState(null);
  const [saldoNoData, setSaldoNoData] = useState(false);
  const [saldoManualInput, setSaldoManualInput] = useState("");
  const [guardandoSaldo, setGuardandoSaldo] = useState(false);
  const [editandoSaldo, setEditandoSaldo] = useState(false);
  const [editando, setEditando] = useState(null);
  const [formEdit, setFormEdit] = useState(null);
  const [guardandoEdit, setGuardandoEdit] = useState(false);
  const [mensajeEdit, setMensajeEdit] = useState(null);
  const [generandoPDF, setGenerandoPDF] = useState(false);

  // Comprobantes digitales
  const [modalComprobante, setModalComprobante] = useState(false);
  const [comprobantes, setComprobantes] = useState([]);
  const [cargandoComprobantes, setCargandoComprobantes] = useState(false);
  const [comprobanteDetalle, setComprobanteDetalle] = useState(null);

  const cargarComprobantes = useCallback(async () => {
    setCargandoComprobantes(true);
    try {
      const res = await fetch(`${API}/api/tesoreria/comprobantes`, {
        headers: { Authorization: `Bearer ${getToken()}` },
      });
      const data = await res.json();
      setComprobantes(Array.isArray(data) ? data : []);
    } catch {
      setComprobantes([]);
    } finally {
      setCargandoComprobantes(false);
    }
  }, [getToken]);

  const cargar = useCallback(async (mes) => {
    setCargando(true);
    const [anio, m] = mes.split("-");
    const desde = `${anio}-${m}-01`;
    const diasEnMes = new Date(parseInt(anio), parseInt(m), 0).getDate();
    const hasta = `${anio}-${m}-${String(diasEnMes).padStart(2, "0")}`;
    try {
      const res = await fetch(`${API}/api/tesoreria?desde=${desde}&hasta=${hasta}`, {
        headers: { Authorization: `Bearer ${getToken()}` },
      });
      const data = await res.json();
      setMovimientos(Array.isArray(data) ? data : []);
    } catch {
      setMovimientos([]);
    } finally {
      setCargando(false);
    }
  }, [getToken]);

  const cargarSaldoAnterior = useCallback(async (mes) => {
    setSaldoAnterior(null);
    setSaldoNoData(false);
    setSaldoManualInput("");
    try {
      const res = await fetch(`${API}/api/tesoreria/saldo-anterior?mes=${mes}`, {
        headers: { Authorization: `Bearer ${getToken()}` },
      });
      const data = await res.json();
      if (data.noData) {
        setSaldoNoData(true);
      } else {
        setSaldoAnterior(data.saldo ?? 0);
      }
    } catch {
      setSaldoNoData(true);
    }
  }, [getToken]);

  useEffect(() => {
    if (tieneAcceso) {
      cargar(mesActual);
      cargarSaldoAnterior(mesActual);
      cargarComprobantes();
    }
  }, []); // eslint-disable-line

  const handleMes = (e) => {
    setMesFiltro(e.target.value);
    cargar(e.target.value);
    cargarSaldoAnterior(e.target.value);
  };

  const handleForm = (campo, valor) => setForm(p => ({ ...p, [campo]: valor }));

  const abrirTab = (tab) => {
    setTabActiva(tab);
    setForm(p => ({ ...p, tipo: tab, categoria: "", tipo_culto: "", descripcion: "" }));
  };

  const guardar = async () => {
    if (!form.categoria) { setMensaje({ tipo: "error", texto: "Selecciona una categoría" }); return; }
    if (!form.monto || isNaN(form.monto) || parseFloat(form.monto) <= 0) { setMensaje({ tipo: "error", texto: "Ingresa un monto válido" }); return; }
    if (tabActiva === "ingreso" && !form.tipo_culto) { setMensaje({ tipo: "error", texto: "Selecciona el tipo de ingreso" }); return; }
    setGuardando(true);
    setMensaje(null);
    try {
      const payload = {
        ...form,
        tipo_culto: (tabActiva === "ingreso" && form.tipo_culto !== "otro") ? form.tipo_culto : null,
        descripcion: (tabActiva === "ingreso" && form.tipo_culto !== "otro") ? null : form.descripcion,
        notas: form.notas?.trim() || null,
      };
      const res = await fetch(`${API}/api/tesoreria`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${getToken()}` },
        body: JSON.stringify(payload),
      });
      if (!res.ok) throw new Error((await res.json()).error || "Error");
      setForm({ ...FORM_VACIO, tipo: tabActiva, fecha: new Date().toISOString().split("T")[0] });
      setMensaje({ tipo: "ok", texto: `${tabActiva === "ingreso" ? "Ingreso" : "Egreso"} registrado correctamente.` });
      cargar(mesFiltro);
    } catch (e) {
      setMensaje({ tipo: "error", texto: e.message });
    } finally {
      setGuardando(false);
    }
  };

  const eliminar = async (id) => {
    if (!confirm("¿Eliminar este movimiento?")) return;
    try {
      await fetch(`${API}/api/tesoreria/${id}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${getToken()}` },
      });
      cargar(mesFiltro);
    } catch {
      alert("Error al eliminar");
    }
  };
  const guardarSaldoManual = async () => {
    if (saldoManualInput === "" || isNaN(saldoManualInput)) return;
    setGuardandoSaldo(true);
    try {
      const res = await fetch(`${API}/api/tesoreria/saldo-inicial`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${getToken()}` },
        body: JSON.stringify({ mes: mesFiltro, monto: saldoManualInput }),
      });
      if (res.ok) {
        setSaldoAnterior(parseFloat(saldoManualInput));
        setSaldoNoData(false);
        setSaldoManualInput("");
        setEditandoSaldo(false);
      }
    } catch { /* silent */ } finally { setGuardandoSaldo(false); }
  };

  const handleFormEdit = (campo, valor) => setFormEdit(p => ({ ...p, [campo]: valor }));

  const abrirEditar = (m) => {
    setMensaje(null);
    setEditando(m);
    setFormEdit({
      tipo: m.tipo,
      categoria: m.categoria,
      monto: String(Math.round(parseFloat(m.monto))),
      descripcion: m.descripcion || "",
      tipo_culto: m.tipo_culto || (m.tipo === "ingreso" ? "otro" : ""),
      notas: m.notas || "",
      fecha: String(m.fecha).split("T")[0],
    });
    setMensajeEdit(null);
  };

  const guardarEdit = async () => {
    if (!formEdit.categoria) { setMensajeEdit({ tipo: "error", texto: "Selecciona una categor\u00eda" }); return; }
    if (!formEdit.monto || isNaN(formEdit.monto) || parseFloat(formEdit.monto) <= 0) { setMensajeEdit({ tipo: "error", texto: "Ingresa un monto v\u00e1lido" }); return; }
    if (formEdit.tipo === "ingreso" && !formEdit.tipo_culto) { setMensajeEdit({ tipo: "error", texto: "Selecciona el tipo de ingreso" }); return; }
    setGuardandoEdit(true);
    setMensajeEdit(null);
    try {
      const payload = {
        ...formEdit,
        tipo_culto: (formEdit.tipo === "ingreso" && formEdit.tipo_culto !== "otro") ? formEdit.tipo_culto : null,
        descripcion: (formEdit.tipo === "ingreso" && formEdit.tipo_culto !== "otro") ? null : formEdit.descripcion,
        notas: formEdit.notas?.trim() || null,
      };
      const res = await fetch(`${API}/api/tesoreria/${editando.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${getToken()}` },
        body: JSON.stringify(payload),
      });
      if (!res.ok) throw new Error((await res.json()).error || "Error");
      setEditando(null);
      setFormEdit(null);
      cargar(mesFiltro);
    } catch (e) {
      setMensajeEdit({ tipo: "error", texto: e.message });
    } finally {
      setGuardandoEdit(false);
    }
  };
  const ingresos   = movimientos.filter(m => m.tipo === "ingreso");
  const egresos    = movimientos.filter(m => m.tipo === "egreso");
  const totalIng   = ingresos.reduce((s, m) => s + parseFloat(m.monto), 0);
  const totalEgr   = egresos.reduce((s, m) => s + parseFloat(m.monto), 0);
  const saldoPrev  = saldoAnterior ?? 0;
  const balance    = saldoPrev + totalIng - totalEgr;

  const [anioFiltro, mesFiltroN] = mesFiltro.split("-");
  const mesNombre = MESES_ES[parseInt(mesFiltroN) - 1];

  const labelCategoria = (tipo, cat) => {
    const lista = tipo === "ingreso" ? CATEGORIAS_INGRESO : CATEGORIAS_EGRESO;
    return lista.find(c => c.value === cat)?.label || cat;
  };

  if (!tieneAcceso) {
    return (
      <>
        <AdminNav />
        <div className="flex items-center justify-center min-h-[60vh]">
          <div className="text-center">
            <p className="text-2xl font-bold text-gray-400 mb-2">Acceso restringido</p>
            <p className="text-gray-500">Solo el Tesorero y el administrador pueden acceder a esta sección.</p>
            <button onClick={() => navigate("/admin")} className="mt-4 text-blue-600 hover:underline text-sm">
              Volver al panel
            </button>
          </div>
        </div>
      </>
    );
  }

  return (
    <>
      <AdminNav />
      <div className="p-6 max-w-5xl mx-auto space-y-6">

        {/* Encabezado */}
        <div className="flex flex-wrap items-center justify-between gap-3 bg-white rounded-xl shadow px-6 py-4">
          <div>
            <h1 className="text-2xl font-bold text-gray-800">Tesorería</h1>
            <p className="text-xs text-gray-500 mt-0.5">Registro de ingresos y egresos — {mesNombre} {anioFiltro}</p>
          </div>
          <div className="flex items-center gap-3">
            <input
              type="month"
              value={mesFiltro}
              onChange={handleMes}
              className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
            />
            <button
              onClick={async () => {
                setGenerandoPDF(true);
                try {
                  await generarTesoreriaPDF({ mesFiltro, movimientos, saldoAnterior, saldoNoData, getToken });
                } catch (e) {
                  alert("Error al generar PDF: " + e.message);
                } finally {
                  setGenerandoPDF(false);
                }
              }}
              disabled={generandoPDF || movimientos.length === 0}
              title="Generar PDF del balance del mes"
              className="flex items-center gap-2 px-4 py-2 bg-emerald-700 hover:bg-emerald-800 disabled:opacity-50 text-white text-sm font-semibold rounded-lg transition-colors"
            >
              <FileText size={15} />
              {generandoPDF ? "Generando..." : "PDF"}
            </button>
          </div>
        </div>

        {/* Resumen */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {/* Saldo Anterior */}
          <div className="bg-gray-50 border border-gray-200 rounded-xl p-5 flex items-center gap-4">
            <div className="bg-gray-200 rounded-full p-3 shrink-0">
              <Wallet className="text-gray-600" size={22} />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-xs text-gray-500 font-semibold uppercase tracking-wide">Saldo Anterior</p>
              {saldoNoData ? (
                <div className="mt-1 space-y-1">
                  <p className="text-xs text-amber-600 font-medium">Sin datos del mes previo</p>
                  <div className="flex items-center gap-1">
                    <input
                      type="number"
                      min="0"
                      value={saldoManualInput}
                      onChange={e => setSaldoManualInput(e.target.value)}
                      placeholder="0"
                      className="w-24 border border-gray-300 rounded px-2 py-1 text-sm focus:outline-none focus:ring-1 focus:ring-gray-400"
                    />
                    <button
                      onClick={guardarSaldoManual}
                      disabled={guardandoSaldo || saldoManualInput === ""}
                      className="text-xs bg-gray-600 text-white px-2 py-1 rounded hover:bg-gray-700 disabled:opacity-50 transition-colors"
                    >
                      {guardandoSaldo ? "..." : "OK"}
                    </button>
                  </div>
                </div>
              ) : editandoSaldo ? (
                <div className="mt-1 space-y-1">
                  <div className="flex items-center gap-1">
                    <input
                      type="number"
                      min="0"
                      value={saldoManualInput}
                      onChange={e => setSaldoManualInput(e.target.value)}
                      placeholder="0"
                      className="w-24 border border-gray-300 rounded px-2 py-1 text-sm focus:outline-none focus:ring-1 focus:ring-gray-400"
                    />
                    <button
                      onClick={guardarSaldoManual}
                      disabled={guardandoSaldo || saldoManualInput === ""}
                      className="text-xs bg-gray-600 text-white px-2 py-1 rounded hover:bg-gray-700 disabled:opacity-50 transition-colors"
                    >
                      {guardandoSaldo ? "..." : "OK"}
                    </button>
                    <button onClick={() => setEditandoSaldo(false)} className="text-gray-400 hover:text-gray-600"><X size={14} /></button>
                  </div>
                </div>
              ) : (
                <div className="flex items-center gap-2">
                  <p className="text-2xl font-bold text-gray-700">{FMT(saldoAnterior ?? 0)}</p>
                  <button
                    onClick={() => { setMensaje(null); setSaldoManualInput(String(Math.round(saldoAnterior ?? 0))); setEditandoSaldo(true); }}
                    title="Editar saldo anterior"
                    className="text-gray-400 hover:text-gray-600 transition-colors"
                  >
                    <Pencil size={14} />
                  </button>
                </div>
              )}
            </div>
          </div>

          {/* Ingresos */}
          <div className="bg-emerald-50 rounded-xl p-5 flex items-center gap-4">
            <div className="bg-emerald-100 rounded-full p-3">
              <TrendingUp className="text-emerald-600" size={22} />
            </div>
            <div>
              <p className="text-xs text-emerald-600 font-semibold uppercase tracking-wide">Total Ingresos</p>
              <p className="text-2xl font-bold text-emerald-800">{FMT(totalIng)}</p>
            </div>
          </div>

          {/* Egresos */}
          <div className="bg-red-50 rounded-xl p-5 flex items-center gap-4">
            <div className="bg-red-100 rounded-full p-3">
              <TrendingDown className="text-red-500" size={22} />
            </div>
            <div>
              <p className="text-xs text-red-500 font-semibold uppercase tracking-wide">Total Egresos</p>
              <p className="text-2xl font-bold text-red-700">{FMT(totalEgr)}</p>
            </div>
          </div>

          {/* Balance */}
          <div className={`rounded-xl p-5 flex items-center gap-4 ${balance >= 0 ? "bg-blue-50" : "bg-orange-50"}`}>
            <div className={`rounded-full p-3 ${balance >= 0 ? "bg-blue-100" : "bg-orange-100"}`}>
              <DollarSign className={balance >= 0 ? "text-blue-600" : "text-orange-500"} size={22} />
            </div>
            <div>
              <p className={`text-xs font-semibold uppercase tracking-wide ${balance >= 0 ? "text-blue-600" : "text-orange-500"}`}>Balance Total</p>
              <p className={`text-2xl font-bold ${balance >= 0 ? "text-blue-800" : "text-orange-700"}`}>{FMT(balance)}</p>
            </div>
          </div>
        </div>

        {/* Formulario nuevo movimiento */}
        <div className="bg-white rounded-xl shadow p-6">
          <div className="flex items-center justify-between mb-4 flex-wrap gap-3">
            <h2 className="text-sm font-bold text-gray-600 uppercase tracking-wide">Registrar movimiento</h2>
            <button
              onClick={() => setModalComprobante(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-50 hover:bg-emerald-100 border border-emerald-300 text-emerald-700 text-xs font-semibold rounded-lg transition-colors"
            >
              <Receipt size={14} />
              Generar comprobante digital
            </button>
          </div>

          {/* Tabs ingreso / egreso */}
          <div className="flex mb-5 border border-gray-200 rounded-lg overflow-hidden w-fit">
            <button
              onClick={() => abrirTab("ingreso")}
              className={`px-5 py-2 text-sm font-semibold transition-colors ${tabActiva === "ingreso" ? "bg-emerald-600 text-white" : "bg-white text-gray-600 hover:bg-gray-50"}`}
            >
              ↑ Ingreso
            </button>
            <button
              onClick={() => abrirTab("egreso")}
              className={`px-5 py-2 text-sm font-semibold transition-colors ${tabActiva === "egreso" ? "bg-red-500 text-white" : "bg-white text-gray-600 hover:bg-gray-50"}`}
            >
              ↓ Egreso
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {/* Categoría */}
            <div>
              <label className="text-xs font-semibold text-gray-600 mb-1 block">Categoría *</label>
              <select
                value={form.categoria}
                onChange={e => handleForm("categoria", e.target.value)}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-400"
              >
                <option value="">Seleccionar...</option>
                {(tabActiva === "ingreso" ? CATEGORIAS_INGRESO : CATEGORIAS_EGRESO).map(c => (
                  <option key={c.value} value={c.value}>{c.label}</option>
                ))}
              </select>
            </div>

            {/* Monto */}
            <div>
              <label className="text-xs font-semibold text-gray-600 mb-1 block">Monto (CLP) *</label>
              <input
                type="number"
                min="1"
                value={form.monto}
                onChange={e => handleForm("monto", e.target.value)}
                placeholder="Ej: 50000"
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-400"
              />
            </div>

            {/* Fecha */}
            <div>
              <label className="text-xs font-semibold text-gray-600 mb-1 block">Fecha *</label>
              <input
                type="date"
                value={form.fecha}
                onChange={e => handleForm("fecha", e.target.value)}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-400"
              />
            </div>

            {/* Descripción / Tipo culto */}
            {tabActiva === "ingreso" ? (
              <div>
                <label className="text-xs font-semibold text-gray-600 mb-1 block">Descripción *</label>
                <select
                  value={form.tipo_culto}
                  onChange={e => handleForm("tipo_culto", e.target.value)}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-400"
                >
                  <option value="">Seleccionar...</option>
                  <option value="culto_domingo">Culto Domingo</option>
                  <option value="culto_jueves">Culto Jueves</option>
                  <option value="otro">Otro</option>
                </select>
              </div>
            ) : (
              <div>
                <label className="text-xs font-semibold text-gray-600 mb-1 block">Descripción (opcional)</label>
                <input
                  type="text"
                  value={form.descripcion}
                  onChange={e => handleForm("descripcion", e.target.value)}
                  placeholder="Nota adicional..."
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-400"
                />
              </div>
            )}
          </div>

          {/* Detalle libre cuando se elige "Otro" */}
          {tabActiva === "ingreso" && form.tipo_culto === "otro" && (
            <div className="mt-3">
              <label className="text-xs font-semibold text-gray-600 mb-1 block">Detalle (opcional)</label>
              <input
                type="text"
                value={form.descripcion}
                onChange={e => handleForm("descripcion", e.target.value)}
                placeholder="Descripción del ingreso..."
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-400"
              />
            </div>
          )}

          {/* Anotación opcional (Detalle) */}
          <div className="mt-3">
            <label className="text-xs font-semibold text-gray-600 mb-1 block">Detalle <span className="text-gray-400 font-normal">(opcional)</span></label>
            <textarea
              rows={2}
              value={form.notas}
              onChange={e => handleForm("notas", e.target.value)}
              placeholder="Anotación adicional sobre este registro..."
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-400 resize-none"
            />
          </div>

          {mensaje && (
            <p className={`text-sm mt-3 font-medium ${mensaje.tipo === "ok" ? "text-emerald-600" : "text-red-600"}`}>
              {mensaje.tipo === "ok" ? "✓" : "✗"} {mensaje.texto}
            </p>
          )}

          <button
            onClick={guardar}
            disabled={guardando}
            className={`mt-4 flex items-center gap-2 px-5 py-2 rounded-lg text-sm font-semibold text-white transition-colors disabled:opacity-60 ${tabActiva === "ingreso" ? "bg-emerald-600 hover:bg-emerald-700" : "bg-red-500 hover:bg-red-600"}`}
          >
            <PlusCircle size={16} />
            {guardando ? "Guardando..." : `Registrar ${tabActiva === "ingreso" ? "ingreso" : "egreso"}`}
          </button>
        </div>

        {/* Listado del mes */}
        <div className="bg-white rounded-xl shadow p-6">
          <h2 className="text-sm font-bold text-gray-600 uppercase tracking-wide mb-4">
            Movimientos — {mesNombre} {anioFiltro}
          </h2>

          {cargando ? (
            <div className="flex justify-center py-10">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-emerald-600" />
            </div>
          ) : movimientos.length === 0 ? (
            <p className="text-gray-400 italic text-sm">Sin movimientos registrados en este mes.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-xs text-gray-500 uppercase border-b">
                    <th className="pb-2 text-left pr-3">Fecha</th>
                    <th className="pb-2 text-left pr-3">Tipo</th>
                    <th className="pb-2 text-left pr-3">Categoría</th>
                    <th className="pb-2 text-right pr-3">Monto</th>
                    <th className="pb-2 text-left pr-3">Descripción</th>
                    <th className="pb-2 text-left pr-3">Registrado por</th>
                    <th className="pb-2 text-center" colSpan={2}></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {movimientos.map(m => (
                    <tr key={m.id} className="hover:bg-gray-50">
                      <td className="py-2.5 pr-3 text-gray-600">
                        {m.fecha ? String(m.fecha).split("T")[0].split("-").reverse().join("/") : "—"}
                      </td>
                      <td className="py-2.5 pr-3">
                        <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${m.tipo === "ingreso" ? "bg-emerald-100 text-emerald-700" : "bg-red-100 text-red-600"}`}>
                          {m.tipo === "ingreso" ? "↑ Ingreso" : "↓ Egreso"}
                        </span>
                      </td>
                      <td className="py-2.5 pr-3 text-gray-700">{labelCategoria(m.tipo, m.categoria)}</td>
                      <td className={`py-2.5 pr-3 text-right font-semibold ${m.tipo === "ingreso" ? "text-emerald-700" : "text-red-600"}`}>
                        {FMT(m.monto)}
                      </td>
                      <td className="py-2.5 pr-3 text-gray-500 italic">
                        {m.tipo_culto === "culto_domingo"
                          ? <span className="bg-cyan-100 text-cyan-700 text-xs px-2 py-0.5 rounded-full font-semibold">Culto Domingo</span>
                          : m.tipo_culto === "culto_jueves"
                          ? <span className="bg-indigo-100 text-indigo-700 text-xs px-2 py-0.5 rounded-full font-semibold">Culto Jueves</span>
                          : m.descripcion || "—"}
                        {m.notas && <p className="text-xs text-gray-400 mt-0.5">{m.notas}</p>}
                      </td>
                      <td className="py-2.5 pr-3 text-gray-400 text-xs">{m.registrado_por_nombre || "—"}</td>                      <td className="py-2.5 pr-1">
                        <button onClick={() => abrirEditar(m)} title="Editar" className="text-gray-400 hover:text-emerald-600 transition-colors">
                          <Pencil size={14} />
                        </button>
                      </td>                      <td className="py-2.5">
                        <button onClick={() => eliminar(m.id)} title="Eliminar" className="text-red-400 hover:text-red-600">
                          <Trash2 size={15} />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Comprobantes digitales */}
        <div className="bg-white rounded-xl shadow p-6">
          <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
            <h2 className="text-sm font-bold text-gray-600 uppercase tracking-wide flex items-center gap-2">
              <Receipt size={15} className="text-emerald-600" />
              Comprobantes digitales enviados
            </h2>
            <span className="text-xs text-gray-400">{comprobantes.length} total</span>
          </div>

          {cargandoComprobantes ? (
            <div className="flex justify-center py-8">
              <div className="animate-spin rounded-full h-7 w-7 border-b-2 border-emerald-600" />
            </div>
          ) : comprobantes.length === 0 ? (
            <p className="text-gray-400 italic text-sm">No hay comprobantes emitidos aún.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-xs text-gray-500 uppercase border-b">
                    <th className="pb-2 text-left pr-3">Fecha</th>
                    <th className="pb-2 text-left pr-3">Miembro</th>
                    <th className="pb-2 text-left pr-3">Concepto</th>
                    <th className="pb-2 text-right pr-3">Monto</th>
                    <th className="pb-2 text-left pr-3">Pago</th>
                    <th className="pb-2 text-center">Estado</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {comprobantes.map(c => (
                    <tr
                      key={c.id}
                      className="hover:bg-emerald-50 cursor-pointer transition"
                      onClick={() => setComprobanteDetalle(c)}
                    >
                      <td className="py-2.5 pr-3 text-gray-600 whitespace-nowrap">
                        {c.fecha ? String(c.fecha).split("T")[0].split("-").reverse().join("/") : "—"}
                      </td>
                      <td className="py-2.5 pr-3 font-medium text-gray-800">
                        {c.miembro_nombre} {c.miembro_apellido}
                      </td>
                      <td className="py-2.5 pr-3 text-gray-600">
                        {c.concepto === "cuotas_diezmos" ? "Cuotas / Diezmos" : c.concepto}
                      </td>
                      <td className="py-2.5 pr-3 text-right font-semibold text-emerald-700">
                        {FMT(c.monto)}
                      </td>
                      <td className="py-2.5 pr-3 text-gray-500 text-xs capitalize">
                        {c.tipo_pago === "efectivo" ? "Efectivo" : c.tipo_pago === "transferencia" ? "Transferencia" : "Depósito"}
                      </td>
                      <td className="py-2.5 text-center">
                        {c.estado === "revisado" ? (
                          <span className="inline-flex items-center gap-1 text-xs font-semibold text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-full">
                            <CheckCircle size={11} /> Revisado
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-xs font-semibold text-amber-700 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded-full">
                            <Clock size={11} /> Pendiente
                          </span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {modalComprobante && (
        <ModalComprobante
          getToken={getToken}
          onClose={() => setModalComprobante(false)}
          onEnviado={() => cargarComprobantes()}
        />
      )}

      {comprobanteDetalle && (
        <div
          className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4"
          onClick={e => { if (e.target === e.currentTarget) setComprobanteDetalle(null); }}
        >
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden">
            {/* Header */}
            <div className="bg-emerald-600 px-6 py-4 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Receipt size={18} className="text-white" />
                <div>
                  <p className="text-white font-bold text-base leading-tight">Comprobante digital</p>
                  <p className="text-emerald-200 text-xs">
                    {comprobanteDetalle.fecha
                      ? String(comprobanteDetalle.fecha).split("T")[0].split("-").reverse().join("/")
                      : ""}
                  </p>
                </div>
              </div>
              <button
                onClick={() => setComprobanteDetalle(null)}
                className="text-white/80 hover:text-white"
              >
                <X size={20} />
              </button>
            </div>

            {/* Body */}
            <div className="px-6 py-5 space-y-4">
              {/* Miembro + monto */}
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs text-gray-500 uppercase tracking-wide">Miembro</p>
                  <p className="font-semibold text-gray-800">
                    {comprobanteDetalle.miembro_nombre} {comprobanteDetalle.miembro_apellido}
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-xs text-gray-500 uppercase tracking-wide">Monto</p>
                  <p className="text-2xl font-bold text-emerald-700">{FMT(comprobanteDetalle.monto)}</p>
                </div>
              </div>

              {/* Detalles */}
              <div className="grid grid-cols-2 gap-3">
                <div className="bg-gray-50 rounded-xl p-3">
                  <p className="text-xs text-gray-400 mb-0.5">Concepto</p>
                  <p className="text-sm font-semibold text-gray-700">
                    {comprobanteDetalle.concepto === "cuotas_diezmos" ? "Cuotas / Diezmos" : comprobanteDetalle.concepto}
                  </p>
                </div>
                <div className="bg-gray-50 rounded-xl p-3">
                  <p className="text-xs text-gray-400 mb-0.5">Tipo de pago</p>
                  <p className="text-sm font-semibold text-gray-700 capitalize">
                    {comprobanteDetalle.tipo_pago === "efectivo" ? "Efectivo"
                      : comprobanteDetalle.tipo_pago === "transferencia" ? "Transferencia"
                      : "Depósito"}
                  </p>
                </div>
              </div>

              {/* Mensaje */}
              {comprobanteDetalle.mensaje && (
                <div className="bg-emerald-50 border border-emerald-100 rounded-xl p-4">
                  <p className="text-xs text-emerald-600 font-semibold mb-1">Mensaje enviado al miembro</p>
                  <p className="text-sm text-gray-700 whitespace-pre-wrap leading-relaxed">
                    {comprobanteDetalle.mensaje}
                  </p>
                </div>
              )}

              {/* Estado */}
              <div className="flex items-center justify-between pt-1">
                <div>
                  {comprobanteDetalle.estado === "revisado" ? (
                    <span className="inline-flex items-center gap-1.5 text-sm font-semibold text-emerald-700 bg-emerald-50 border border-emerald-200 px-3 py-1 rounded-full">
                      <CheckCircle size={14} /> Revisado por el miembro
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1.5 text-sm font-semibold text-amber-700 bg-amber-50 border border-amber-200 px-3 py-1 rounded-full">
                      <Clock size={14} /> Pendiente de revisión
                    </span>
                  )}
                  {comprobanteDetalle.revisado_at && (
                    <p className="text-xs text-gray-400 mt-1">
                      Revisado el {String(comprobanteDetalle.revisado_at).split("T")[0].split("-").reverse().join("/")}
                    </p>
                  )}
                </div>
                <button
                  onClick={() => setComprobanteDetalle(null)}
                  className="text-sm text-gray-500 hover:text-gray-700 font-medium"
                >
                  Cerrar
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {editando && formEdit && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4" onClick={e => { if (e.target === e.currentTarget) setEditando(null); }}>
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg p-6 space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-bold text-gray-800">Editar movimiento</h2>
              <button onClick={() => setEditando(null)} className="text-gray-400 hover:text-gray-600"><X size={20} /></button>
            </div>

            <span className={`inline-block px-3 py-1 rounded-full text-xs font-semibold ${formEdit.tipo === "ingreso" ? "bg-emerald-100 text-emerald-700" : "bg-red-100 text-red-600"}`}>
              {formEdit.tipo === "ingreso" ? "\u2191 Ingreso" : "\u2193 Egreso"}
            </span>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="text-xs font-semibold text-gray-600 mb-1 block">Categor\u00eda *</label>
                <select value={formEdit.categoria} onChange={e => handleFormEdit("categoria", e.target.value)} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-400">
                  <option value="">Seleccionar...</option>
                  {(formEdit.tipo === "ingreso" ? CATEGORIAS_INGRESO : CATEGORIAS_EGRESO).map(c => (
                    <option key={c.value} value={c.value}>{c.label}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="text-xs font-semibold text-gray-600 mb-1 block">Monto (CLP) *</label>
                <input type="number" min="1" value={formEdit.monto} onChange={e => handleFormEdit("monto", e.target.value)} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-400" />
              </div>
              <div>
                <label className="text-xs font-semibold text-gray-600 mb-1 block">Fecha *</label>
                <input type="date" value={formEdit.fecha} onChange={e => handleFormEdit("fecha", e.target.value)} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-400" />
              </div>
              {formEdit.tipo === "ingreso" ? (
                <div>
                  <label className="text-xs font-semibold text-gray-600 mb-1 block">Descripci\u00f3n *</label>
                  <select value={formEdit.tipo_culto} onChange={e => handleFormEdit("tipo_culto", e.target.value)} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-400">
                    <option value="">Seleccionar...</option>
                    <option value="culto_domingo">Culto Domingo</option>
                    <option value="culto_jueves">Culto Jueves</option>
                    <option value="otro">Otro</option>
                  </select>
                </div>
              ) : (
                <div>
                  <label className="text-xs font-semibold text-gray-600 mb-1 block">Descripci\u00f3n (opcional)</label>
                  <input type="text" value={formEdit.descripcion} onChange={e => handleFormEdit("descripcion", e.target.value)} placeholder="Nota adicional..." className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-400" />
                </div>
              )}
            </div>

            {formEdit.tipo === "ingreso" && formEdit.tipo_culto === "otro" && (
              <div>
                <label className="text-xs font-semibold text-gray-600 mb-1 block">Detalle (opcional)</label>
                <input type="text" value={formEdit.descripcion} onChange={e => handleFormEdit("descripcion", e.target.value)} placeholder="Descripci\u00f3n del ingreso..." className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-400" />
              </div>
            )}

            <div>
              <label className="text-xs font-semibold text-gray-600 mb-1 block">Detalle <span className="text-gray-400 font-normal">(opcional)</span></label>
              <textarea rows={2} value={formEdit.notas} onChange={e => handleFormEdit("notas", e.target.value)} placeholder="Escribe una nota..." className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-400 resize-none" />
            </div>

            {mensajeEdit && (
              <p className={`text-sm font-medium ${mensajeEdit.tipo === "ok" ? "text-emerald-600" : "text-red-600"}`}>
                {mensajeEdit.texto}
              </p>
            )}

            <div className="flex gap-3 justify-end pt-2 border-t">
              <button onClick={() => setEditando(null)} className="px-4 py-2 rounded-lg text-sm font-semibold text-gray-600 bg-gray-100 hover:bg-gray-200 transition-colors">
                Cancelar
              </button>
              <button
                onClick={guardarEdit}
                disabled={guardandoEdit}
                className={`px-5 py-2 rounded-lg text-sm font-semibold text-white transition-colors disabled:opacity-60 ${formEdit.tipo === "ingreso" ? "bg-emerald-600 hover:bg-emerald-700" : "bg-red-500 hover:bg-red-600"}`}
              >
                {guardandoEdit ? "Guardando..." : "Guardar cambios"}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
