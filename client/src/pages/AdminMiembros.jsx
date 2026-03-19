import React, { useState, useEffect, useRef } from "react";
import { useAuth } from "../context/AuthContext";
import AdminNav from "../components/AdminNav";

const API = import.meta.env.VITE_BACKEND_URL;

const ROLES_DISPONIBLES = [
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
};

export default function AdminMiembros() {
  const { getToken } = useAuth();
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

  const miembrosFiltrados = miembros.filter(m => {
    const nombre = `${m.nombre} ${m.apellido}`.toLowerCase();
    const coincideBusqueda = nombre.includes(busqueda.toLowerCase()) ||
      (m.email || "").toLowerCase().includes(busqueda.toLowerCase()) ||
      (m.celular || "").includes(busqueda);
    const coincideEstado = filtroEstado === "todos" || m.estado === filtroEstado;
    const coincideRol = filtroRol === "todos" || (m.roles || []).includes(filtroRol);
    return coincideBusqueda && coincideEstado && coincideRol;
  });

  const calcularEdad = (fechaNac) => {
    if (!fechaNac) return null;
    const hoy = new Date();
    const nac = new Date(fechaNac);
    let edad = hoy.getFullYear() - nac.getFullYear();
    const m = hoy.getMonth() - nac.getMonth();
    if (m < 0 || (m === 0 && hoy.getDate() < nac.getDate())) edad--;
    return edad;
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
          <button
            onClick={abrirNuevo}
            className="bg-blue-600 hover:bg-blue-700 text-white font-semibold py-2 px-5 rounded-lg transition flex items-center gap-2"
          >
            <span className="text-xl leading-none">+</span> Nuevo Miembro
          </button>
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
                      <div className="flex items-center gap-3">
                        {m.foto_url ? (
                          <img
                            src={m.foto_url}
                            alt={m.nombre}
                            className="w-10 h-10 rounded-full object-cover flex-shrink-0"
                          />
                        ) : (
                          <div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center flex-shrink-0">
                            <span className="text-blue-600 font-bold text-sm">
                              {m.nombre[0]}{m.apellido[0]}
                            </span>
                          </div>
                        )}
                        <div>
                          <p className="font-semibold text-gray-800">{m.nombre} {m.apellido}</p>
                          {m.email && <p className="text-xs text-gray-400 md:hidden">{m.email}</p>}
                        </div>
                      </div>
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
                      <div className="flex justify-center gap-2">
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
        <div className="fixed inset-0 bg-black/50 z-50 flex items-start justify-center p-4 overflow-y-auto">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl my-8">
            <div className="flex justify-between items-center p-6 border-b">
              <h2 className="text-xl font-bold text-gray-800">
                {editando ? "Editar Miembro" : "Nuevo Miembro"}
              </h2>
              <button onClick={cerrarModal} className="text-gray-400 hover:text-gray-600 text-2xl leading-none">&times;</button>
            </div>

            <div className="p-6 space-y-5">
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

            {/* Footer modal */}
            <div className="flex justify-end gap-3 px-6 py-4 border-t bg-gray-50 rounded-b-2xl">
              <button
                onClick={cerrarModal}
                className="px-5 py-2 text-gray-600 hover:text-gray-800 font-medium transition"
              >
                Cancelar
              </button>
              <button
                onClick={guardar}
                disabled={guardando}
                className="bg-blue-600 hover:bg-blue-700 text-white font-semibold px-6 py-2 rounded-lg transition disabled:opacity-50"
              >
                {guardando ? "Guardando..." : editando ? "Guardar Cambios" : "Crear Miembro"}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
