import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, Legend } from "recharts";
import { Edit2, Save, X, ChevronDown, ChevronUp } from "lucide-react";

const API_URL = import.meta.env.VITE_BACKEND_URL || "https://iglesia-backend.onrender.com";
const COLORS = ["#3B82F6", "#10B981", "#F59E0B", "#EF4444", "#8B5CF6"];

export default function AdminFondos() {
  const { token } = useAuth();
  const navigate = useNavigate();
  const [fondos, setFondos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [editando, setEditando] = useState(null);
  const [nuevaMeta, setNuevaMeta] = useState("");
  const [guardando, setGuardando] = useState(false);
  const [expandido, setExpandido] = useState(null);
  const [donacionesFondo, setDonacionesFondo] = useState({});

  const cargarFondos = () => {
    fetch(`${API_URL}/api/fondos`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then(r => r.json())
      .then(data => {
        setFondos(data);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  };

  useEffect(() => {
    cargarFondos();
  }, []);

  const iniciarEdicion = (fondo) => {
    setEditando(fondo.id);
    setNuevaMeta(fondo.meta.toString());
  };

  const cancelarEdicion = () => {
    setEditando(null);
    setNuevaMeta("");
  };

  const guardarMeta = async (fondoId) => {
    if (!nuevaMeta || isNaN(nuevaMeta) || parseFloat(nuevaMeta) <= 0) {
      alert("Ingresa un valor válido para la meta");
      return;
    }
    setGuardando(true);
    try {
      const res = await fetch(`${API_URL}/api/fondos/${fondoId}/meta`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ meta: parseFloat(nuevaMeta) }),
      });
      if (!res.ok) throw new Error("Error al guardar");
      setEditando(null);
      setNuevaMeta("");
      cargarFondos();
    } catch (e) {
      alert("Error al guardar la meta");
    } finally {
      setGuardando(false);
    }
  };

  const toggleDetalle = async (fondoId) => {
    if (expandido === fondoId) {
      setExpandido(null);
      return;
    }
    setExpandido(fondoId);
    if (!donacionesFondo[fondoId]) {
      try {
        const res = await fetch(`${API_URL}/api/fondos/${fondoId}/donaciones`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        const data = await res.json();
        setDonacionesFondo(prev => ({ ...prev, [fondoId]: data }));
      } catch {
        setDonacionesFondo(prev => ({ ...prev, [fondoId]: [] }));
      }
    }
  };

  const totalGeneral = fondos.reduce((s, f) => s + parseFloat(f.total_recaudado || 0), 0);

  return (
    <div className="p-6 max-w-5xl mx-auto">
      <div className="flex justify-between items-center mb-8">
        <div>
          <h1 className="text-3xl font-bold text-gray-800">Administración de Fondos</h1>
          <p className="text-gray-500 mt-1">Gestiona las metas y revisa los montos recaudados por fondo</p>
        </div>
        <button
          onClick={() => navigate("/admin")}
          className="bg-gray-100 hover:bg-gray-200 text-gray-700 font-semibold py-2 px-4 rounded transition"
        >
          ← Volver al Panel
        </button>
      </div>

      {loading ? (
        <div className="text-center py-20 text-gray-500">Cargando fondos...</div>
      ) : (
        <>
          {/* Resumen general */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
            <div className="bg-blue-50 rounded-xl p-5 text-center">
              <p className="text-sm text-blue-600 font-semibold">Total Recaudado</p>
              <p className="text-2xl font-bold text-blue-800 mt-1">
                ${totalGeneral.toLocaleString("es-CL")} CLP
              </p>
            </div>
            <div className="bg-green-50 rounded-xl p-5 text-center">
              <p className="text-sm text-green-600 font-semibold">Total Donaciones</p>
              <p className="text-2xl font-bold text-green-800 mt-1">
                {fondos.reduce((s, f) => s + parseInt(f.cantidad_donaciones || 0), 0)}
              </p>
            </div>
            <div className="bg-purple-50 rounded-xl p-5 text-center">
              <p className="text-sm text-purple-600 font-semibold">Fondos Activos</p>
              <p className="text-2xl font-bold text-purple-800 mt-1">{fondos.length}</p>
            </div>
          </div>

          {/* Gráfico de distribución */}
          {fondos.some(f => parseFloat(f.total_recaudado) > 0) && (
            <div className="bg-white rounded-xl shadow p-6 mb-8">
              <h2 className="text-xl font-bold text-gray-700 mb-4">Distribución de Donaciones</h2>
              <ResponsiveContainer width="100%" height={280}>
                <PieChart>
                  <Pie
                    data={fondos.filter(f => parseFloat(f.total_recaudado) > 0).map(f => ({
                      name: f.nombre,
                      value: parseFloat(f.total_recaudado),
                    }))}
                    cx="50%"
                    cy="50%"
                    outerRadius={100}
                    dataKey="value"
                  >
                    {fondos.map((_, i) => (
                      <Cell key={i} fill={COLORS[i % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip formatter={(v) => [`$${v.toLocaleString("es-CL")} CLP`, "Recaudado"]} />
                  <Legend />
                </PieChart>
              </ResponsiveContainer>
            </div>
          )}

          {/* Tabla de fondos */}
          <div className="space-y-4">
            {fondos.map((fondo, index) => {
              const pct = parseFloat(fondo.porcentaje) || 0;
              const color = COLORS[index % COLORS.length];
              return (
                <div key={fondo.id} className="bg-white rounded-xl shadow overflow-hidden">
                  <div className="p-5">
                    <div className="flex flex-wrap items-center gap-4 justify-between">
                      <div className="flex items-center gap-3">
                        <div className="w-4 h-4 rounded-full flex-shrink-0" style={{ backgroundColor: color }} />
                        <h3 className="text-lg font-bold text-gray-800">{fondo.nombre}</h3>
                      </div>

                      <div className="flex flex-wrap gap-6 items-center">
                        <div className="text-center">
                          <p className="text-xs text-gray-500">Recaudado</p>
                          <p className="font-bold text-gray-800">
                            ${parseFloat(fondo.total_recaudado).toLocaleString("es-CL")} CLP
                          </p>
                        </div>

                        <div className="text-center">
                          <p className="text-xs text-gray-500">Meta</p>
                          {editando === fondo.id ? (
                            <div className="flex items-center gap-2">
                              <input
                                type="number"
                                value={nuevaMeta}
                                onChange={e => setNuevaMeta(e.target.value)}
                                className="w-28 border border-blue-400 rounded px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
                                min="1"
                              />
                              <button
                                onClick={() => guardarMeta(fondo.id)}
                                disabled={guardando}
                                className="text-green-600 hover:text-green-800"
                              >
                                <Save size={18} />
                              </button>
                              <button onClick={cancelarEdicion} className="text-red-500 hover:text-red-700">
                                <X size={18} />
                              </button>
                            </div>
                          ) : (
                            <div className="flex items-center gap-2">
                              <p className="font-bold text-gray-800">
                                ${parseFloat(fondo.meta).toLocaleString("es-CL")} CLP
                              </p>
                              <button
                                onClick={() => iniciarEdicion(fondo)}
                                className="text-blue-500 hover:text-blue-700"
                              >
                                <Edit2 size={15} />
                              </button>
                            </div>
                          )}
                        </div>

                        <div className="text-center">
                          <p className="text-xs text-gray-500">Progreso</p>
                          <p className="font-bold" style={{ color }}>{pct}%</p>
                        </div>

                        <div className="text-center">
                          <p className="text-xs text-gray-500">Donaciones</p>
                          <p className="font-bold text-gray-800">{fondo.cantidad_donaciones}</p>
                        </div>
                      </div>

                      <button
                        onClick={() => toggleDetalle(fondo.id)}
                        className="text-gray-500 hover:text-gray-800 flex items-center gap-1 text-sm"
                      >
                        {expandido === fondo.id ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
                        {expandido === fondo.id ? "Ocultar" : "Ver donaciones"}
                      </button>
                    </div>

                    {/* Barra de progreso */}
                    <div className="mt-4 bg-gray-100 rounded-full h-3">
                      <div
                        className="h-3 rounded-full transition-all duration-500"
                        style={{ width: `${pct}%`, backgroundColor: color }}
                      />
                    </div>
                  </div>

                  {/* Detalle donaciones */}
                  {expandido === fondo.id && (
                    <div className="border-t border-gray-100 p-5 bg-gray-50">
                      <h4 className="font-semibold text-gray-700 mb-3">Donaciones registradas</h4>
                      {!donacionesFondo[fondo.id] ? (
                        <p className="text-gray-500 text-sm">Cargando...</p>
                      ) : donacionesFondo[fondo.id].length === 0 ? (
                        <p className="text-gray-500 text-sm">No hay donaciones aún para este fondo.</p>
                      ) : (
                        <div className="overflow-x-auto">
                          <table className="w-full text-sm">
                            <thead>
                              <tr className="text-left text-gray-500 border-b">
                                <th className="pb-2 pr-4">Donante</th>
                                <th className="pb-2 pr-4">Monto CLP</th>
                                <th className="pb-2 pr-4">Monto USD</th>
                                <th className="pb-2 pr-4">Email</th>
                                <th className="pb-2">Fecha</th>
                              </tr>
                            </thead>
                            <tbody>
                              {donacionesFondo[fondo.id].map(d => (
                                <tr key={d.id} className="border-b border-gray-100 hover:bg-white">
                                  <td className="py-2 pr-4">{d.payer_name || "Anónimo"}</td>
                                  <td className="py-2 pr-4">${parseFloat(d.amount_clp).toLocaleString("es-CL")}</td>
                                  <td className="py-2 pr-4">USD {parseFloat(d.amount_usd).toFixed(2)}</td>
                                  <td className="py-2 pr-4">{d.email || "-"}</td>
                                  <td className="py-2">{new Date(d.fecha).toLocaleDateString("es-CL")}</td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}
