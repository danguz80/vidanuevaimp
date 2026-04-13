import React, { useState, useRef } from "react";
import { useAuth } from "../context/AuthContext";

const API = import.meta.env.VITE_BACKEND_URL;

const ROLES_DISPONIBLES = [
  "admin","Pastor","Obispo","Diácono","Tesorero","Secretario","Músico",
  "Líder de Alabanza","Encargado de Ministerio","Profesor","Ujieres",
  "Voluntario","Miembro","Joven","Adolescente","Niño","Dorca","Coordinador/a","Predicador/a",
];

/**
 * Modal unificado para crear/editar un miembro.
 *
 * Props:
 *  - miembro      : objeto miembro existente (null/undefined = nuevo)
 *  - onClose      : () => void
 *  - onGuardado   : () => void  (el padre recarga sus datos)
 *  - navAnterior  : () => void  (opcional, muestra flechas de navegación)
 *  - navSiguiente : () => void  (opcional)
 *  - navLabel     : string      (opcional, ej. "2 / 10")
 *  - navDisablePrev : boolean   (opcional)
 *  - navDisableNext : boolean   (opcional)
 */
export default function EditarMiembroModal({
  miembro,
  onClose,
  onGuardado,
  navAnterior,
  navSiguiente,
  navLabel,
  navDisablePrev,
  navDisableNext,
}) {
  const { getToken } = useAuth();
  const fileInputRef = useRef(null);

  const [form, setForm] = useState(() => ({
    nombre:            miembro?.nombre            || "",
    apellido:          miembro?.apellido          || "",
    foto_url:          miembro?.foto_url          || "",
    sexo:              miembro?.sexo              || "",
    fecha_nacimiento:  miembro?.fecha_nacimiento
                         ? miembro.fecha_nacimiento.split("T")[0]
                         : "",
    estado:            miembro?.estado            || "activo",
    celular:           miembro?.celular           || "",
    email:             miembro?.email             || "",
    direccion:         miembro?.direccion         || "",
    notas:             miembro?.notas             || "",
    acerca_de_mi:      miembro?.acerca_de_mi      || "",
    roles:             miembro?.roles             || [],
    bautizado:         miembro?.bautizado         || false,
    declaracion_fe:    miembro?.declaracion_fe    || false,
    estado_civil:      miembro?.estado_civil      || "",
    separado:          miembro?.separado          || false,
    nivel_discipulado: miembro?.nivel_discipulado || null,
  }));

  const [guardando, setGuardando] = useState(false);
  const [subiendoFoto, setSubiendoFoto] = useState(false);

  const headers = () => ({ Authorization: `Bearer ${getToken()}` });

  const toggleRol = (rol) => {
    setForm(prev => ({
      ...prev,
      roles: prev.roles.includes(rol)
        ? prev.roles.filter(r => r !== rol)
        : [...prev.roles, rol],
    }));
  };

  const subirFoto = (file) => {
    if (!file) return;
    setSubiendoFoto(true);
    const reader = new FileReader();
    reader.onload = async (e) => {
      const base64 = e.target.result;
      if (miembro?.id) {
        try {
          const res = await fetch(`${API}/api/miembros/${miembro.id}/foto-perfil`, {
            method: "POST",
            headers: { ...headers(), "Content-Type": "application/json" },
            body: JSON.stringify({ imagen_base64: base64 }),
          });
          const data = await res.json();
          setForm(prev => ({ ...prev, foto_url: data.foto_url }));
        } catch {
          alert("Error al subir la foto");
        }
      } else {
        // Nuevo miembro: guardar como prévia base64 y subir al crear
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
      const url    = miembro?.id ? `${API}/api/miembros/${miembro.id}` : `${API}/api/miembros`;
      const method = miembro?.id ? "PUT" : "POST";
      const res = await fetch(url, {
        method,
        headers: { ...headers(), "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      if (!res.ok) throw new Error("Error al guardar");
      onGuardado();
      onClose();
    } catch {
      alert("Error al guardar el miembro");
    } finally {
      setGuardando(false);
    }
  };

  const showNav = !!navLabel;

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-end sm:items-center justify-center">
      <div className="bg-white rounded-t-2xl sm:rounded-2xl shadow-2xl w-full sm:max-w-2xl max-h-[92vh] flex flex-col">

        {/* ─── Encabezado ─── */}
        <div className="flex items-center justify-between p-6 border-b shrink-0">
          <h2 className="text-xl font-bold text-gray-800">
            {miembro?.id ? "Editar Miembro" : "Nuevo Miembro"}
          </h2>
          <div className="flex items-center gap-2">
            {showNav && (
              <>
                <button
                  onClick={navAnterior}
                  disabled={navDisablePrev}
                  className="text-gray-500 hover:text-gray-800 disabled:opacity-25 px-1.5 py-0.5 rounded hover:bg-gray-100 text-lg font-bold transition"
                  title="Miembro anterior"
                >&#8249;</button>
                <span className="text-xs text-gray-400 tabular-nums min-w-[3rem] text-center">
                  {navLabel}
                </span>
                <button
                  onClick={navSiguiente}
                  disabled={navDisableNext}
                  className="text-gray-500 hover:text-gray-800 disabled:opacity-25 px-1.5 py-0.5 rounded hover:bg-gray-100 text-lg font-bold transition"
                  title="Siguiente miembro"
                >&#8250;</button>
              </>
            )}
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-600 text-2xl leading-none ml-1"
            >&times;</button>
          </div>
        </div>

        {/* ─── Formulario ─── */}
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
            <div className="flex gap-2 items-center flex-wrap justify-center">
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

          {/* Sexo */}
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">Sexo</label>
            <div className="flex flex-wrap gap-4">
              {[
                { value: "masculino", label: "Masculino" },
                { value: "femenino",  label: "Femenino"  },
              ].map(({ value, label }) => (
                <label key={value} className="flex items-center gap-2 cursor-pointer select-none">
                  <input
                    type="radio"
                    name="sexo_editar"
                    checked={form.sexo === value}
                    onChange={() => setForm(prev => ({ ...prev, sexo: value }))}
                    className="accent-blue-600"
                  />
                  <span className="text-sm text-gray-700">{label}</span>
                </label>
              ))}
            </div>
            {form.sexo && (
              <button
                type="button"
                onClick={() => setForm(prev => ({ ...prev, sexo: "" }))}
                className="mt-1 text-xs text-gray-400 hover:text-gray-600 underline"
              >Limpiar</button>
            )}
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
              placeholder="Información adicional..."
            />
          </div>

          {/* Acerca de mí */}
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-1">Acerca de mí</label>
            <textarea
              rows={3}
              value={form.acerca_de_mi}
              onChange={e => setForm(prev => ({ ...prev, acerca_de_mi: e.target.value }))}
              className="w-full border rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-400 resize-none"
              placeholder="De dónde es, cuántos años en la iglesia, a qué se dedica..."
            />
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
                { value: "soltero",    label: "Soltero/a"    },
                { value: "casado",     label: "Casado/a"     },
                { value: "viudo",      label: "Viudo/a"      },
                { value: "divorciado", label: "Divorciado/a" },
              ].map(({ value, label }) => (
                <label key={value} className="flex items-center gap-2 cursor-pointer select-none">
                  <input
                    type="radio"
                    name="estado_civil_editar"
                    value={value}
                    checked={form.estado_civil === value}
                    onChange={() => setForm(prev => ({
                      ...prev,
                      estado_civil: value,
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
                >Limpiar</button>
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
                { value: 3, label: "Nivel 3 — Servicio"    },
                { value: 4, label: "Nivel 4 — Liderazgo"   },
              ].map(({ value, label }) => (
                <label key={value} className="flex items-center gap-2 cursor-pointer select-none">
                  <input
                    type="radio"
                    name="nivel_discipulado_editar"
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
              >Limpiar selección</button>
            )}
          </div>

        </div>

        {/* ─── Pie de botones ─── */}
        <div className="flex gap-3 px-6 py-4 border-t bg-gray-50 rounded-b-2xl shrink-0">
          <button
            onClick={onClose}
            className="flex-1 border border-gray-300 text-gray-600 hover:bg-gray-100 font-medium py-2.5 rounded-lg transition text-sm"
          >
            Cancelar
          </button>
          <button
            onClick={guardar}
            disabled={guardando}
            className="flex-1 bg-blue-600 hover:bg-blue-700 text-white font-semibold py-2.5 rounded-lg transition disabled:opacity-50 text-sm"
          >
            {guardando ? "Guardando..." : miembro?.id ? "Guardar Cambios" : "Crear Miembro"}
          </button>
        </div>

      </div>
    </div>
  );
}
