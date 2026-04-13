import React, { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import AdminNav from "../components/AdminNav";
import EditarMiembroModal from "../components/EditarMiembroModal";

const API = import.meta.env.VITE_BACKEND_URL;

const ROLES_DISPONIBLES = [
  "admin",
  "Pastor",
  "Obispo",
  "Diácono",
  "Tesorero",
  "Secretario",
  "Músico",
  "Líder de Alabanza",
  "Encargado de Ministerio",
  "Profesor",
  "Ujieres",
  "Voluntario",
  "Miembro",
  "Joven",
  "Adolescente",
  "Niño",
  "Dorca",
  "Coordinador/a",
  "Predicador/a",
];

const ESTADO_COLORES = {
  activo: "bg-green-100 text-green-800",
  inactivo: "bg-gray-100 text-gray-600",
  visita: "bg-yellow-100 text-yellow-800",
};

const FORM_INICIAL = {
  nombre: "",
  apellido: "",
  foto_url: "",
  fecha_nacimiento: "",
  celular: "",
  email: "",
  direccion: "",
  estado: "activo",
  notas: "",
  roles: [],
  bautizado: false,
  declaracion_fe: false,
  estado_civil: "",
  separado: false,
  nivel_discipulado: null,
  sexo: "",
};

const MESES = ["Enero","Febrero","Marzo","Abril","Mayo","Junio","Julio","Agosto","Septiembre","Octubre","Noviembre","Diciembre"];

const PARENTESCOS = [
  "cónyuge", "padre", "madre", "hijo", "hija",
  "hermano", "hermana", "abuelo", "abuela",
  "nieto", "nieta", "tío", "tía", "otro",
];

export default function AdminMiembros() {
  const { getToken } = useAuth();
  const navigate = useNavigate();
  const [miembros, setMiembros] = useState([]);
  const [loading, setLoading] = useState(true);
  const [busqueda, setBusqueda] = useState("");
  const [filtroEstado, setFiltroEstado] = useState("todos");
  const [filtroRol, setFiltroRol] = useState([]);
  const [filtroBautizado, setFiltroBautizado] = useState("todos");
  const [filtroDeclaracionFe, setFiltroDeclaracionFe] = useState("todos");
  const [filtroDiscipulado, setFiltroDiscipulado] = useState("todos");
  const [vistaActual, setVistaActual] = useState("lista");
  const [modalAbierto, setModalAbierto] = useState(false);
  const [miembroEditar, setMiembroEditar] = useState(null); // null = nuevo miembro

  // Estado modal familia
  const [modalFamilia, setModalFamilia] = useState(false);
  const [miembroFamiliaActual, setMiembroFamiliaActual] = useState(null);
  const [familias, setFamilias] = useState([]); // familias del miembro actual
  const [cargandoFamilia, setCargandoFamilia] = useState(false);
  const [nuevaFamiliaNombre, setNuevaFamiliaNombre] = useState("");
  const [parentescoSeleccionado, setParentescoSeleccionado] = useState("cónyuge");
  const [miembroParaAgregar, setMiembroParaAgregar] = useState("");
  const [familiaParaAgregar, setFamiliaParaAgregar] = useState(""); // id familia destino
  const [guardandoFamilia, setGuardandoFamilia] = useState(false);

  const headers = () => ({ Authorization: `Bearer ${getToken()}` });

  const cargar = async () => {
    try {
      const res = await fetch(`${API}/api/miembros`, { headers: headers() });
      const data = await res.json();
      setMiembros(Array.isArray(data) ? data : []);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { cargar(); }, []);

  const abrirNuevo = () => {
    setMiembroEditar(null);
    setModalAbierto(true);
  };

  const abrirEditar = (m) => {
    setMiembroEditar(m);
    setModalAbierto(true);
  };

  const cerrarModal = () => {
    setModalAbierto(false);
    setMiembroEditar(null);
  };

  const eliminar = async (id) => {
    if (!confirm("¿Eliminar este miembro? Esta acción no se puede deshacer.")) return;
    try {
      await fetch(`${API}/api/miembros/${id}`, { method: "DELETE", headers: headers() });
      setMiembros(prev => prev.filter(m => m.id !== id));
    } catch (e) {
      alert("Error al eliminar");
    }
  };

  // ---- LÓGICA FAMILIA ----
  const abrirModalFamilia = async (m) => {
    setMiembroFamiliaActual(m);
    setModalFamilia(true);
    setCargandoFamilia(true);
    setNuevaFamiliaNombre("");
    setMiembroParaAgregar("");
    setFamiliaParaAgregar("");
    try {
      const res = await fetch(`${API}/api/miembros/${m.id}/familia`, { headers: headers() });
      const data = await res.json();
      setFamilias(Array.isArray(data) ? data : []);
      if (data.length > 0) setFamiliaParaAgregar(String(data[0].id));
    } catch (e) {
      setFamilias([]);
    } finally {
      setCargandoFamilia(false);
    }
  };

  const cerrarModalFamilia = () => {
    setModalFamilia(false);
    setMiembroFamiliaActual(null);
    setFamilias([]);
  };

  const crearFamilia = async () => {
    if (!miembroFamiliaActual) return;
    setGuardandoFamilia(true);
    try {
      const res = await fetch(`${API}/api/familias`, {
        method: "POST",
        headers: { ...headers(), "Content-Type": "application/json" },
        body: JSON.stringify({
          nombre: nuevaFamiliaNombre.trim() || null,
          miembros: [{ miembro_id: miembroFamiliaActual.id, parentesco: "otro" }],
        }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || `Error ${res.status}`);
      }
      const nueva = await res.json();
      const famRes = await fetch(`${API}/api/miembros/${miembroFamiliaActual.id}/familia`, { headers: headers() });
      const data = await famRes.json();
      setFamilias(Array.isArray(data) ? data : []);
      setFamiliaParaAgregar(String(nueva.id));
      setNuevaFamiliaNombre("");
    } catch (e) {
      alert(`Error al crear familia: ${e.message}`);
    } finally {
      setGuardandoFamilia(false);
    }
  };

  const agregarMiembroFamilia = async (familiaId) => {
    if (!familiaId || !miembroParaAgregar) return;
    setGuardandoFamilia(true);
    try {
      const res = await fetch(`${API}/api/familias/${familiaId}/miembros`, {
        method: "POST",
        headers: { ...headers(), "Content-Type": "application/json" },
        body: JSON.stringify({ miembro_id: parseInt(miembroParaAgregar), parentesco: parentescoSeleccionado }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || `Error ${res.status}`);
      }
      const famRes = await fetch(`${API}/api/miembros/${miembroFamiliaActual.id}/familia`, { headers: headers() });
      const data = await famRes.json();
      setFamilias(Array.isArray(data) ? data : []);
      setMiembroParaAgregar("");
    } catch (e) {
      alert(`Error al agregar miembro: ${e.message}`);
    } finally {
      setGuardandoFamilia(false);
    }
  };

  const quitarDeFamilia = async (familiaId, miembroId) => {
    if (!confirm("¿Quitar este miembro del grupo familiar?")) return;
    try {
      await fetch(`${API}/api/familias/${familiaId}/miembros/${miembroId}`, {
        method: "DELETE", headers: headers(),
      });
      setFamilias(prev => prev.map(f =>
        f.id === familiaId
          ? { ...f, miembros: f.miembros.filter(m => m.miembro_id !== miembroId) }
          : f
      ).filter(f => f.miembros.length > 0));
    } catch (e) {
      alert("Error al quitar miembro");
    }
  };

  const eliminarFamilia = async (familiaId) => {
    if (!confirm("¿Eliminar este grupo familiar? Los miembros no serán eliminados.")) return;
    try {
      await fetch(`${API}/api/familias/${familiaId}`, { method: "DELETE", headers: headers() });
      setFamilias(prev => prev.filter(f => f.id !== familiaId));
    } catch (e) {
      alert("Error al eliminar familia");
    }
  };
  // ---- FIN LÓGICA FAMILIA ----

  const miembrosFiltrados = miembros.filter(m => {
    const nombre = `${m.nombre} ${m.apellido}`.toLowerCase();
    const coincideBusqueda = nombre.includes(busqueda.toLowerCase()) ||
      (m.email || "").toLowerCase().includes(busqueda.toLowerCase()) ||
      (m.celular || "").includes(busqueda);
    const coincideEstado = filtroEstado === "todos" || m.estado === filtroEstado;
    const coincideRol = filtroRol.length === 0 || filtroRol.every(r => (m.roles || []).includes(r));
    const coincideBautizado = filtroBautizado === "todos" || (filtroBautizado === "si" ? m.bautizado : !m.bautizado);
    const coincideDeclaracion = filtroDeclaracionFe === "todos" || (filtroDeclaracionFe === "si" ? m.declaracion_fe : !m.declaracion_fe);
    const coincideDiscipulado = filtroDiscipulado === "todos" || String(m.nivel_discipulado) === filtroDiscipulado;
    return coincideBusqueda && coincideEstado && coincideRol && coincideBautizado && coincideDeclaracion && coincideDiscipulado;
  });

  const cumpleaniosPorMes = React.useMemo(() => {
    const hoy = new Date();
    const diaHoy = hoy.getDate();
    const mesHoy = hoy.getMonth();
    const grupos = Array.from({ length: 12 }, (_, i) => ({ mes: i, nombre: MESES[i], miembros: [] }));
    miembros.forEach(m => {
      if (!m.fecha_nacimiento) return;
      const f = new Date(m.fecha_nacimiento);
      const mes = f.getUTCMonth();
      const dia = f.getUTCDate();
      const edad = hoy.getFullYear() - f.getUTCFullYear() -
        (mesHoy < mes || (mesHoy === mes && diaHoy < dia) ? 1 : 0);
      const esCumpleHoy = mes === mesHoy && dia === diaHoy;
      const diff = (mes * 31 + dia) - (mesHoy * 31 + diaHoy);
      const esCumpleProximo = diff > 0 && diff <= 10;
      grupos[mes].miembros.push({ ...m, dia, edad, esCumpleHoy, esCumpleProximo });
    });
    grupos.forEach(g => g.miembros.sort((a, b) => a.dia - b.dia));
    return grupos;
  }, [miembros]);

  const idxActual = miembroEditar ? miembrosFiltrados.findIndex(m => m.id === miembroEditar.id) : -1;
  const navAnterior = () => { if (idxActual > 0) abrirEditar(miembrosFiltrados[idxActual - 1]); };
  const navSiguiente = () => { if (idxActual < miembrosFiltrados.length - 1) abrirEditar(miembrosFiltrados[idxActual + 1]); };

  const calcularEdad = (fechaNac) => {
    if (!fechaNac) return null;
    const hoy = new Date();
    const nac = new Date(fechaNac);
    let edad = hoy.getFullYear() - nac.getFullYear();
    const m = hoy.getMonth() - nac.getMonth();
    if (m < 0 || (m === 0 && hoy.getDate() < nac.getDate())) edad--;
    return edad;
  };

  const generarPDF = async () => {
    const { jsPDF } = await import("jspdf");

    const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });

    const PAGE_W = 210;
    const PAGE_H = 297;
    const M = 12;                         // margen lateral
    const W = PAGE_W - 2 * M;            // 186mm
    const HEADER_H = 14;                  // altura cabecera de página
    const FOOTER_H = 8;
    const FICHAS = 3;                     // fichas por página
    const FICHA_H = (PAGE_H - HEADER_H - FOOTER_H) / FICHAS; // ~91mm cada una
    const FIELD_H = 9;                    // altura por campo
    const HALF = W / 2 - 2;              // ancho de cada columna de campos

    // Paleta
    const C_VIOLET    = [109,  40, 217];
    const C_V_LIGHT   = [237, 233, 254];
    const C_GOLD      = [217, 119,   6];
    const C_GRAY      = [107, 114, 128];
    const C_LINE      = [209, 213, 219];
    const C_WHITE     = [255, 255, 255];
    const C_TEXT      = [ 30,  30,  30];

    const fmt = (d) => d ? new Date(d).toLocaleDateString("es-CL") : "";
    const edad = (d) => {
      if (!d) return "";
      const hoy = new Date(), n = new Date(d);
      let e = hoy.getFullYear() - n.getFullYear();
      if (hoy.getMonth() - n.getMonth() < 0 || (hoy.getMonth() === n.getMonth() && hoy.getDate() < n.getDate())) e--;
      return `${e} años`;
    };

    const truncate = (str, maxW, doc, size) => {
      if (!str) return "";
      doc.setFontSize(size);
      while (str.length > 1 && doc.getStringUnitWidth(str) * size / doc.internal.scaleFactor > maxW) {
        str = str.slice(0, -1);
      }
      return str.length < (str + "...").length ? str : str;
    };

    // --- Cabecera de página ---
    const drawPageHeader = () => {
      doc.setFillColor(...C_VIOLET);
      doc.rect(0, 0, PAGE_W, 9, "F");
      doc.setFont("helvetica", "bold");
      doc.setFontSize(11);
      doc.setTextColor(...C_WHITE);
      doc.text("TEMPLO VIDA NUEVA  —  DIRECTORIO DE MIEMBROS", PAGE_W / 2, 6.5, { align: "center" });

      doc.setFont("helvetica", "normal");
      doc.setFontSize(7.5);
      doc.setTextColor(...C_GRAY);
      doc.text(
        `Generado el ${new Date().toLocaleDateString("es-CL")}  ·  Total: ${miembros.length} miembros`,
        PAGE_W / 2, 12, { align: "center" }
      );
    };

    // --- Ficha individual ---
    const drawFicha = (m, fy) => {
      const fh = FICHA_H - 4;

      // Borde
      doc.setDrawColor(...C_LINE);
      doc.setLineWidth(0.25);
      doc.roundedRect(M, fy, W, fh, 3, 3, "S");

      // Header ficha
      doc.setFillColor(...C_V_LIGHT);
      doc.roundedRect(M, fy, W, 10, 3, 3, "F");
      doc.rect(M, fy + 5, W, 5, "F"); // cuadrar esquinas inferiores

      doc.setFont("helvetica", "bold");
      doc.setFontSize(10.5);
      doc.setTextColor(...C_VIOLET);
      const nombreCompleto = `${m.nombre} ${m.apellido}`.toUpperCase();
      doc.text(nombreCompleto, M + 4, fy + 7);

      // Badge estado
      const BADGE_COLORS = {
        activo:   { bg: [209, 250, 229], text: [6, 95, 70] },
        inactivo: { bg: [229, 231, 235], text: [75, 85, 99] },
        visita:   { bg: [254, 249, 195], text: [92, 77, 6] },
      };
      const bc = BADGE_COLORS[m.estado] || BADGE_COLORS.inactivo;
      doc.setFillColor(...bc.bg);
      doc.roundedRect(M + W - 28, fy + 2.5, 26, 5.5, 2, 2, "F");
      doc.setFont("helvetica", "bold");
      doc.setFontSize(7.5);
      doc.setTextColor(...bc.text);
      doc.text((m.estado || "activo").toUpperCase(), M + W - 15, fy + 6.5, { align: "center" });

      // Campos
      const y0 = fy + 13;
      const L  = M + 3;         // columna izquierda
      const R  = M + W / 2 + 1; // columna derecha

      const drawField = (label, value, x, y, w) => {
        doc.setFont("helvetica", "bold");
        doc.setFontSize(6.5);
        doc.setTextColor(...C_GRAY);
        doc.text(label.toUpperCase(), x, y);

        doc.setFont("helvetica", "normal");
        doc.setFontSize(9);
        doc.setTextColor(...C_TEXT);
        const v = truncate(value || "", w - 3, doc, 9);
        doc.text(v, x, y + 4.5);

        doc.setDrawColor(...C_LINE);
        doc.setLineWidth(0.2);
        doc.line(x, y + 5.5, x + w - 1, y + 5.5);
      };

      // Columna izquierda
      drawField("Nombre Completo",     `${m.nombre} ${m.apellido}`,    L, y0,                   HALF);
      drawField("Fecha de Nacimiento", fmt(m.fecha_nacimiento),         L, y0 + FIELD_H,         HALF);
      drawField("Edad",                edad(m.fecha_nacimiento),        L, y0 + FIELD_H * 2,     HALF);
      drawField("Celular",             m.celular || "",                  L, y0 + FIELD_H * 3,     HALF);
      drawField("Email",               m.email || "",                   L, y0 + FIELD_H * 4,     HALF);
      drawField("Dirección",           m.direccion || "",               L, y0 + FIELD_H * 5,     HALF);

      // Columna derecha
      drawField("Estado Civil",        m.estado_civil || "",            R, y0,                   HALF);
      drawField("Bautizado/a",         m.bautizado ? "Sí" : "",        R, y0 + FIELD_H,         HALF);
      drawField("Declaración de Fe",   m.declaracion_fe ? "Sí" : "",   R, y0 + FIELD_H * 2,     HALF);
      drawField("Nivel Discipulado",   m.nivel_discipulado != null ? String(m.nivel_discipulado) : "", R, y0 + FIELD_H * 3, HALF);
      drawField("Roles",               (m.roles || []).join(", "),      R, y0 + FIELD_H * 4,     HALF);
      drawField("Notas",               m.notas || "",                   R, y0 + FIELD_H * 5,     HALF);
    };

    // --- Generar páginas ---
    let pageCount = 0;

    miembros.forEach((m, i) => {
      const fichaIdx = i % FICHAS;
      if (fichaIdx === 0) {
        if (pageCount > 0) doc.addPage();
        pageCount++;
        drawPageHeader();
      }
      const fichaY = HEADER_H + fichaIdx * FICHA_H;
      drawFicha(m, fichaY);
    });

    // Números de página
    const nPages = doc.getNumberOfPages();
    for (let p = 1; p <= nPages; p++) {
      doc.setPage(p);
      doc.setFont("helvetica", "normal");
      doc.setFontSize(7);
      doc.setTextColor(...C_GRAY);
      doc.text(`Página ${p} de ${nPages}`, PAGE_W - M, PAGE_H - 4, { align: "right" });
    }

    const fecha = new Date().toISOString().split("T")[0];
    doc.save(`directorio-miembros-${fecha}.pdf`);
  };

  const generarFormularioVacio = async () => {
    const { jsPDF } = await import("jspdf");

    const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
    const PAGE_W = 210;
    const PAGE_H = 297;
    const M = 14;
    const W = PAGE_W - 2 * M;

    const C_VIOLET  = [109,  40, 217];
    const C_V_LIGHT = [237, 233, 254];
    const C_GOLD    = [217, 119,   6];
    const C_GRAY    = [107, 114, 128];
    const C_LINE    = [180, 190, 210];
    const C_WHITE   = [255, 255, 255];
    const C_TEXT    = [ 30,  30,  30];

    // ---- Cabecera ----
    doc.setFillColor(...C_VIOLET);
    doc.rect(0, 0, PAGE_W, 22, "F");

    doc.setFont("helvetica", "bold");
    doc.setFontSize(14);
    doc.setTextColor(...C_WHITE);
    doc.text("TEMPLO VIDA NUEVA", PAGE_W / 2, 9, { align: "center" });

    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    doc.setTextColor(220, 210, 255);
    doc.text("Ficha de Registro de Nuevo Miembro", PAGE_W / 2, 16, { align: "center" });

    // Línea dorada decorativa
    doc.setFillColor(...C_GOLD);
    doc.rect(0, 22, PAGE_W, 1.5, "F");

    // ---- Foto (recuadro) ----
    const FOTO_X = M;
    const FOTO_Y = 27;
    const FOTO_W = 35;
    const FOTO_H = 42;
    doc.setDrawColor(...C_LINE);
    doc.setLineWidth(0.4);
    doc.rect(FOTO_X, FOTO_Y, FOTO_W, FOTO_H, "S");
    doc.setFont("helvetica", "normal");
    doc.setFontSize(7);
    doc.setTextColor(...C_GRAY);
    doc.text("Foto", FOTO_X + FOTO_W / 2, FOTO_Y + FOTO_H / 2, { align: "center" });

    // ---- Sección datos personales a la derecha de la foto ----
    const DX = M + FOTO_W + 5;  // X inicio columna de campos
    const DW = W - FOTO_W - 5;  // ancho disponible
    const HALF = DW / 2 - 3;

    let y = FOTO_Y + 3;
    const LINE_H = 11;

    const field = (label, x, fy, w) => {
      doc.setFont("helvetica", "bold");
      doc.setFontSize(6);
      doc.setTextColor(...C_GRAY);
      doc.text(label.toUpperCase(), x, fy);
      doc.setDrawColor(...C_LINE);
      doc.setLineWidth(0.25);
      doc.line(x, fy + 6, x + w, fy + 6);
    };

    field("Nombre", DX, y, HALF);
    field("Apellido", DX + HALF + 3, y, HALF);
    y += LINE_H;
    field("Fecha de Nacimiento", DX, y, HALF);
    field("Estado Civil", DX + HALF + 3, y, HALF);
    y += LINE_H;
    field("RUT / DNI", DX, y, HALF);
    field("Celular / Teléfono", DX + HALF + 3, y, HALF);
    y += LINE_H;
    field("Email", DX, y, DW);

    // A partir de aquí a todo el ancho (debajo de la foto también)
    y = Math.max(y + LINE_H, FOTO_Y + FOTO_H + 4);

    // Separador de sección
    const seccion = (titulo, sy) => {
      doc.setFillColor(...C_V_LIGHT);
      doc.rect(M, sy, W, 7, "F");
      doc.setFont("helvetica", "bold");
      doc.setFontSize(7.5);
      doc.setTextColor(...C_VIOLET);
      doc.text(titulo.toUpperCase(), M + 3, sy + 5);
      return sy + 10;
    };

    y = seccion("Datos de Contacto y Residencia", y);
    field("Dirección", M, y, W);
    y += LINE_H;
    field("Ciudad", M, y, W / 2 - 2);
    field("Región / País", M + W / 2 + 2, y, W / 2 - 2);
    y += LINE_H + 2;

    y = seccion("Familia", y);
    field("Nombre del Cónyuge", M, y, W / 2 - 2);
    field("N° de Hijos", M + W / 2 + 2, y, W / 2 - 2);
    y += LINE_H + 2;

    y = seccion("Datos Espirituales", y);
    // Checks
    const CHECK_FIELDS = [
      "Bautizado/a en Agua",
      "Declaración de Fe",
    ];
    const cw = W / CHECK_FIELDS.length;
    CHECK_FIELDS.forEach((cf, i) => {
      const cx = M + i * cw;
      doc.setDrawColor(...C_LINE);
      doc.setLineWidth(0.3);
      doc.rect(cx, y, 4, 4, "S");
      doc.setFont("helvetica", "normal");
      doc.setFontSize(7.5);
      doc.setTextColor(...C_TEXT);
      doc.text(cf, cx + 6, y + 3.5);
    });
    y += 10;

    field("Nivel de Discipulado (1-5)", M, y, W / 3 - 5);
    field("Fecha de Ingreso a la Iglesia", M + W / 3 + 2, y, W / 3 - 5);
    field("Roles / Ministerio", M + (W / 3) * 2 + 4, y, W / 3 - 5);
    y += LINE_H + 2;

    y = seccion("Notas y Observaciones", y);
    doc.setDrawColor(...C_LINE);
    doc.setLineWidth(0.2);
    for (let i = 0; i < 4; i++) {
      doc.line(M, y + i * 9, M + W, y + i * 9);
    }
    y += 4 * 9 + 4;

    // ---- Pie de firma ----
    const FY = PAGE_H - 28;
    doc.setFillColor(...C_V_LIGHT);
    doc.rect(M, FY, W, 18, "F");

    const FW = W / 3 - 4;
    const labels = ["Firma del Miembro", "Registrado por (Secretaría)", "Fecha de Registro"];
    labels.forEach((l, i) => {
      const fx = M + 2 + i * (W / 3);
      doc.setDrawColor(...C_LINE);
      doc.setLineWidth(0.2);
      doc.line(fx, FY + 12, fx + FW, FY + 12);
      doc.setFont("helvetica", "normal");
      doc.setFontSize(6.5);
      doc.setTextColor(...C_GRAY);
      doc.text(l, fx + FW / 2, FY + 15.5, { align: "center" });
    });

    // Número de serie / folio
    doc.setFont("helvetica", "normal");
    doc.setFontSize(6);
    doc.setTextColor(...C_GRAY);
    doc.text(`Folio Nº _______  ·  Para uso interno`, PAGE_W - M, PAGE_H - 4, { align: "right" });

    doc.save("formulario-nuevo-miembro.pdf");
  };

  return (
    <>
      <AdminNav />
      <div className="p-6 max-w-7xl mx-auto">
        {/* Encabezado */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
          <div>
            <h1 className="text-3xl font-bold text-gray-800">Miembros</h1>
            <p className="text-gray-500 mt-1">{miembros.length} miembro{miembros.length !== 1 ? "s" : ""} registrado{miembros.length !== 1 ? "s" : ""}</p>
          </div>
          <div className="flex gap-3 flex-wrap">
            <button
              onClick={generarFormularioVacio}
              className="bg-amber-500 hover:bg-amber-600 text-white font-semibold py-2 px-5 rounded-lg transition flex items-center gap-2"
            >
              <span>📋</span> Ficha en Blanco
            </button>
            <button
              onClick={generarPDF}
              disabled={miembros.length === 0}
              className="bg-violet-600 hover:bg-violet-700 disabled:opacity-50 text-white font-semibold py-2 px-5 rounded-lg transition flex items-center gap-2"
            >
              <span>📄</span> Exportar PDF
            </button>
            <button
              onClick={abrirNuevo}
              className="bg-blue-600 hover:bg-blue-700 text-white font-semibold py-2 px-5 rounded-lg transition flex items-center gap-2"
            >
              <span className="text-xl leading-none">+</span> Nuevo Miembro
            </button>
          </div>
        </div>

        {/* Tabs vista */}
        <div className="flex gap-2 mb-5">
          <button
            onClick={() => setVistaActual("lista")}
            className={`px-4 py-2 rounded-lg text-sm font-semibold transition ${
              vistaActual === "lista"
                ? "bg-blue-600 text-white shadow"
                : "bg-white border border-gray-300 text-gray-600 hover:bg-gray-50"
            }`}
          >
            👥 Lista de Miembros
          </button>
          <button
            onClick={() => setVistaActual("cumpleanios")}
            className={`px-4 py-2 rounded-lg text-sm font-semibold transition ${
              vistaActual === "cumpleanios"
                ? "bg-pink-600 text-white shadow"
                : "bg-white border border-gray-300 text-gray-600 hover:bg-gray-50"
            }`}
          >
            🎂 Cumpleaños
          </button>
        </div>

        {/* Filtros (solo en vista lista) */}
        {vistaActual === "lista" && (
          <div className="flex flex-col gap-3 mb-6">
            <div className="flex flex-col md:flex-row gap-3">
              <input
                type="text"
                placeholder="Buscar por nombre, email o teléfono..."
                value={busqueda}
                onChange={e => setBusqueda(e.target.value)}
                className="border rounded-lg px-4 py-2 flex-1 focus:outline-none focus:ring-2 focus:ring-blue-400"
              />
              <select
                value={filtroEstado}
                onChange={e => setFiltroEstado(e.target.value)}
                className="border rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-blue-400"
              >
                <option value="todos">Todos los estados</option>
                <option value="activo">Activo</option>
                <option value="inactivo">Inactivo</option>
                <option value="visita">Visita</option>
              </select>
              <select
                value={filtroDiscipulado}
                onChange={e => setFiltroDiscipulado(e.target.value)}
                className="border rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-blue-400"
              >
                <option value="todos">Todos los niveles</option>
                <option value="1">Nivel 1 — Fundamentos</option>
                <option value="2">Nivel 2 — Crecimiento</option>
                <option value="3">Nivel 3 — Servicio</option>
                <option value="4">Nivel 4 — Liderazgo</option>
              </select>
            </div>
            {/* Chips de roles */}
            <div className="flex flex-wrap gap-1.5 items-center">
              <span className="text-sm text-gray-500 font-medium mr-1">Roles:</span>
              {ROLES_DISPONIBLES.map(r => (
                <button
                  key={r}
                  onClick={() => setFiltroRol(prev => prev.includes(r) ? prev.filter(x => x !== r) : [...prev, r])}
                  className={`px-3 py-1 rounded-full text-xs font-medium border transition ${
                    filtroRol.includes(r)
                      ? "bg-blue-600 text-white border-blue-600"
                      : "bg-white text-gray-600 border-gray-300 hover:border-blue-400"
                  }`}
                >
                  {r}
                </button>
              ))}
              {filtroRol.length > 0 && (
                <button onClick={() => setFiltroRol([])} className="text-xs text-red-400 hover:text-red-600 underline ml-1">Limpiar</button>
              )}
            </div>
            <div className="flex flex-wrap gap-3 items-center">
              <span className="text-sm text-gray-500 font-medium">Filtros espirituales:</span>
              {/* Bautismo */}
              <div className="flex rounded-lg border border-gray-300 overflow-hidden text-sm">
                {[["todos","Todos"],["si","💧 Bautizados"],["no","No bautizados"]].map(([val, label]) => (
                  <button
                    key={val}
                    onClick={() => setFiltroBautizado(val)}
                    className={`px-3 py-1.5 font-medium transition ${
                      filtroBautizado === val
                        ? "bg-sky-600 text-white"
                        : "bg-white text-gray-600 hover:bg-gray-50"
                    }`}
                  >
                    {label}
                  </button>
                ))}
              </div>
              {/* Declaración de Fe */}
              <div className="flex rounded-lg border border-gray-300 overflow-hidden text-sm">
                {[["todos","Todos"],["si","✝️ Con declaración"],["no","Sin declaración"]].map(([val, label]) => (
                  <button
                    key={val}
                    onClick={() => setFiltroDeclaracionFe(val)}
                    className={`px-3 py-1.5 font-medium transition ${
                      filtroDeclaracionFe === val
                        ? "bg-amber-500 text-white"
                        : "bg-white text-gray-600 hover:bg-gray-50"
                    }`}
                  >
                    {label}
                  </button>
                ))}
              </div>
              {(filtroBautizado !== "todos" || filtroDeclaracionFe !== "todos" || filtroDiscipulado !== "todos" || filtroRol.length > 0) && (
                <button
                  onClick={() => { setFiltroBautizado("todos"); setFiltroDeclaracionFe("todos"); setFiltroDiscipulado("todos"); setFiltroRol([]); }}
                  className="text-xs text-red-400 hover:text-red-600 underline"
                >
                  Limpiar filtros
                </button>
              )}
              <span className="ml-auto text-sm text-gray-400">{miembrosFiltrados.length} resultado{miembrosFiltrados.length !== 1 ? "s" : ""}</span>
            </div>
          </div>
        )}

        {/* Vista Cumpleaños */}
        {vistaActual === "cumpleanios" && (
          <div className="space-y-6">
            {(() => {
              const hoy = new Date();
              const mesHoy = hoy.getMonth();
              const orden = Array.from({ length: 12 }, (_, i) => (mesHoy + i) % 12);
              const conMiembros = orden.filter(i => cumpleaniosPorMes[i].miembros.length > 0);
              if (conMiembros.length === 0) return (
                <div className="text-center py-20 text-gray-400">Ningún miembro tiene fecha de nacimiento registrada.</div>
              );
              return orden.map(i => {
                const grupo = cumpleaniosPorMes[i];
                if (grupo.miembros.length === 0) return null;
                const esMesActual = i === mesHoy;
                return (
                  <div key={i} className={`rounded-xl overflow-hidden shadow-sm border ${
                    esMesActual ? "border-pink-300 ring-2 ring-pink-200" : "border-gray-200"
                  }`}>
                    <div className={`px-5 py-3 flex items-center gap-2 ${
                      esMesActual ? "bg-pink-600 text-white" : "bg-gray-100 text-gray-700"
                    }`}>
                      <span className="text-lg">{esMesActual ? "🎂" : "📅"}</span>
                      <h3 className="font-bold text-base tracking-wide">{grupo.nombre.toUpperCase()}</h3>
                      <span className={`ml-auto text-xs font-medium px-2 py-0.5 rounded-full ${
                        esMesActual ? "bg-white/20 text-white" : "bg-gray-300 text-gray-600"
                      }`}>
                        {grupo.miembros.length} cumpleaños
                      </span>
                    </div>
                    <div className="bg-white divide-y">
                      {grupo.miembros.map(m => (
                        <div key={m.id} className={`flex items-center gap-3 px-5 py-3 ${
                          m.esCumpleHoy ? "bg-pink-50" : m.esCumpleProximo ? "bg-amber-50" : ""
                        }`}>
                          {m.foto_url ? (
                            <img src={m.foto_url} alt={m.nombre} className="w-10 h-10 rounded-full object-cover flex-shrink-0" />
                          ) : (
                            <div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center flex-shrink-0">
                              <span className="text-blue-600 font-bold text-sm">{m.nombre[0]}{m.apellido[0]}</span>
                            </div>
                          )}
                          <div className="flex-1 min-w-0">
                            <button
                              onClick={() => navigate(`/admin/miembros/${m.id}`)}
                              className="font-semibold text-gray-800 hover:text-blue-700 transition text-sm"
                            >
                              {m.nombre} {m.apellido}
                            </button>
                            <p className="text-xs text-gray-400">{m.celular || m.email || ""}</p>
                          </div>
                          <div className="text-right shrink-0">
                            <p className={`text-sm font-bold ${
                              m.esCumpleHoy ? "text-pink-600" : "text-gray-700"
                            }`}>
                              {m.esCumpleHoy ? "🎉 ¡Hoy!" : `${m.dia} de ${grupo.nombre}`}
                            </p>
                            <p className="text-xs text-gray-400">{m.edad} años</p>
                          </div>
                          {m.esCumpleProximo && !m.esCumpleHoy && (
                            <span className="text-xs bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full font-medium shrink-0">Próximo</span>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                );
              });
            })()}
          </div>
        )}

        {/* Tabla */}
        {vistaActual === "lista" && loading ? (
          <div className="text-center py-20 text-gray-500">Cargando miembros...</div>
        ) : vistaActual === "lista" && miembrosFiltrados.length === 0 ? (
          <div className="text-center py-20 text-gray-400">
            {miembros.length === 0 ? "No hay miembros registrados aún." : "No se encontraron resultados."}
          </div>
        ) : vistaActual === "lista" ? (
          <div className="overflow-x-auto rounded-xl shadow">
            <table className="w-full text-left bg-white">
              <thead className="bg-gray-100 text-gray-600 text-sm uppercase">
                <tr>
                  <th className="px-4 py-3">Miembro</th>
                  <th className="px-4 py-3 hidden md:table-cell">Contacto</th>
                  <th className="px-4 py-3 hidden lg:table-cell">Roles</th>
                  <th className="px-4 py-3 hidden lg:table-cell">Edad</th>
                  <th className="px-4 py-3">Estado</th>
                  <th className="px-4 py-3 text-center">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {miembrosFiltrados.map(m => (
                  <tr key={m.id} className="hover:bg-gray-50 transition">
                    <td className="px-4 py-3">
                      <button
                        onClick={() => navigate(`/admin/miembros/${m.id}`)}
                        className="flex items-center gap-3 text-left hover:opacity-80 transition group"
                      >
                        {m.foto_url ? (
                          <img
                            src={m.foto_url}
                            alt={m.nombre}
                            className="w-10 h-10 rounded-full object-cover flex-shrink-0 ring-2 ring-transparent group-hover:ring-blue-400 transition"
                          />
                        ) : (
                          <div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center flex-shrink-0 ring-2 ring-transparent group-hover:ring-blue-400 transition">
                            <span className="text-blue-600 font-bold text-sm">
                              {m.nombre[0]}{m.apellido[0]}
                            </span>
                          </div>
                        )}
                        <div>
                          <p className="font-semibold text-gray-800 group-hover:text-blue-700 transition">{m.nombre} {m.apellido}</p>
                          {m.email && <p className="text-xs text-gray-400 md:hidden">{m.email}</p>}
                        </div>
                      </button>
                    </td>
                    <td className="px-4 py-3 hidden md:table-cell">
                      <p className="text-sm text-gray-700">{m.email || "—"}</p>
                      <p className="text-xs text-gray-400">{m.celular || ""}</p>
                    </td>
                    <td className="px-4 py-3 hidden lg:table-cell">
                      <div className="flex flex-wrap gap-1">
                        {(m.roles || []).slice(0, 3).map(r => (
                          <button
                            key={r}
                            onClick={e => { e.stopPropagation(); setFiltroRol(prev => prev.includes(r) ? prev.filter(x => x !== r) : [...prev, r]); }}
                            className={`text-xs px-2 py-0.5 rounded-full transition ${filtroRol.includes(r) ? "bg-blue-600 text-white" : "bg-blue-50 text-blue-700 hover:bg-blue-100"}`}
                            title={filtroRol.includes(r) ? "Quitar filtro" : `Filtrar por "${r}"`}
                          >
                            {r}
                          </button>
                        ))}
                        {(m.roles || []).length > 3 && (
                          <span className="text-xs text-gray-400">+{m.roles.length - 3}</span>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-3 hidden lg:table-cell text-sm text-gray-600">
                      {calcularEdad(m.fecha_nacimiento) !== null ? `${calcularEdad(m.fecha_nacimiento)} años` : "—"}
                    </td>
                    <td className="px-4 py-3">
                      <span className={`text-xs font-semibold px-2 py-1 rounded-full capitalize ${ESTADO_COLORES[m.estado] || "bg-gray-100 text-gray-600"}`}>
                        {m.estado}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-center">
                      <div className="flex justify-center gap-2 flex-wrap">
                        <button
                          onClick={() => abrirModalFamilia(m)}
                          className="text-xs bg-green-100 text-green-700 px-3 py-1.5 rounded hover:bg-green-200 transition font-medium"
                        >
                          👨‍👩‍👧 Familia
                        </button>
                        <button
                          onClick={() => abrirEditar(m)}
                          className="text-xs bg-amber-100 text-amber-700 px-3 py-1.5 rounded hover:bg-amber-200 transition font-medium"
                        >
                          Editar
                        </button>
                        <button
                          onClick={() => eliminar(m.id)}
                          className="text-xs bg-red-100 text-red-600 px-3 py-1.5 rounded hover:bg-red-200 transition font-medium"
                        >
                          Eliminar
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : null}
      </div>

      {/* Modal editar/crear miembro (componente compartido) */}
      {modalAbierto && (
        <EditarMiembroModal
          key={miembroEditar?.id ?? "nuevo"}
          miembro={miembroEditar}
          onClose={cerrarModal}
          onGuardado={cargar}
          navAnterior={miembroEditar ? navAnterior : undefined}
          navSiguiente={miembroEditar ? navSiguiente : undefined}
          navLabel={miembroEditar ? `${idxActual + 1} / ${miembrosFiltrados.length}` : undefined}
          navDisablePrev={idxActual <= 0}
          navDisableNext={idxActual >= miembrosFiltrados.length - 1}
        />
      )}
      {/* Modal familia */}
      {modalFamilia && miembroFamiliaActual && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-end sm:items-center justify-center">
          <div className="bg-white rounded-t-2xl sm:rounded-2xl shadow-2xl w-full sm:max-w-2xl max-h-[92vh] flex flex-col">
            <div className="flex items-center justify-between p-6 border-b shrink-0">
              <div>
                <h2 className="text-xl font-bold text-gray-800">
                  Familia de {miembroFamiliaActual.nombre} {miembroFamiliaActual.apellido}
                </h2>
                <p className="text-sm text-gray-400 mt-0.5">Grupos familiares asociados</p>
              </div>
              <button onClick={cerrarModalFamilia} className="text-gray-400 hover:text-gray-600 text-2xl leading-none">&times;</button>
            </div>

            <div className="p-6 space-y-6 overflow-y-auto flex-1">
              {cargandoFamilia ? (
                <p className="text-center text-gray-400 py-8">Cargando...</p>
              ) : (
                <>
                  {/* Familias existentes */}
                  {familias.length === 0 ? (
                    <p className="text-center text-gray-400 py-4">Este miembro no pertenece a ningún grupo familiar aún.</p>
                  ) : (
                    familias.map(familia => (
                      <div key={familia.id} className="border rounded-xl p-4">
                        <div className="flex justify-between items-center mb-3">
                          <h3 className="font-semibold text-gray-700">
                            {familia.nombre || `Grupo familiar #${familia.id}`}
                          </h3>
                          <button
                            onClick={() => eliminarFamilia(familia.id)}
                            className="text-xs text-red-500 hover:text-red-700"
                          >
                            Eliminar grupo
                          </button>
                        </div>
                        <div className="space-y-2">
                          {familia.miembros.map(rel => (
                            <div key={rel.miembro_id} className="flex items-center justify-between bg-gray-50 rounded-lg px-3 py-2">
                              <div className="flex items-center gap-3">
                                {rel.foto_url ? (
                                  <img src={rel.foto_url} alt={rel.nombre} className="w-8 h-8 rounded-full object-cover" />
                                ) : (
                                  <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center text-xs font-bold text-blue-600">
                                    {rel.nombre?.[0]}{rel.apellido?.[0]}
                                  </div>
                                )}
                                <div>
                                  <p className="text-sm font-medium text-gray-800">{rel.nombre} {rel.apellido}</p>
                                  <p className="text-xs text-gray-400 capitalize">{rel.parentesco}</p>
                                </div>
                              </div>
                              {rel.miembro_id !== miembroFamiliaActual.id && (
                                <button
                                  onClick={() => quitarDeFamilia(familia.id, rel.miembro_id)}
                                  className="text-xs text-red-400 hover:text-red-600 ml-2"
                                >
                                  ✕
                                </button>
                              )}
                            </div>
                          ))}
                        </div>

                        {/* Agregar miembro a esta familia */}
                        <div className="mt-3 pt-3 border-t">
                          <p className="text-xs font-semibold text-gray-500 mb-2">Agregar integrante a este grupo</p>
                          <div className="flex gap-2 flex-wrap">
                            <select
                              value={familiaParaAgregar === String(familia.id) ? miembroParaAgregar : ""}
                              onChange={e => { setFamiliaParaAgregar(String(familia.id)); setMiembroParaAgregar(e.target.value); }}
                              className="border rounded-lg px-2 py-1.5 text-sm flex-1 min-w-0 focus:outline-none focus:ring-2 focus:ring-blue-300"
                            >
                              <option value="">— Seleccionar miembro —</option>
                              {miembros
                                .filter(m => !familia.miembros.some(r => r.miembro_id === m.id))
                                .map(m => (
                                  <option key={m.id} value={m.id}>{m.nombre} {m.apellido}</option>
                                ))}
                            </select>
                            <select
                              value={familiaParaAgregar === String(familia.id) ? parentescoSeleccionado : "cónyuge"}
                              onChange={e => { setFamiliaParaAgregar(String(familia.id)); setParentescoSeleccionado(e.target.value); }}
                              className="border rounded-lg px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300"
                            >
                              {PARENTESCOS.map(p => <option key={p} value={p} className="capitalize">{p}</option>)}
                            </select>
                            <button
                              onClick={() => agregarMiembroFamilia(familia.id)}
                              disabled={guardandoFamilia || !miembroParaAgregar || familiaParaAgregar !== String(familia.id)}
                              className="bg-blue-600 text-white text-xs px-3 py-1.5 rounded-lg hover:bg-blue-700 transition disabled:opacity-40"
                            >
                              + Agregar
                            </button>
                          </div>
                        </div>
                      </div>
                    ))
                  )}

                  {/* Crear nuevo grupo familiar */}
                  <div className="border-2 border-dashed border-gray-200 rounded-xl p-4">
                    <p className="text-sm font-semibold text-gray-600 mb-3">Crear nuevo grupo familiar</p>
                    <div className="flex gap-2">
                      <input
                        type="text"
                        placeholder='Nombre del grupo (ej. "Familia González") — opcional'
                        value={nuevaFamiliaNombre}
                        onChange={e => setNuevaFamiliaNombre(e.target.value)}
                        className="border rounded-lg px-3 py-2 text-sm flex-1 focus:outline-none focus:ring-2 focus:ring-blue-300"
                      />
                      <button
                        onClick={crearFamilia}
                        disabled={guardandoFamilia}
                        className="bg-green-600 text-white text-sm px-4 py-2 rounded-lg hover:bg-green-700 transition disabled:opacity-40 whitespace-nowrap"
                      >
                        {guardandoFamilia ? "..." : "Crear grupo"}
                      </button>
                    </div>
                  </div>
                </>
              )}
            </div>

            <div className="flex justify-end px-6 py-4 border-t bg-gray-50 rounded-b-2xl shrink-0">
              <button onClick={cerrarModalFamilia} className="w-full sm:w-auto border border-gray-300 text-gray-600 hover:bg-gray-100 font-medium px-6 py-2.5 rounded-lg">
                Cerrar
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
