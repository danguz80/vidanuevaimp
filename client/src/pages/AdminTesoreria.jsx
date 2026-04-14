import React, { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import AdminNav from "../components/AdminNav";
import ModalComprobante from "../components/ModalComprobante";
import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";
import { PlusCircle, Trash2, TrendingUp, TrendingDown, DollarSign, Wallet, Pencil, X, FileText, Receipt, CheckCircle, Clock, Printer } from "lucide-react";

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

// Categorías de ingreso que generan comprobante digital
const CATEGORIAS_CON_COMPROBANTE = ["cuotas_diezmos", "otros"];

const CONCEPTO_LABELS_COMP = { cuotas_diezmos: "Cuotas / Diezmos", otros: "Otros" };

const mensajeDefecto = (concepto, nombreMiembro) =>
  `Estimado/a ${nombreMiembro},\n\nLa iglesia Misión Pentecostés Templo Vida Nueva, a través de su Tesorera, nuestra hna. Priscilla Vásquez Núñez, acredita que Ud. ha realizado un aporte en dinero por concepto de ${CONCEPTO_LABELS_COMP[concepto] || concepto}.\n\nSu donación es bien recibida y se agradece profundamente su cooperación. Que Dios le bendiga grandemente.\n\n"El que siembra escasamente, también segará escasamente; y el que siembra generosamente, generosamente también segará." — 2 Corintios 9:6`;

const FORM_COMP_VACIO = { miembro_id: "", tipo_pago: "efectivo", mensaje: "" };

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
  const [comprobanteEditando, setComprobanteEditando] = useState(null);

  // Comprobante integrado al formulario de ingreso
  const [miembros, setMiembros] = useState([]);
  const [formComp, setFormComp] = useState(FORM_COMP_VACIO);
  const [comprobanteEditForm, setComprobanteEditForm] = useState(null);
  const [guardandoComprobante, setGuardandoComprobante] = useState(false);
  const [mensajeComprobante, setMensajeComprobante] = useState(null);
  const [eliminandoComprobante, setEliminandoComprobante] = useState(false);

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

  const abrirEditarComprobante = (c) => {
    setComprobanteEditForm({
      monto: c.monto,
      concepto: c.concepto,
      tipo_pago: c.tipo_pago,
      fecha: c.fecha ? String(c.fecha).split("T")[0] : new Date().toISOString().split("T")[0],
      mensaje: c.mensaje || "",
    });
    setComprobanteEditando(c);
    setComprobanteDetalle(null);
    setMensajeComprobante(null);
  };

  const guardarEditarComprobante = async () => {
    if (!comprobanteEditForm.monto || isNaN(comprobanteEditForm.monto) || parseFloat(comprobanteEditForm.monto) <= 0) {
      setMensajeComprobante({ tipo: "error", texto: "Monto inválido" });
      return;
    }
    setGuardandoComprobante(true);
    setMensajeComprobante(null);
    try {
      const res = await fetch(`${API}/api/tesoreria/comprobantes/${comprobanteEditando.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${getToken()}` },
        body: JSON.stringify(comprobanteEditForm),
      });
      if (!res.ok) throw new Error((await res.json()).error || "Error al editar");
      setComprobanteEditando(null);
      setComprobanteEditForm(null);
      cargarComprobantes();
    } catch (e) {
      setMensajeComprobante({ tipo: "error", texto: e.message });
    } finally {
      setGuardandoComprobante(false);
    }
  };

  const eliminarComprobante = async (id) => {
    if (!window.confirm("¿Eliminar este comprobante? Desaparecerá también del portal del miembro.")) return;
    setEliminandoComprobante(true);
    try {
      const res = await fetch(`${API}/api/tesoreria/comprobantes/${id}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${getToken()}` },
      });
      if (!res.ok) throw new Error((await res.json()).error || "Error al eliminar");
      setComprobanteDetalle(null);
      cargarComprobantes();
      cargar(mesFiltro);
    } catch (e) {
      alert("Error al eliminar: " + e.message);
    } finally {
      setEliminandoComprobante(false);
    }
  };

  const imprimirComprobante = async (c) => {
    const doc = new jsPDF({ unit: "mm", format: "a4" });
    const W = 210;
    const margin = 20;
    let y = 20;

    // Cabecera verde
    doc.setFillColor(5, 150, 105);
    doc.rect(0, 0, W, 28, "F");
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(16);
    doc.setFont("helvetica", "bold");
    doc.text("Comprobante Digital", margin, 12);
    doc.setFontSize(10);
    doc.setFont("helvetica", "normal");
    if (c.folio) doc.text(`Folio: ${c.folio}`, margin, 20);
    const fechaStr = c.fecha ? String(c.fecha).split("T")[0].split("-").reverse().join("/") : "";
    doc.text(fechaStr, W - margin, 20, { align: "right" });
    y = 38;

    // Miembro y monto
    doc.setTextColor(80, 80, 80);
    doc.setFontSize(8);
    doc.setFont("helvetica", "normal");
    doc.text("MIEMBRO", margin, y);
    doc.text("MONTO", W - margin, y, { align: "right" });
    y += 5;
    doc.setTextColor(20, 20, 20);
    doc.setFontSize(13);
    doc.setFont("helvetica", "bold");
    doc.text(`${c.miembro_nombre} ${c.miembro_apellido}`, margin, y);
    doc.setTextColor(5, 150, 105);
    doc.text(FMT(c.monto), W - margin, y, { align: "right" });
    y += 10;

    // Línea separadora
    doc.setDrawColor(220, 220, 220);
    doc.line(margin, y, W - margin, y);
    y += 7;

    // Concepto y tipo pago
    doc.setTextColor(80, 80, 80);
    doc.setFontSize(8);
    doc.setFont("helvetica", "normal");
    doc.text("CONCEPTO", margin, y);
    doc.text("TIPO DE PAGO", W / 2, y);
    y += 5;
    doc.setTextColor(20, 20, 20);
    doc.setFontSize(10);
    doc.setFont("helvetica", "bold");
    const conceptoLabel = c.concepto === "cuotas_diezmos" ? "Cuotas / Diezmos" : c.concepto;
    const pagoLabel = c.tipo_pago === "efectivo" ? "Efectivo" : c.tipo_pago === "transferencia" ? "Transferencia" : "Depósito";
    doc.text(conceptoLabel, margin, y);
    doc.text(pagoLabel, W / 2, y);
    y += 10;

    // Notas/Detalle
    if (c.notas) {
      doc.setTextColor(80, 80, 80);
      doc.setFontSize(8);
      doc.setFont("helvetica", "normal");
      doc.text("DETALLE", margin, y);
      y += 5;
      doc.setTextColor(20, 20, 20);
      doc.setFontSize(10);
      doc.setFont("helvetica", "normal");
      const notasLines = doc.splitTextToSize(c.notas, W - margin * 2);
      doc.text(notasLines, margin, y);
      y += notasLines.length * 5 + 5;
    }

    // Mensaje
    if (c.mensaje) {
      doc.setFillColor(240, 253, 244);
      const msgLines = doc.splitTextToSize(c.mensaje, W - margin * 2 - 8);
      const boxH = msgLines.length * 5 + 10;
      doc.roundedRect(margin, y, W - margin * 2, boxH, 3, 3, "F");
      doc.setTextColor(5, 150, 105);
      doc.setFontSize(8);
      doc.setFont("helvetica", "bold");
      doc.text("Mensaje al miembro", margin + 4, y + 6);
      doc.setTextColor(40, 40, 40);
      doc.setFontSize(9);
      doc.setFont("helvetica", "normal");
      doc.text(msgLines, margin + 4, y + 12);
      y += boxH + 10;
    }

    // Firma e imágenes
    // Timbre
    try {
      const timbreRes = await fetch("/Timbre%20iglesia%20sin%20fondo.png");
      const timbreBlob = await timbreRes.blob();
      const timbreB64 = await new Promise(resolve => {
        const reader = new FileReader();
        reader.onloadend = () => resolve(reader.result);
        reader.readAsDataURL(timbreBlob);
      });
      doc.addImage(timbreB64, "PNG", margin, y, 32, 32);
    } catch (_) {}

    // Firma
    try {
      const firmaRes = await fetch("/Firma%20Pri.png");
      const firmaBlob = await firmaRes.blob();
      const firmaB64 = await new Promise(resolve => {
        const reader = new FileReader();
        reader.onloadend = () => resolve(reader.result);
        reader.readAsDataURL(firmaBlob);
      });
      doc.addImage(firmaB64, "PNG", W / 2 - 10, y - 5, 50, 40);
    } catch (_) {}

    y += 38;
    doc.setDrawColor(180, 180, 180);
    doc.line(W / 2 - 25, y, W / 2 + 50, y);
    doc.setTextColor(80, 80, 80);
    doc.setFontSize(8);
    doc.setFont("helvetica", "bold");
    doc.text("Firma Tesorero/a:", W / 2 + 12, y + 5, { align: "center" });
    doc.setFont("helvetica", "normal");
    doc.text("Priscilla Vásquez Núñez", W / 2 + 12, y + 10, { align: "center" });

    doc.save(`Comprobante-${c.folio || c.id}.pdf`);
  };

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

  // Cargar miembros activos para el selector del comprobante integrado
  useEffect(() => {
    if (!tieneAcceso) return;
    fetch(`${API}/api/miembros`, { headers: { Authorization: `Bearer ${getToken()}` } })
      .then(r => r.json())
      .then(data => { if (Array.isArray(data)) setMiembros(data.filter(m => m.estado === "activo")); })
      .catch(() => {});
  }, []); // eslint-disable-line

  // Auto-generar mensaje cuando cambia miembro o categoría (comprobante integrado)
  useEffect(() => {
    if (!formComp.miembro_id) return;
    const m = miembros.find(m => String(m.id) === String(formComp.miembro_id));
    if (!m) return;
    setFormComp(p => ({ ...p, mensaje: mensajeDefecto(form.categoria, `${m.nombre} ${m.apellido}`) }));
  }, [formComp.miembro_id, form.categoria, miembros]); // eslint-disable-line

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

  const handleForm = (campo, valor) => {
    setForm(p => ({ ...p, [campo]: valor }));
    // Si cambia la categoría y ya no aplica comprobante, limpiar formComp
    if (campo === "categoria" && !CATEGORIAS_CON_COMPROBANTE.includes(valor)) {
      setFormComp(FORM_COMP_VACIO);
    }
  };

  const abrirTab = (tab) => {
    setTabActiva(tab);
    setForm(p => ({ ...p, tipo: tab, categoria: "", tipo_culto: "", descripcion: "" }));
    setFormComp(FORM_COMP_VACIO);
  };

  const guardar = async () => {
    if (!form.categoria) { setMensaje({ tipo: "error", texto: "Selecciona una categoría" }); return; }
    if (!form.monto || isNaN(form.monto) || parseFloat(form.monto) <= 0) { setMensaje({ tipo: "error", texto: "Ingresa un monto válido" }); return; }
    if (tabActiva === "ingreso" && !form.tipo_culto && !CATEGORIAS_CON_COMPROBANTE.includes(form.categoria)) { setMensaje({ tipo: "error", texto: "Selecciona el tipo de ingreso" }); return; }

    const emiteComprobante = tabActiva === "ingreso" && CATEGORIAS_CON_COMPROBANTE.includes(form.categoria);
    if (emiteComprobante && !formComp.miembro_id) {
      setMensaje({ tipo: "error", texto: "Selecciona el miembro para emitir el comprobante" }); return;
    }

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

      // Emitir comprobante digital si la categoría lo requiere
      if (emiteComprobante) {
        const movData = await res.json();
        const compRes = await fetch(`${API}/api/tesoreria/comprobantes`, {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${getToken()}` },
          body: JSON.stringify({
            miembro_id: formComp.miembro_id,
            monto: Math.round(parseFloat(form.monto)),
            concepto: form.categoria,
            tipo_pago: formComp.tipo_pago,
            fecha: form.fecha,
            mensaje: formComp.mensaje?.trim() || null,
            movimiento_id: movData.id,
            notas: form.notas?.trim() || null,
          }),
        });
        const compData = await compRes.json();
        const folio = compData.folio || "";
        setMensaje({ tipo: "ok", texto: `Ingreso registrado y comprobante emitido${folio ? ` (${folio})` : ""}.` });
        cargarComprobantes();
      } else {
        setMensaje({ tipo: "ok", texto: `${tabActiva === "ingreso" ? "Ingreso" : "Egreso"} registrado correctamente.` });
      }

      setForm({ ...FORM_VACIO, tipo: tabActiva, fecha: new Date().toISOString().split("T")[0] });
      setFormComp(FORM_COMP_VACIO);
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
          <div className="mb-4">
            <h2 className="text-sm font-bold text-gray-600 uppercase tracking-wide">Registrar movimiento</h2>
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
            {!CATEGORIAS_CON_COMPROBANTE.includes(form.categoria) && (
              tabActiva === "ingreso" ? (
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
              )
            )}
          </div>

          {/* Detalle libre cuando se elige "Otro" */}
          {tabActiva === "ingreso" && form.tipo_culto === "otro" && !CATEGORIAS_CON_COMPROBANTE.includes(form.categoria) && (
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

          {/* Campos de comprobante integrado (cuotas/diezmos u Otros) */}
          {tabActiva === "ingreso" && CATEGORIAS_CON_COMPROBANTE.includes(form.categoria) && (
            <div className="mt-4 border border-emerald-200 rounded-xl bg-emerald-50 p-4 space-y-4">
              <p className="text-xs font-bold text-emerald-700 uppercase tracking-wide flex items-center gap-1.5">
                <Receipt size={13} /> Comprobante digital — datos del miembro
              </p>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {/* Miembro */}
                <div className="sm:col-span-2">
                  <label className="text-xs font-semibold text-gray-600 mb-1 block">Miembro *</label>
                  <select
                    value={formComp.miembro_id}
                    onChange={e => setFormComp(p => ({ ...p, miembro_id: e.target.value }))}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-400 bg-white"
                  >
                    <option value="">Seleccionar miembro...</option>
                    {[...miembros]
                      .sort((a, b) => a.apellido.localeCompare(b.apellido))
                      .map(m => (
                        <option key={m.id} value={m.id}>
                          {m.apellido}, {m.nombre}
                        </option>
                      ))}
                  </select>
                </div>

                {/* Tipo de pago */}
                <div>
                  <label className="text-xs font-semibold text-gray-600 mb-1 block">Tipo de pago *</label>
                  <select
                    value={formComp.tipo_pago}
                    onChange={e => setFormComp(p => ({ ...p, tipo_pago: e.target.value }))}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-400 bg-white"
                  >
                    <option value="efectivo">Efectivo</option>
                    <option value="transferencia">Transferencia online</option>
                    <option value="deposito">Depósito en banco</option>
                  </select>
                </div>
              </div>

              {/* Mensaje al miembro */}
              <div>
                <label className="text-xs font-semibold text-gray-600 mb-1 block">Mensaje al miembro</label>
                <textarea
                  rows={5}
                  value={formComp.mensaje}
                  onChange={e => setFormComp(p => ({ ...p, mensaje: e.target.value }))}
                  placeholder="El mensaje se genera automáticamente al seleccionar el miembro..."
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-400 resize-none bg-white"
                />
              </div>
            </div>
          )}

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
            {guardando
              ? "Guardando..."
              : tabActiva === "ingreso" && CATEGORIAS_CON_COMPROBANTE.includes(form.categoria)
                ? "Registrar y Emitir Comprobante"
                : `Registrar ${tabActiva === "ingreso" ? "ingreso" : "egreso"}`}
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
                    <th className="pb-2 text-left pr-3">Folio</th>
                    <th className="pb-2 text-left pr-3">Fecha</th>
                    <th className="pb-2 text-left pr-3">Miembro</th>
                    <th className="pb-2 text-left pr-3">Concepto</th>
                    <th className="pb-2 text-right pr-3">Monto</th>
                    <th className="pb-2 text-left pr-3">Pago</th>
                    <th className="pb-2 text-center pr-3">Estado</th>
                    <th className="pb-2 text-center">Acciones</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {comprobantes.map(c => (
                    <tr
                      key={c.id}
                      className="hover:bg-emerald-50 cursor-pointer transition"
                      onClick={() => setComprobanteDetalle(c)}
                    >
                      <td className="py-2.5 pr-3 whitespace-nowrap">
                        {c.folio ? (
                          <span className="font-mono text-xs font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded">{c.folio}</span>
                        ) : <span className="text-gray-300 text-xs">—</span>}
                      </td>
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
                      <td className="py-2.5 pr-3 text-center">
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
                      <td className="py-2.5 text-center" onClick={e => e.stopPropagation()}>
                        <div className="flex items-center justify-center gap-1">
                          <button
                            onClick={() => abrirEditarComprobante(c)}
                            className="p-1.5 text-blue-600 hover:bg-blue-50 rounded-lg transition"
                            title="Editar"
                          >
                            <Pencil size={13} />
                          </button>
                          <button
                            onClick={() => eliminarComprobante(c.id)}
                            disabled={eliminandoComprobante}
                            className="p-1.5 text-red-500 hover:bg-red-50 rounded-lg transition disabled:opacity-50"
                            title="Eliminar"
                          >
                            <Trash2 size={13} />
                          </button>
                        </div>
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
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md max-h-[90vh] flex flex-col overflow-hidden">
            {/* Header */}
            <div className="bg-emerald-600 px-6 py-4 flex items-center justify-between shrink-0">
              <div className="flex items-center gap-3">
                <Receipt size={18} className="text-white" />
                <div>
                  <p className="text-white font-bold text-base leading-tight">Comprobante digital</p>
                  <div className="flex items-center gap-2">
                    {comprobanteDetalle.folio && (
                      <span className="font-mono text-xs font-bold text-emerald-900 bg-white/90 px-2 py-0.5 rounded">
                        {comprobanteDetalle.folio}
                      </span>
                    )}
                    <p className="text-emerald-200 text-xs">
                      {comprobanteDetalle.fecha
                        ? String(comprobanteDetalle.fecha).split("T")[0].split("-").reverse().join("/")
                        : ""}
                    </p>
                  </div>
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
            <div className="px-6 py-4 space-y-3 overflow-y-auto flex-1">
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
                {comprobanteDetalle.folio && (
                  <div className="bg-emerald-50 rounded-xl p-3 col-span-2">
                    <p className="text-xs text-gray-400 mb-0.5">Nº Comprobante</p>
                    <p className="font-mono text-base font-bold text-emerald-700">{comprobanteDetalle.folio}</p>
                  </div>
                )}
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

              {/* Detalle */}
              {comprobanteDetalle.notas && (
                <div className="bg-gray-50 border border-gray-200 rounded-xl px-4 py-2.5">
                  <p className="text-xs text-gray-500 font-semibold mb-0.5">Detalle</p>
                  <p className="text-sm text-gray-700">{comprobanteDetalle.notas}</p>
                </div>
              )}

              {/* Mensaje */}
              {comprobanteDetalle.mensaje && (
                <div className="bg-emerald-50 border border-emerald-100 rounded-xl p-4">
                  <p className="text-xs text-emerald-600 font-semibold mb-1">Mensaje enviado al miembro</p>
                  <p className="text-sm text-gray-700 whitespace-pre-wrap leading-relaxed">
                    {comprobanteDetalle.mensaje}
                  </p>
                </div>
              )}

              {/* Firma y Timbre */}
              <div style={{ marginTop: "4px" }} className="flex items-center justify-center gap-6 pt-2 border-t border-gray-100">
                <img
                  src="/Timbre%20iglesia%20sin%20fondo.png"
                  alt="Timbre Iglesia"
                  className="h-24 w-24 object-contain opacity-85 shrink-0"
                />
                <div className="flex flex-col items-center shrink-0">
                  <img
                    src="/Firma%20Pri.png"
                    alt="Firma Tesorera"
                    className="h-48 w-36 object-contain mb-1"
                  />
                  <p className="text-xs font-semibold text-gray-600">Firma Tesorero/a:</p>
                  <p className="text-xs text-gray-700 font-medium">Priscilla Vásquez Núñez</p>
                </div>
              </div>

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

              {/* Acciones admin/tesorero */}
              <div className="flex gap-2 pt-2 border-t">
                <button
                  onClick={() => imprimirComprobante(comprobanteDetalle)}
                  className="flex-1 flex items-center justify-center gap-1.5 text-sm font-semibold text-gray-700 bg-gray-50 hover:bg-gray-100 border border-gray-200 px-3 py-2 rounded-lg transition"
                >
                  <Printer size={14} /> Imprimir PDF
                </button>
                <button
                  onClick={() => abrirEditarComprobante(comprobanteDetalle)}
                  className="flex-1 flex items-center justify-center gap-1.5 text-sm font-semibold text-blue-700 bg-blue-50 hover:bg-blue-100 border border-blue-200 px-3 py-2 rounded-lg transition"
                >
                  <Pencil size={14} /> Editar
                </button>
                <button
                  onClick={() => eliminarComprobante(comprobanteDetalle.id)}
                  disabled={eliminandoComprobante}
                  className="flex-1 flex items-center justify-center gap-1.5 text-sm font-semibold text-red-700 bg-red-50 hover:bg-red-100 border border-red-200 px-3 py-2 rounded-lg transition disabled:opacity-50"
                >
                  <Trash2 size={14} /> {eliminandoComprobante ? "Eliminando..." : "Eliminar"}
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

      {/* Modal editar comprobante */}
      {comprobanteEditando && comprobanteEditForm && (
        <div
          className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4"
          onClick={e => { if (e.target === e.currentTarget) { setComprobanteEditando(null); setComprobanteEditForm(null); } }}
        >
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[92vh] overflow-y-auto">
            {/* Header */}
            <div className="flex items-center justify-between px-6 pt-5 pb-4 border-b">
              <div className="flex items-center gap-2">
                <Pencil size={18} className="text-blue-600" />
                <h2 className="text-lg font-bold text-gray-800">Editar comprobante</h2>
              </div>
              <button onClick={() => { setComprobanteEditando(null); setComprobanteEditForm(null); }} className="text-gray-400 hover:text-gray-600">
                <X size={20} />
              </button>
            </div>

            <div className="p-6 space-y-4">
              {/* Miembro (solo lectura) */}
              <div>
                <label className="text-xs font-semibold text-gray-600 mb-1 block">Miembro</label>
                <p className="text-sm font-medium text-gray-800 bg-gray-50 border border-gray-200 rounded-lg px-3 py-2">
                  {comprobanteEditando.miembro_apellido}, {comprobanteEditando.miembro_nombre}
                </p>
              </div>

              <div className="grid grid-cols-2 gap-4">
                {/* Concepto */}
                <div>
                  <label className="text-xs font-semibold text-gray-600 mb-1 block">Concepto *</label>
                  <select
                    value={comprobanteEditForm.concepto}
                    onChange={e => setComprobanteEditForm(p => ({ ...p, concepto: e.target.value }))}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
                  >
                    <option value="cuotas_diezmos">Cuotas / Diezmos</option>
                    <option value="otros">Otros</option>
                  </select>
                </div>

                {/* Tipo de pago */}
                <div>
                  <label className="text-xs font-semibold text-gray-600 mb-1 block">Tipo de pago *</label>
                  <select
                    value={comprobanteEditForm.tipo_pago}
                    onChange={e => setComprobanteEditForm(p => ({ ...p, tipo_pago: e.target.value }))}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
                  >
                    <option value="efectivo">Efectivo</option>
                    <option value="transferencia">Transferencia online</option>
                    <option value="deposito">Depósito en banco</option>
                  </select>
                </div>

                {/* Monto */}
                <div>
                  <label className="text-xs font-semibold text-gray-600 mb-1 block">Monto (CLP) *</label>
                  <input
                    type="number"
                    min="1"
                    value={comprobanteEditForm.monto}
                    onChange={e => setComprobanteEditForm(p => ({ ...p, monto: e.target.value }))}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
                  />
                </div>

                {/* Fecha */}
                <div>
                  <label className="text-xs font-semibold text-gray-600 mb-1 block">Fecha *</label>
                  <input
                    type="date"
                    value={comprobanteEditForm.fecha}
                    onChange={e => setComprobanteEditForm(p => ({ ...p, fecha: e.target.value }))}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
                  />
                </div>
              </div>

              {/* Mensaje */}
              <div>
                <label className="text-xs font-semibold text-gray-600 mb-1 block">Mensaje al miembro</label>
                <textarea
                  rows={5}
                  value={comprobanteEditForm.mensaje}
                  onChange={e => setComprobanteEditForm(p => ({ ...p, mensaje: e.target.value }))}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400 resize-none"
                />
              </div>

              {mensajeComprobante && (
                <p className={`text-sm font-medium ${mensajeComprobante.tipo === "error" ? "text-red-600" : "text-emerald-600"}`}>
                  {mensajeComprobante.texto}
                </p>
              )}

              <div className="flex gap-3 justify-end pt-2 border-t">
                <button
                  onClick={() => { setComprobanteEditando(null); setComprobanteEditForm(null); }}
                  className="px-4 py-2 rounded-lg text-sm font-semibold text-gray-600 bg-gray-100 hover:bg-gray-200 transition-colors"
                >
                  Cancelar
                </button>
                <button
                  onClick={guardarEditarComprobante}
                  disabled={guardandoComprobante}
                  className="px-5 py-2 rounded-lg text-sm font-semibold text-white bg-blue-600 hover:bg-blue-700 transition-colors disabled:opacity-60"
                >
                  {guardandoComprobante ? "Guardando..." : "Guardar cambios"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
