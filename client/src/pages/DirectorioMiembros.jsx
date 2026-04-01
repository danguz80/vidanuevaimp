import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useMemberAuth } from "../context/MemberAuthContext";
import { ArrowLeft, Search } from "lucide-react";

const API_URL = import.meta.env.VITE_BACKEND_URL || "https://iglesia-backend.onrender.com";

export default function DirectorioMiembros() {
  const navigate = useNavigate();
  const { miembro, getToken } = useMemberAuth();
  const [miembros, setMiembros] = useState([]);
  const [loading, setLoading] = useState(true);
  const [buscar, setBuscar] = useState("");

  useEffect(() => {
    if (!miembro) { navigate("/portal/login"); return; }
    const cargar = async () => {
      try {
        const res = await fetch(`${API_URL}/api/miembros/directorio`, {
          headers: { Authorization: `Bearer ${getToken()}` },
        });
        const data = await res.json();
        setMiembros(Array.isArray(data) ? data : []);
      } catch {
        // silently fail
      } finally {
        setLoading(false);
      }
    };
    cargar();
  }, []);

  if (!miembro) return null;

  const filtrados = miembros.filter(m =>
    `${m.nombre} ${m.apellido}`.toLowerCase().includes(buscar.toLowerCase())
  );

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b sticky top-0 z-10">
        <div className="max-w-6xl mx-auto px-4 h-14 flex items-center gap-3">
          <button
            onClick={() => navigate("/portal")}
            className="text-gray-500 hover:text-gray-800 transition p-1 -ml-1"
          >
            <ArrowLeft size={20} />
          </button>
          <span className="font-semibold text-gray-800 text-base">Directorio</span>
          <span className="ml-auto text-xs text-gray-400">{filtrados.length} miembros</span>
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-4 py-4 space-y-4">
        {/* Buscador */}
        <div className="relative max-w-sm">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            placeholder="Buscar miembro..."
            value={buscar}
            onChange={e => setBuscar(e.target.value)}
            className="w-full bg-white border border-gray-200 rounded-xl pl-9 pr-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400 shadow-sm"
          />
        </div>

        {loading ? (
          <div className="flex justify-center py-12">
            <div className="w-8 h-8 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin" />
          </div>
        ) : filtrados.length === 0 ? (
          <p className="text-center text-gray-400 py-8 text-sm">Sin resultados</p>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
            {filtrados.map(m => (
              <button
                key={m.id}
                onClick={() => navigate(`/portal/miembros/${m.id}`)}
                className="bg-white rounded-2xl shadow-sm p-4 flex flex-col items-center gap-2 hover:shadow-md hover:-translate-y-0.5 active:scale-95 transition-all text-center"
              >
                {m.foto_url ? (
                  <img
                    src={m.foto_url}
                    alt=""
                    className="w-16 h-16 rounded-full object-cover"
                  />
                ) : (
                  <div className="w-16 h-16 rounded-full bg-indigo-100 flex items-center justify-center shrink-0">
                    <span className="text-lg font-bold text-indigo-400">
                      {m.nombre?.[0]}{m.apellido?.[0]}
                    </span>
                  </div>
                )}
                <div className="w-full">
                  <p className="text-xs font-semibold text-gray-800 leading-tight line-clamp-2">
                    {m.nombre} {m.apellido}
                  </p>
                  {Array.isArray(m.roles) && m.roles.length > 0 && (
                    <p className="text-[10px] text-gray-400 truncate mt-0.5">{m.roles[0]}</p>
                  )}
                </div>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
