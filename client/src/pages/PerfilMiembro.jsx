import React, { useEffect, useState, useRef } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import AdminNav from "../components/AdminNav";
import EditarMiembroModal from "../components/EditarMiembroModal";

const API = import.meta.env.VITE_BACKEND_URL;

const ROLES_DISPONIBLES = [
  "admin","Pastor","Obispo","Diácono","Tesorero","Secretario","Músico",
  "Líder de Alabanza","Encargado de Ministerio","Profesor","Ujieres",
  "Voluntario","Miembro","Joven","Adolescente","Niño","Dorca","Coordinador/a","Predicador/a",
];

const PARENTESCO_LABEL = {
  cónyuge: "💑", padre: "👨", madre: "👩", hijo: "👦", hija: "👧",
  hermano: "🧑", hermana: "🧒", abuelo: "👴", abuela: "👵",
  nieto: "👦", nieta: "👧", "tío": "🧔", "tía": "👩", otro: "🙂",
};

const ESTADO_COLORES = {
  activo: "bg-green-100 text-green-800",
  inactivo: "bg-gray-100 text-gray-600",
  visita: "bg-yellow-100 text-yellow-800",
};

export default function PerfilMiembro() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { getToken, user } = useAuth();
  const fileInputRef = useRef(null);

  const [miembro, setMiembro] = useState(null);
  const [familias, setFamilias] = useState([]);
  const [loading, setLoading] = useState(true);
  const [subiendoFoto, setSubiendoFoto] = useState(false);
  const [errorFoto, setErrorFoto] = useState("");

  // Modal edición
  const [modalEditar, setModalEditar] = useState(false);

  const headers = () => ({ Authorization: `Bearer ${getToken()}` });

  const cargar = async () => {
    try {
      const [mRes, fRes] = await Promise.all([
        fetch(`${API}/api/miembros/${id}`, { headers: headers() }),
        fetch(`${API}/api/miembros/${id}/familia`, { headers: headers() }),
      ]);
      const mData = await mRes.json();
      const fData = await fRes.json();
      setMiembro(mData);
      setFamilias(Array.isArray(fData) ? fData : []);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { cargar(); }, [id]);

  const calcularEdad = (fechaNac) => {
    if (!fechaNac) return null;
    const hoy = new Date();
    const nac = new Date(fechaNac);
    let edad = hoy.getFullYear() - nac.getFullYear();
    const m = hoy.getMonth() - nac.getMonth();
    if (m < 0 || (m === 0 && hoy.getDate() < nac.getDate())) edad--;
    return edad;
  };

  const formatFecha = (fecha) => {
    if (!fecha) return "—";
    return new Date(fecha).toLocaleDateString("es-CL", {
      day: "2-digit", month: "long", year: "numeric",
    });
  };

  const cambiarFoto = (file) => {
    if (!file) return;
    setErrorFoto("");

    if (file.size > 1 * 1024 * 1024) {
      setErrorFoto("La imagen supera 1 MB. Por favor elige una más pequeña.");
      return;
    }

    const reader = new FileReader();
    reader.onload = async (e) => {
      setSubiendoFoto(true);
      try {
        const res = await fetch(`${API}/api/miembros/${id}/foto-perfil`, {
          method: "POST",
          headers: { ...headers(), "Content-Type": "application/json" },
          body: JSON.stringify({ imagen_base64: e.target.result }),
        });
        if (!res.ok) {
          const err = await res.json().catch(() => ({}));
          throw new Error(err.error || `Error ${res.status}`);
        }
        const data = await res.json();
        setMiembro((prev) => ({ ...prev, foto_url: data.foto_url }));
      } catch (err) {
        setErrorFoto(err.message);
      } finally {
        setSubiendoFoto(false);
      }
    };
    reader.readAsDataURL(file);
  };

  const abrirEditar = () => {
    setModalEditar(true);
  };

  if (loading) {
    return (
      <>
        <AdminNav />
        <div className="flex items-center justify-center h-64 text-gray-400">Cargando perfil...</div>
      </>
    );
  }

  if (!miembro || miembro.error) {
    return (
      <>
        <AdminNav />
        <div className="flex flex-col items-center justify-center h-64 gap-4">
          <p className="text-gray-400">Miembro no encontrado.</p>
          <button onClick={() => navigate("/admin/miembros")} className="text-blue-600 hover:underline">
            ← Volver a miembros
          </button>
        </div>
      </>
    );
  }

  const fotoBroken = !miembro.foto_url;

  return (
    <>
      <AdminNav />
      <div className="max-w-4xl mx-auto px-4 py-8">
        {/* Botón volver */}
        <button
          onClick={() => navigate("/admin/miembros")}
          className="mb-6 text-sm text-blue-600 hover:text-blue-800 flex items-center gap-1"
        >
          ← Volver a miembros
        </button>

        <div className="bg-white rounded-2xl shadow-lg overflow-hidden">
          {/* Cabecera con foto */}
          <div className="bg-gradient-to-r from-blue-600 to-blue-400 px-8 py-10 flex flex-col sm:flex-row items-center gap-6">
            {/* Foto + botón cambiar */}
            <div className="relative group flex-shrink-0">
              {miembro.foto_url ? (
                <img
                  src={
                    miembro.foto_url.startsWith("/fotos_perfil/")
                      ? miembro.foto_url
                      : miembro.foto_url
                  }
                  alt={miembro.nombre}
                  className="w-32 h-32 rounded-full object-cover border-4 border-white shadow-lg"
                />
              ) : (
                <div className="w-32 h-32 rounded-full bg-white/30 border-4 border-white flex items-center justify-center text-4xl font-bold text-white shadow-lg">
                  {miembro.nombre?.[0]}{miembro.apellido?.[0]}
                </div>
              )}

              {/* Overlay cambiar foto */}
              <button
                onClick={() => fileInputRef.current?.click()}
                disabled={subiendoFoto}
                className="absolute inset-0 rounded-full bg-black/40 opacity-0 group-hover:opacity-100 transition flex items-center justify-center text-white text-xs font-semibold"
              >
                {subiendoFoto ? "Subiendo..." : "📷 Cambiar"}
              </button>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/jpeg,image/png,image/webp"
                className="hidden"
                onChange={(e) => cambiarFoto(e.target.files[0])}
              />
            </div>

            <div className="text-white text-center sm:text-left">
              <h1 className="text-3xl font-bold drop-shadow">
                {miembro.nombre} {miembro.apellido}
              </h1>
              <div className="flex flex-wrap gap-2 mt-2 justify-center sm:justify-start">
                <span className={`text-xs font-semibold px-2 py-1 rounded-full capitalize bg-white/20 text-white`}>
                  {miembro.estado || "activo"}
                </span>
                {(miembro.roles || []).map((r) => (
                  <span key={r} className="text-xs px-2 py-1 rounded-full bg-white/20 text-white">
                    {r}
                  </span>
                ))}
              </div>
              {errorFoto && (
                <p className="mt-2 text-xs text-red-200 bg-red-500/30 px-3 py-1 rounded-full">
                  ⚠ {errorFoto}
                </p>
              )}
              <p className="text-xs text-blue-100 mt-2">
                Haz hover sobre la foto para cambiarla (máx. 1 MB · JPG/PNG/WebP)
              </p>
              {user && (
                <button
                  onClick={abrirEditar}
                  className="mt-3 inline-flex items-center gap-1.5 bg-white/20 hover:bg-white/30 text-white text-sm font-semibold px-4 py-1.5 rounded-full transition"
                >
                  ✏️ Editar
                </button>
              )}
            </div>
          </div>

          {/* Datos */}
          <div className="p-8 grid grid-cols-1 sm:grid-cols-2 gap-6">
            <Dato label="Fecha de nacimiento" valor={formatFecha(miembro.fecha_nacimiento)} />
            <Dato
              label="Edad"
              valor={
                calcularEdad(miembro.fecha_nacimiento) !== null
                  ? `${calcularEdad(miembro.fecha_nacimiento)} años`
                  : "—"
              }
            />
            <Dato label="Celular" valor={miembro.celular} />
            <Dato label="Email" valor={miembro.email} />
            <Dato label="Dirección" valor={miembro.direccion} className="sm:col-span-2" />
            {miembro.notas && (
              <div className="sm:col-span-2 bg-yellow-50 border border-yellow-100 rounded-xl px-4 py-3">
                <p className="text-xs font-semibold text-yellow-600 mb-1 uppercase tracking-wide">Notas</p>
                <p className="text-sm text-gray-700 whitespace-pre-line">{miembro.notas}</p>
              </div>
            )}
            {miembro.acerca_de_mi && miembro.acerca_de_mi.trim() && (
              <div className="sm:col-span-2 bg-indigo-50 border border-indigo-100 rounded-xl px-4 py-3">
                <p className="text-xs font-semibold text-indigo-500 mb-1 uppercase tracking-wide">Acerca de mí</p>
                <p className="text-sm text-gray-700 whitespace-pre-line leading-relaxed">{miembro.acerca_de_mi}</p>
              </div>
            )}

            {/* Datos espirituales */}
            {(miembro.bautizado || miembro.declaracion_fe || miembro.estado_civil || miembro.nivel_discipulado) && (
              <div className="sm:col-span-2 bg-sky-50 border border-sky-100 rounded-xl px-4 py-3">
                <p className="text-xs font-semibold text-sky-600 mb-2 uppercase tracking-wide">Datos espirituales</p>
                <div className="flex flex-wrap gap-2">
                  {miembro.bautizado && (
                    <span className="px-3 py-1 bg-blue-100 text-blue-700 rounded-full text-xs font-semibold">
                      💧 Bautizado/a
                    </span>
                  )}
                  {miembro.declaracion_fe && (
                    <span className="px-3 py-1 bg-emerald-100 text-emerald-700 rounded-full text-xs font-semibold">
                      ✝️ Declaración de Fe
                    </span>
                  )}
                  {miembro.estado_civil && (
                    <span className="px-3 py-1 bg-indigo-100 text-indigo-700 rounded-full text-xs font-semibold">
                      {miembro.estado_civil === "casado" && miembro.separado
                        ? "💍 Casado/a (Separado/a)"
                        : miembro.estado_civil === "soltero"    ? "🙂 Soltero/a"
                        : miembro.estado_civil === "casado"     ? "💍 Casado/a"
                        : miembro.estado_civil === "viudo"      ? "🕊️ Viudo/a"
                        : miembro.estado_civil === "divorciado" ? "📄 Divorciado/a"
                        : miembro.estado_civil}
                    </span>
                  )}
                  {miembro.nivel_discipulado && (
                    <span className="px-3 py-1 bg-purple-100 text-purple-700 rounded-full text-xs font-semibold">
                      ⭐ Nivel {miembro.nivel_discipulado} — {["Fundamentos", "Crecimiento", "Servicio", "Liderazgo"][miembro.nivel_discipulado - 1]}
                    </span>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Familia */}
          {familias.length > 0 && (
            <div className="px-8 pb-8">
              <h2 className="text-lg font-bold text-gray-700 mb-4">👨‍👩‍👧 Familia</h2>
              <div className="space-y-4">
                {familias.map((familia) => (
                  <div key={familia.id} className="border rounded-xl p-4">
                    <h3 className="text-sm font-semibold text-gray-500 mb-3">
                      {familia.nombre || `Grupo familiar #${familia.id}`}
                    </h3>
                    <div className="flex flex-wrap gap-3">
                      {familia.miembros
                        .filter((rel) => rel.miembro_id !== parseInt(id))
                        .map((rel) => (
                          <button
                            key={rel.miembro_id}
                            onClick={() => navigate(`/admin/miembros/${rel.miembro_id}`)}
                            className="flex items-center gap-2 bg-gray-50 hover:bg-blue-50 border rounded-xl px-3 py-2 transition group"
                          >
                            {rel.foto_url ? (
                              <img
                                src={rel.foto_url}
                                alt={rel.nombre}
                                className="w-9 h-9 rounded-full object-cover"
                              />
                            ) : (
                              <div className="w-9 h-9 rounded-full bg-blue-100 flex items-center justify-center text-xs font-bold text-blue-600">
                                {rel.nombre?.[0]}{rel.apellido?.[0]}
                              </div>
                            )}
                            <div className="text-left">
                              <p className="text-sm font-medium text-gray-700 group-hover:text-blue-700 leading-none">
                                {rel.nombre} {rel.apellido}
                              </p>
                              <p className="text-xs text-gray-400 capitalize mt-0.5">
                                {PARENTESCO_LABEL[rel.parentesco] || "🙂"} {rel.parentesco}
                              </p>
                            </div>
                          </button>
                        ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Modal editar */}
      {modalEditar && (
        <EditarMiembroModal
          miembro={miembro}
          onClose={() => setModalEditar(false)}
          onGuardado={cargar}
        />
      )}
    </>
  );
}

function Dato({ label, valor, className = "" }) {
  return (
    <div className={`${className}`}>
      <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-1">{label}</p>
      <p className="text-sm text-gray-800">{valor || "—"}</p>
    </div>
  );
}
