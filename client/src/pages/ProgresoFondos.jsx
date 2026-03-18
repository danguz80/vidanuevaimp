import React, { useState, useEffect } from "react";
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer, Legend } from "recharts";
import { Target } from "lucide-react";

const API_URL = import.meta.env.VITE_BACKEND_URL || "https://iglesia-backend.onrender.com";

const COLORS = ["#3B82F6", "#10B981", "#F59E0B", "#EF4444", "#8B5CF6"];

const RADIAN = Math.PI / 180;

const renderCustomLabel = ({ cx, cy, midAngle, innerRadius, outerRadius, porcentaje }) => {
  const radius = innerRadius + (outerRadius - innerRadius) * 0.5;
  const x = cx + radius * Math.cos(-midAngle * RADIAN);
  const y = cy + radius * Math.sin(-midAngle * RADIAN);
  if (porcentaje < 5) return null;
  return (
    <text x={x} y={y} fill="white" textAnchor="middle" dominantBaseline="central" fontSize={13} fontWeight="bold">
      {`${porcentaje}%`}
    </text>
  );
};

function FondoCard({ fondo, color }) {
  const pct = parseFloat(fondo.porcentaje) || 0;
  const pctContable = parseFloat(fondo.porcentaje_contable) || 0;
  const pctPendiente = Math.max(0, pctContable - pct);
  const tieneMeta = fondo.porcentaje != null;

  if (!tieneMeta) {
    return (
      <div className="bg-white rounded-xl shadow-md p-6 flex flex-col items-center justify-center min-h-[260px]">
        <div className="w-10 h-10 rounded-full flex items-center justify-center mb-3" style={{ backgroundColor: color }}>
          <Target size={20} color="white" />
        </div>
        <h3 className="text-lg font-bold text-gray-800 mb-1 text-center">{fondo.nombre}</h3>
        {fondo.descripcion && (
          <p className="text-sm text-gray-500 mb-4 text-center">{fondo.descripcion}</p>
        )}
        <div
          className="mt-4 px-4 py-2 rounded-full text-sm font-semibold text-white"
          style={{ backgroundColor: color }}
        >
          Fondo activo
        </div>
      </div>
    );
  }

  // Donut con 3 segmentos: disponible | pendiente efectivo | restante
  const data = [
    { name: "Disponible", porcentaje: pct },
    { name: "Pendiente efectivo", porcentaje: pctPendiente },
    { name: "Restante", porcentaje: Math.max(0, 100 - pctContable) },
  ];

  return (
    <div className="bg-white rounded-xl shadow-md p-6 flex flex-col items-center">
      <div className="w-10 h-10 rounded-full flex items-center justify-center mb-3" style={{ backgroundColor: color }}>
        <Target size={20} color="white" />
      </div>
      <h3 className="text-lg font-bold text-gray-800 mb-1 text-center">{fondo.nombre}</h3>
      {fondo.descripcion && (
        <p className="text-sm text-gray-500 mb-3 text-center">{fondo.descripcion}</p>
      )}

      <ResponsiveContainer width="100%" height={200}>
        <PieChart>
          <Pie
            data={data}
            cx="50%"
            cy="50%"
            innerRadius={50}
            outerRadius={80}
            startAngle={90}
            endAngle={-270}
            dataKey="porcentaje"
            labelLine={false}
            label={({ cx, cy, midAngle, innerRadius, outerRadius, index: i }) =>
              i === 0 ? renderCustomLabel({ cx, cy, midAngle, innerRadius, outerRadius, porcentaje: pct }) : null
            }
          >
            <Cell fill={color} />
            <Cell fill="#F59E0B" />
            <Cell fill="#E5E7EB" />
          </Pie>
          <Tooltip
            formatter={(value, name) =>
              name === "Disponible" ? [`${value}%`, "Saldo disponible"] :
              name === "Pendiente efectivo" ? [`${value}%`, "Efectivo pendiente"] :
              [`${value}%`, "Restante"]
            }
          />
        </PieChart>
      </ResponsiveContainer>

      <div className="mt-2 text-center">
        <span className="text-2xl font-bold" style={{ color }}>{pct}%</span>
        {pctPendiente > 0 && (
          <span className="text-base font-semibold text-amber-500 ml-2">(+{pctPendiente.toFixed(1)}% pendiente)</span>
        )}
        <p className="text-sm text-gray-500">de la meta alcanzado</p>
      </div>

      {/* Barra doble: disponible + pendiente */}
      <div className="w-full mt-3 bg-gray-200 rounded-full h-3 overflow-hidden relative">
        <div
          className="h-3 rounded-full absolute left-0 top-0 transition-all duration-500"
          style={{ width: `${pctContable}%`, backgroundColor: "#F59E0B" }}
        />
        <div
          className="h-3 rounded-full absolute left-0 top-0 transition-all duration-500"
          style={{ width: `${pct}%`, backgroundColor: color }}
        />
      </div>
      {pctPendiente > 0 && (
        <div className="flex gap-4 mt-2 text-xs text-gray-500">
          <span className="flex items-center gap-1">
            <span className="inline-block w-2.5 h-2.5 rounded-full" style={{ backgroundColor: color }} />
            Disponible {pct}%
          </span>
          <span className="flex items-center gap-1">
            <span className="inline-block w-2.5 h-2.5 rounded-full bg-amber-400" />
            Pendiente {pctContable}% contable
          </span>
        </div>
      )}
    </div>
  );
}

