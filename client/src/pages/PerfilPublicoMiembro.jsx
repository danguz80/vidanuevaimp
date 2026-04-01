import React, { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useMemberAuth } from "../context/MemberAuthContext";
import { ArrowLeft, Calendar, Phone, Mail, MapPin } from "lucide-react";

const API_URL = import.meta.env.VITE_BACKEND_URL || "https://iglesia-backend.onrender.com";

const ESTADO_COLORES = {
  activo: "bg-green-100 text-green-700",
  inactivo: "bg-gray-100 text-gray-500",
  visita: "bg-yellow-100 text-yellow-700",
};

export default function PerfilPublicoMiembro() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { miembro: yo, getToken } = useMemberAuth();

  const [perfil, setPerfil] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!yo) { navigate("/portal/login"); return; }
    const cargar = async () => {
      try {
        const res = await fetch(`${API_URL}/api/miembros/${id}/publico`, {
          headers: { Authorization: `Bearer ${getToken()}` },
        });
        if (!res.ok) { setError("Perfil no encontrado"); return; }
        const data = await res.json();
        setPerfil(data);
      } catch {
        setError("Error de conexión");
      } finally {
        setLoading(false);
      }
    };
    cargar();
  }, [id]);

  if (!yo) return null;

  if (loading) return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center">
      <div className="w-8 h-8 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin" />
    </div>
  );

  if (error || !perfil) return (
    <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center gap-4 px-4">
      <p className="text-gray-500">{error || "Perfil no encontrado"}</p>
      <button onClick={() => navigate(-1)} className="text-indigo-600 text-sm">← Volver</button>
    </div>
  );

  const fechaNacFormateada = perfil.fecha_nacimiento
    ? new Date(perfil.fecha_nacimiento.slice(0, 10) + "T12:00:00")
        .toLocaleDateString("es-CL", { day: "numeric", month: "long" })
    : null;

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b sticky top-0 z-10">
        <div className="max-w-lg mx-auto px-4 h-14 flex items-center gap-3">
          <button
            onClick={() => navigate(-1)}
            className="text-gray-500 hover:text-gray-800 transition p-1 -ml-1"
          >
            <ArrowLeft size={20} />
          </button>
          <span className="font-semibold text-gray-800 text-base">Perfil de miembro</span>
        </div>
      </div>

      <div className="max-w-lg mx-auto px-4 py-6 space-y-4">

        {/* Tarjeta de perfil */}
        <div className="bg-white rounded-2xl shadow-sm p-6 flex flex-col items-center gap-3">
          {/* Foto */}
          {perfil.foto_url ? (
            <img
              src={perfil.foto_url}
              alt={`${perfil.nombre} ${perfil.apellido}`}
              className="w-28 h-28 rounded-full object-cover border-4 border-white shadow-md"
            />
          ) : (
            <div className="w-28 h-28 rounded-full bg-indigo-100 flex items-center justify-center border-4 border-white shadow-md">
              <span className="text-3xl font-bold text-indigo-400">
                {perfil.nombre?.[0]}{perfil.apellido?.[0]}
              </span>
            </div>
          )}

          {/* Nombre */}
          <h1 className="text-xl font-bold text-gray-900 text-center">
            {perfil.nombre} {perfil.apellido}
          </h1>

          {/* Roles */}
          {Array.isArray(perfil.roles) && perfil.roles.length > 0 && (
            <div className="flex flex-wrap justify-center gap-1.5">
              {perfil.roles.map(rol => (
                <span
                  key={rol}
                  className="px-2.5 py-0.5 bg-indigo-50 text-indigo-700 rounded-full text-xs font-medium border border-indigo-100"
                >
                  {rol}
                </span>
              ))}
            </div>
          )}

          {/* Estado */}
          {perfil.estado && (
            <span className={`px-3 py-1 rounded-full text-xs font-semibold ${ESTADO_COLORES[perfil.estado] || "bg-gray-100 text-gray-600"}`}>
              {perfil.estado}
            </span>
          )}
        </div>

        {/* Acerca de mí */}
        {perfil.acerca_de_mi && (
          <div className="bg-white rounded-2xl shadow-sm p-5">
            <p className="text-xs font-semibold text-gray-400 tracking-widest uppercase mb-3">
              Acerca de mí
            </p>
            <p className="text-sm text-gray-700 whitespace-pre-wrap leading-relaxed">
              {perfil.acerca_de_mi}
            </p>
          </div>
        )}

        {/* Mis datos */}
        {(fechaNacFormateada || perfil.celular || perfil.email || perfil.direccion) && (
          <div className="bg-white rounded-2xl shadow-sm p-5">
            <p className="text-xs font-semibold text-gray-400 tracking-widest uppercase mb-4">
              Cumpleaños y contacto
            </p>
            <div className="space-y-3">
              {fechaNacFormateada && (
                <div className="flex items-center gap-3">
                  <Calendar size={16} className="text-indigo-400 shrink-0" />
                  <span className="text-sm text-gray-700">{fechaNacFormateada}</span>
                </div>
              )}
              {perfil.celular && (
                <div className="flex items-center gap-3">
                  <Phone size={16} className="text-indigo-400 shrink-0" />
                  <a
                    href={`tel:${perfil.celular}`}
                    className="text-sm text-gray-700 hover:text-indigo-600 transition"
                  >
                    {perfil.celular}
                  </a>
                </div>
              )}
              {perfil.email && (
                <div className="flex items-center gap-3">
                  <Mail size={16} className="text-indigo-400 shrink-0" />
                  <a
                    href={`mailto:${perfil.email}`}
                    className="text-sm text-gray-700 hover:text-indigo-600 transition break-all"
                  >
                    {perfil.email}
                  </a>
                </div>
              )}
              {perfil.direccion && (
                <div className="flex items-start gap-3">
                  <MapPin size={16} className="text-indigo-400 shrink-0 mt-0.5" />
                  <span className="text-sm text-gray-700">{perfil.direccion}</span>
                </div>
              )}
            </div>
          </div>
        )}

      </div>
    </div>
  );
}
