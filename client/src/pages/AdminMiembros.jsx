import React, { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import AdminNav from "../components/AdminNav";

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
};

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
  const [filtroRol, setFiltroRol] = useState("todos");
  const [modalAbierto, setModalAbierto] = useState(false);
  const [editando, setEditando] = useState(null);
  const [form, setForm] = useState(FORM_INICIAL);
  const [guardando, setGuardando] = useState(false);
  const [subiendoFoto, setSubiendoFoto] = useState(false);
  const fileInputRef = useRef(null);

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
    setEditando(null);
    setForm(FORM_INICIAL);
    setModalAbierto(true);
  };

  const abrirEditar = (m) => {
    setEditando(m.id);
    setForm({
      nombre: m.nombre || "",
      apellido: m.apellido || "",
      foto_url: m.foto_url || "",
      fecha_nacimiento: m.fecha_nacimiento ? m.fecha_nacimiento.split("T")[0] : "",
      celular: m.celular || "",
      email: m.email || "",
      direccion: m.direccion || "",
      estado: m.estado || "activo",
      notas: m.notas || "",
      roles: m.roles || [],
      bautizado: m.bautizado || false,
      declaracion_fe: m.declaracion_fe || false,
      estado_civil: m.estado_civil || "",
      separado: m.separado || false,
      nivel_discipulado: m.nivel_discipulado || null,
    });
    setModalAbierto(true);
  };

  const cerrarModal = () => {
    setModalAbierto(false);
    setEditando(null);
    setForm(FORM_INICIAL);
  };

  const toggleRol = (rol) => {
    setForm(prev => ({
      ...prev,
      roles: prev.roles.includes(rol)
        ? prev.roles.filter(r => r !== rol)
        : [...prev.roles, rol],
    }));
  };

  const subirFoto = async (file) => {
    if (!file) return;
    setSubiendoFoto(true);
    const reader = new FileReader();
    reader.onload = async (e) => {
      const base64 = e.target.result;
      if (editando) {
        try {
          const res = await fetch(`${API}/api/miembros/${editando}/foto`, {
            method: "POST",
            headers: { ...headers(), "Content-Type": "application/json" },
            body: JSON.stringify({ imagen_base64: base64 }),
          });
          const data = await res.json();
          setForm(prev => ({ ...prev, foto_url: data.foto_url }));
        } catch (e) {
          alert("Error al subir la foto");
        }
      } else {
        setForm(prev => ({ ...prev, foto_url: base64 }));
      }
      setSubiendoFoto(false);
    };
    reader.readAsDataURL(file);
  };

  const guardar = async () => {
    if (!form.nombre.trim() || !form.apellido.trim()) {
      alert("Nombre y apellido son obligatorios");
      return;
    }
    setGuardando(true);
    try {
      const url = editando ? `${API}/api/miembros/${editando}` : `${API}/api/miembros`;
      const method = editando ? "PUT" : "POST";
      const res = await fetch(url, {
        method,
        headers: { ...headers(), "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      if (!res.ok) throw new Error("Error al guardar");
      await cargar();
      cerrarModal();
    } catch (e) {
      alert("Error al guardar el miembro");
    } finally {
      setGuardando(false);
    }
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
    const coincideRol = filtroRol === "todos" || (m.roles || []).includes(filtroRol);
    return coincideBusqueda && coincideEstado && coincideRol;
  });

  const idxActual = editando ? miembrosFiltrados.findIndex(m => m.id === editando) : -1;
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
    const FICHAS = 2;                     // fichas por página
    const FICHA_H = (PAGE_H - HEADER_H - FOOTER_H) / FICHAS; // ~137mm cada una
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

        {/* Filtros */}
        <div className="flex flex-col md:flex-row gap-3 mb-6">
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
            value={filtroRol}
            onChange={e => setFiltroRol(e.target.value)}
            className="border rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-blue-400"
          >
            <option value="todos">Todos los roles</option>
            {ROLES_DISPONIBLES.map(r => <option key={r} value={r}>{r}</option>)}
          </select>
        </div>

        {/* Tabla */}
        {loading ? (
          <div className="text-center py-20 text-gray-500">Cargando miembros...</div>
        ) : miembrosFiltrados.length === 0 ? (
          <div className="text-center py-20 text-gray-400">
            {miembros.length === 0 ? "No hay miembros registrados aún." : "No se encontraron resultados."}
          </div>
        ) : (
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
                          <span key={r} className="text-xs bg-blue-50 text-blue-700 px-2 py-0.5 rounded-full">{r}</span>
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
        )}
      </div>

      {/* Modal */}
      {modalAbierto && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-end sm:items-center justify-center">
          <div className="bg-white rounded-t-2xl sm:rounded-2xl shadow-2xl w-full sm:max-w-2xl max-h-[92vh] flex flex-col">
            <div className="flex items-center justify-between p-6 border-b shrink-0">
              <h2 className="text-xl font-bold text-gray-800">
                {editando ? "Editar Miembro" : "Nuevo Miembro"}
              </h2>
              <div className="flex items-center gap-2">
                {editando && (
                  <>
                    <button
                      onClick={navAnterior}
                      disabled={idxActual <= 0}
                      className="text-gray-500 hover:text-gray-800 disabled:opacity-25 px-1.5 py-0.5 rounded hover:bg-gray-100 text-lg font-bold transition"
                      title="Miembro anterior"
                    >&#8249;</button>
                    <span className="text-xs text-gray-400 tabular-nums min-w-[3rem] text-center">
                      {idxActual + 1} / {miembrosFiltrados.length}
                    </span>
                    <button
                      onClick={navSiguiente}
                      disabled={idxActual >= miembrosFiltrados.length - 1}
                      className="text-gray-500 hover:text-gray-800 disabled:opacity-25 px-1.5 py-0.5 rounded hover:bg-gray-100 text-lg font-bold transition"
                      title="Siguiente miembro"
                    >&#8250;</button>
                  </>
                )}
                <button onClick={cerrarModal} className="text-gray-400 hover:text-gray-600 text-2xl leading-none ml-1">&times;</button>
              </div>
            </div>

            <div className="p-6 space-y-5 overflow-y-auto flex-1">
              {/* Foto */}
              <div className="flex flex-col items-center gap-3">
                {form.foto_url && !form.foto_url.startsWith("data:") ? (
                  <img src={form.foto_url} alt="foto" className="w-24 h-24 rounded-full object-cover" />
                ) : form.foto_url && form.foto_url.startsWith("data:") ? (
                  <img src={form.foto_url} alt="preview" className="w-24 h-24 rounded-full object-cover opacity-60" />
                ) : (
                  <div className="w-24 h-24 rounded-full bg-gray-100 flex items-center justify-center text-gray-400 text-3xl">👤</div>
                )}
                <div className="flex gap-2 items-center">
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={e => subirFoto(e.target.files[0])}
                  />
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    disabled={subiendoFoto}
                    className="text-sm bg-gray-100 hover:bg-gray-200 text-gray-700 px-4 py-1.5 rounded-lg transition"
                  >
                    {subiendoFoto ? "Subiendo..." : "📷 Subir foto"}
                  </button>
                  <span className="text-gray-400 text-xs">o</span>
                  <input
                    type="text"
                    placeholder="URL de foto"
                    value={form.foto_url.startsWith("data:") ? "" : form.foto_url}
                    onChange={e => setForm(prev => ({ ...prev, foto_url: e.target.value }))}
                    className="border rounded px-3 py-1.5 text-sm w-48 focus:outline-none focus:ring-2 focus:ring-blue-300"
                  />
                </div>
              </div>

              {/* Nombre y apellido */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-1">Nombre *</label>
                  <input
                    type="text"
                    value={form.nombre}
                    onChange={e => setForm(prev => ({ ...prev, nombre: e.target.value }))}
                    className="w-full border rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-400"
                  />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-1">Apellido *</label>
                  <input
                    type="text"
                    value={form.apellido}
                    onChange={e => setForm(prev => ({ ...prev, apellido: e.target.value }))}
                    className="w-full border rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-400"
                  />
                </div>
              </div>

              {/* Fecha nacimiento y estado */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-1">Fecha de Nacimiento</label>
                  <input
                    type="date"
                    value={form.fecha_nacimiento}
                    onChange={e => setForm(prev => ({ ...prev, fecha_nacimiento: e.target.value }))}
                    className="w-full border rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-400"
                  />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-1">Estado</label>
                  <select
                    value={form.estado}
                    onChange={e => setForm(prev => ({ ...prev, estado: e.target.value }))}
                    className="w-full border rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-400"
                  >
                    <option value="activo">Activo</option>
                    <option value="inactivo">Inactivo</option>
                    <option value="visita">Visita</option>
                  </select>
                </div>
              </div>

              {/* Contacto */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-1">Celular</label>
                  <input
                    type="tel"
                    value={form.celular}
                    onChange={e => setForm(prev => ({ ...prev, celular: e.target.value }))}
                    placeholder="+56 9 XXXX XXXX"
                    className="w-full border rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-400"
                  />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-1">Email</label>
                  <input
                    type="email"
                    value={form.email}
                    onChange={e => setForm(prev => ({ ...prev, email: e.target.value }))}
                    className="w-full border rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-400"
                  />
                </div>
              </div>

              {/* Dirección */}
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1">Dirección</label>
                <input
                  type="text"
                  value={form.direccion}
                  onChange={e => setForm(prev => ({ ...prev, direccion: e.target.value }))}
                  className="w-full border rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-400"
                />
              </div>

              {/* Roles */}
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">Roles en la Iglesia</label>
                <div className="flex flex-wrap gap-2">
                  {ROLES_DISPONIBLES.map(rol => (
                    <button
                      key={rol}
                      type="button"
                      onClick={() => toggleRol(rol)}
                      className={`text-sm px-3 py-1.5 rounded-full border transition font-medium ${
                        form.roles.includes(rol)
                          ? "bg-blue-600 text-white border-blue-600"
                          : "bg-white text-gray-600 border-gray-300 hover:border-blue-400"
                      }`}
                    >
                      {rol}
                    </button>
                  ))}
                </div>
              </div>

              {/* Bautizado / Declaración de Fe */}
              <div className="flex flex-wrap gap-6">
                <label className="flex items-center gap-2 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={form.bautizado}
                    onChange={e => setForm(prev => ({ ...prev, bautizado: e.target.checked }))}
                    className="w-4 h-4 rounded accent-blue-600"
                  />
                  <span className="text-sm font-semibold text-gray-700">Bautizado/a</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={form.declaracion_fe}
                    onChange={e => setForm(prev => ({ ...prev, declaracion_fe: e.target.checked }))}
                    className="w-4 h-4 rounded accent-blue-600"
                  />
                  <span className="text-sm font-semibold text-gray-700">Declaración de Fe</span>
                </label>
              </div>

              {/* Estado civil */}
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">Estado civil</label>
                <div className="flex flex-wrap gap-4">
                  {[
                    { value: "soltero",    label: "Soltero/a" },
                    { value: "casado",     label: "Casado/a" },
                    { value: "viudo",      label: "Viudo/a" },
                    { value: "divorciado", label: "Divorciado/a" },
                  ].map(({ value, label }) => (
                    <label key={value} className="flex items-center gap-2 cursor-pointer select-none">
                      <input
                        type="radio"
                        name="estado_civil"
                        value={value}
                        checked={form.estado_civil === value}
                        onChange={() => setForm(prev => ({
                          ...prev,
                          estado_civil: value,
                          // Limpiar separado si cambia a algo distinto de casado
                          separado: value === "casado" ? prev.separado : false,
                        }))}
                        className="accent-blue-600"
                      />
                      <span className="text-sm text-gray-700">{label}</span>
                    </label>
                  ))}
                  {form.estado_civil && (
                    <button
                      type="button"
                      onClick={() => setForm(prev => ({ ...prev, estado_civil: "", separado: false }))}
                      className="text-xs text-gray-400 underline"
                    >
                      Limpiar
                    </button>
                  )}
                </div>
              </div>

              {/* Separado/a (solo si Casado/a) */}
              {form.estado_civil === "casado" && (
                <div className="ml-2">
                  <label className="flex items-center gap-2 cursor-pointer select-none">
                    <input
                      type="checkbox"
                      checked={form.separado}
                      onChange={e => setForm(prev => ({ ...prev, separado: e.target.checked }))}
                      className="w-4 h-4 rounded accent-blue-600"
                    />
                    <span className="text-sm text-gray-700">Separado/a</span>
                    <span className="text-xs text-gray-400">(casado/a pero separado/a)</span>
                  </label>
                </div>
              )}

              {/* Nivel de Discipulado */}
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">Nivel de Discipulado</label>
                <div className="flex flex-wrap gap-3">
                  {[
                    { value: 1, label: "Nivel 1 — Fundamentos" },
                    { value: 2, label: "Nivel 2 — Crecimiento" },
                    { value: 3, label: "Nivel 3 — Servicio" },
                    { value: 4, label: "Nivel 4 — Liderazgo" },
                  ].map(({ value, label }) => (
                    <label key={value} className="flex items-center gap-2 cursor-pointer select-none">
                      <input
                        type="radio"
                        name="nivel_discipulado"
                        value={value}
                        checked={form.nivel_discipulado === value}
                        onChange={() => setForm(prev => ({ ...prev, nivel_discipulado: value }))}
                        className="accent-blue-600"
                      />
                      <span className="text-sm text-gray-700">{label}</span>
                    </label>
                  ))}
                </div>
                {form.nivel_discipulado && (
                  <button
                    type="button"
                    onClick={() => setForm(prev => ({ ...prev, nivel_discipulado: null }))}
                    className="mt-1 text-xs text-gray-400 hover:text-red-500 underline"
                  >
                    Limpiar selección
                  </button>
                )}
              </div>

              {/* Notas */}
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1">Notas</label>
                <textarea
                  rows={3}
                  value={form.notas}
                  onChange={e => setForm(prev => ({ ...prev, notas: e.target.value }))}
                  className="w-full border rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-400 resize-none"
                  placeholder="Alguna información adicional..."
                />
              </div>
            </div>

            <div className="flex gap-3 px-6 py-4 border-t bg-gray-50 rounded-b-2xl shrink-0">
              <button
                onClick={cerrarModal}
                className="flex-1 border border-gray-300 text-gray-600 hover:bg-gray-100 font-medium py-2.5 rounded-lg transition text-sm"
              >
                Cancelar
              </button>
              <button
                onClick={guardar}
                disabled={guardando}
                className="flex-1 bg-blue-600 hover:bg-blue-700 text-white font-semibold py-2.5 rounded-lg transition disabled:opacity-50 text-sm"
              >
                {guardando ? "Guardando..." : editando ? "Guardar Cambios" : "Crear Miembro"}
              </button>
            </div>
          </div>
        </div>
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