export default function ProgresoFondos() {
  const [fondos, setFondos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    fetch(`${API_URL}/api/fondos/progreso`)
      .then(r => {
        if (!r.ok) throw new Error("Error al cargar fondos");
        return r.json();
      })
      .then(data => {
        setFondos(data);
        setLoading(false);
      })
      .catch(e => {
        setError(e.message);
        setLoading(false);
      });
  }, []);

  return (
    <div className="min-h-screen bg-gradient-to-b from-blue-50 to-white">
      <section className="bg-blue-600 text-white py-16 px-4">
        <div className="max-w-4xl mx-auto text-center">
          <h1 className="text-4xl md:text-5xl font-bold mb-4">Progreso de Fondos</h1>
          <p className="text-xl mb-2">Iglesia Misión Pentecostés Templo Vida Nueva</p>
          <p className="text-blue-100 italic">
            "Vengan a mí con sus diezmos y ofrendas, y yo abriré las ventanas de los cielos" — Malaquías 3:10
          </p>
        </div>
      </section>

      <div className="max-w-6xl mx-auto px-4 py-12">
        {loading && (
          <div className="text-center py-20 text-gray-500 text-lg">Cargando fondos...</div>
        )}

        {error && (
          <div className="text-center py-20 text-red-500">{error}</div>
        )}

        {!loading && !error && (
          <>
            <p className="text-center text-gray-600 mb-10 text-lg">
              Aquí puedes ver el avance de cada proyecto. Los gráficos muestran el porcentaje de la meta alcanzado.
            </p>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
              {fondos
                .filter(fondo => fondo.porcentaje != null)
                .map((fondo) => (
                <FondoCard
                  key={fondo.id}
                  fondo={fondo}
                  color={COLORS[fondos.indexOf(fondo) % COLORS.length]}
                />
              ))}
            </div>

            {/* Gráfico general comparativo: solo fondos con meta */}
            {fondos.some(f => f.porcentaje != null) && (
              <div className="mt-16 bg-white rounded-xl shadow-md p-8">
                <h2 className="text-2xl font-bold text-gray-800 mb-6 text-center">
                  Distribución General de Avance
                </h2>
                <ResponsiveContainer width="100%" height={350}>
                  <PieChart>
                    <Pie
                      data={fondos
                        .filter(f => f.porcentaje != null)
                        .map((f, i) => ({
                          name: f.nombre,
                          value: parseFloat(f.porcentaje) || 0,
                          porcentaje: parseFloat(f.porcentaje) || 0,
                          originalIndex: fondos.indexOf(f),
                        }))}
                      cx="50%"
                      cy="50%"
                      outerRadius={130}
                      dataKey="value"
                      labelLine={false}
                      label={renderCustomLabel}
                    >
                      {fondos
                        .filter(f => f.porcentaje != null)
                        .map((f) => (
                          <Cell key={f.id} fill={COLORS[fondos.indexOf(f) % COLORS.length]} />
                        ))}
                    </Pie>
                    <Tooltip formatter={(value) => [`${value}%`, "Progreso"]} />
                    <Legend />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            )}

            <div className="text-center mt-12">
              <a
                href="/donacion"
                className="inline-block bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 px-8 rounded-lg transition text-lg"
              >
                Contribuir a un Fondo
              </a>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
