import React, { useState, useEffect } from "react";
import { useAuth } from "../context/AuthContext";
import { useMemberAuth } from "../context/MemberAuthContext";

const API = import.meta.env.VITE_BACKEND_URL;

// ---------------------------------------------------------------------------
// Helpers de fecha sin conversión de zona horaria
// ---------------------------------------------------------------------------
function parseLocalDate(str) {
  if (!str) return null;
  return new Date(str.slice(0, 16)); // hora local, sin Z
}

function toLocalDateStr(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function toLocalISOString(date) {
  return `${toLocalDateStr(date)}T${String(date.getHours()).padStart(2, "0")}:${String(date.getMinutes()).padStart(2, "0")}`;
}

function normUrl(url) {
  if (!url) return "";
  if (url.startsWith("http") || url.startsWith("//")) return url;
  return url.startsWith("/") ? url : `/${url}`;
}

// Renderiza texto convirtiendo URLs en hipervínculos clicables.
// Las URLs de Zoom se ocultan si el usuario no está logueado.
function renderTexto(texto, estaLogueado) {
  if (!texto) return null;
  const urlRegex = /(https?:\/\/[^\s]+)/g;
  const partes = texto.split(urlRegex);
  return partes.map((parte, i) => {
    if (!urlRegex.test(parte)) return parte;
    // URL de Zoom: solo visible para logueados
    if (parte.includes("zoom.us") || parte.includes("zoom.com")) {
      if (!estaLogueado) return null;
      return (
        <a key={i} href={parte} target="_blank" rel="noopener noreferrer"
          className="inline-flex items-center gap-1.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold px-3 py-1.5 rounded-lg transition mt-1">
          📹 Conéctate a Zoom
        </a>
      );
    }
    // Cualquier otra URL
    return <a key={i} href={parte} target="_blank" rel="noopener noreferrer" className="text-blue-600 underline hover:text-blue-800 break-all">{parte}</a>;
  });
}

function Avatar({ nombre, apellido, foto_url, label }) {
  const initials = `${nombre?.[0] || ""}${apellido?.[0] || ""}`.toUpperCase();
  return (
    <div className="flex items-center gap-1.5">
      {foto_url ? (
        <img src={foto_url} className="w-6 h-6 rounded-full object-cover border border-gray-200 flex-shrink-0" alt="" />
      ) : (
        <div className="w-6 h-6 rounded-full bg-indigo-100 flex items-center justify-center text-xs font-bold text-indigo-600 flex-shrink-0">{initials}</div>
      )}
      <span>{label && <span className="font-medium">{label}: </span>}{nombre} {apellido}</span>
    </div>
  );
}

// Aplica el override de ocurrencia (si existe para esa fecha) sobre un evento base
function mergeOc(ev, fecha) {
  if (!ev.ocurrencias || !Array.isArray(ev.ocurrencias)) return ev;
  const fs = fecha.toLocaleDateString("sv"); // "2026-03-19" usando hora local
  const oc = ev.ocurrencias.find(o => o.fecha && String(o.fecha).slice(0, 10) === fs);
  if (!oc) return ev;
  return {
    ...ev,
    encargado_id:         oc.encargado_id        !== undefined ? oc.encargado_id        : ev.encargado_id,
    encargado_nombre:     oc.encargado_nombre    != null      ? oc.encargado_nombre    : ev.encargado_nombre,
    encargado_apellido:   oc.encargado_apellido  != null      ? oc.encargado_apellido  : ev.encargado_apellido,
    encargado_foto:       oc.encargado_foto      != null      ? oc.encargado_foto      : ev.encargado_foto,
    coordinador_id:       oc.coordinador_id      !== undefined ? oc.coordinador_id      : ev.coordinador_id,
    coordinador_nombre:   oc.coordinador_nombre  != null      ? oc.coordinador_nombre  : ev.coordinador_nombre,
    coordinador_apellido: oc.coordinador_apellido != null     ? oc.coordinador_apellido : ev.coordinador_apellido,
    coordinador_foto:     oc.coordinador_foto    != null      ? oc.coordinador_foto    : ev.coordinador_foto,
    predicador_id:        oc.predicador_id       !== undefined ? oc.predicador_id       : ev.predicador_id,
    predicador_nombre:    oc.predicador_nombre   != null      ? oc.predicador_nombre   : ev.predicador_nombre,
    predicador_apellido:  oc.predicador_apellido != null      ? oc.predicador_apellido  : ev.predicador_apellido,
    predicador_foto:      oc.predicador_foto     != null      ? oc.predicador_foto     : ev.predicador_foto,
    notas:                oc.notas               != null      ? oc.notas                : ev.notas,
  };
}

// Expande eventos recurrentes en un rango de fechas
function expandirProximos(eventos, mesesAdelante = 3) {
  const hoy = new Date();
  hoy.setHours(0, 0, 0, 0);
  const limite = new Date(hoy);
  limite.setMonth(limite.getMonth() + mesesAdelante);

  const resultado = [];

  for (const ev of eventos) {
    const inicio = parseLocalDate(ev.fecha_inicio);

    if (ev.tipo === "recurrente" && ev.recurrencia !== "ninguna") {
      switch (ev.recurrencia) {
        case "semanal": {
          const diaSemana = ev.dia_semana ?? inicio.getDay();
          let d = new Date(hoy);
          while (d.getDay() !== diaSemana) d.setDate(d.getDate() + 1);
          while (d <= limite) {
            resultado.push({ ...mergeOc(ev, d), _fecha: new Date(d), _key: `${ev.id}-${toLocalISOString(d)}` });
            d.setDate(d.getDate() + 7);
          }
          break;
        }
        case "quincenal": {
          const diaSemana = ev.dia_semana ?? inicio.getDay();
          let d = new Date(hoy);
          while (d.getDay() !== diaSemana) d.setDate(d.getDate() + 1);
          let count = 0;
          while (d <= limite) {
            if (count % 2 === 0) {
              resultado.push({ ...mergeOc(ev, d), _fecha: new Date(d), _key: `${ev.id}-${toLocalISOString(d)}` });
            }
            d.setDate(d.getDate() + 7);
            count++;
          }
          break;
        }
        case "mensual": {
          let d = new Date(inicio);
          while (d < hoy) d.setMonth(d.getMonth() + 1);
          while (d <= limite) {
            resultado.push({ ...mergeOc(ev, d), _fecha: new Date(d), _key: `${ev.id}-${toLocalISOString(d)}` });
            d.setMonth(d.getMonth() + 1);
          }
          break;
        }
        case "anual": {
          let d = new Date(inicio);
          while (d < hoy) d.setFullYear(d.getFullYear() + 1);
          while (d <= limite) {
            resultado.push({ ...mergeOc(ev, d), _fecha: new Date(d), _key: `${ev.id}-${toLocalISOString(d)}` });
            d.setFullYear(d.getFullYear() + 1);
          }
          break;
        }
        default:
          break;
      }
    } else {
      // Evento especial puntual
      if (inicio >= hoy && inicio <= limite) {
        resultado.push({ ...mergeOc(ev, inicio), _fecha: inicio, _key: `${ev.id}-unico` });
      }
    }
  }

  return resultado.sort((a, b) => a._fecha - b._fecha);
}

export default function Eventos({ maxItems }) {
  const { getToken, user: adminUser } = useAuth();
  const { miembro, getToken: getMiembroToken } = useMemberAuth();
  const estaLogueado = !!(adminUser || miembro);

  const [eventos, setEventos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const headers = {};
    if (adminUser) headers["Authorization"] = `Bearer ${getToken()}`;
    else if (miembro) headers["Authorization"] = `Bearer ${getMiembroToken()}`;

    const url = estaLogueado
      ? `${API}/api/eventos/autenticados`
      : `${API}/api/eventos/publicos`;

    fetch(url, { headers })
      .then(r => r.json())
      .then(data => setEventos(Array.isArray(data) ? data : []))
      .catch(() => setError("No se pudieron cargar los eventos."))
      .finally(() => setLoading(false));
  }, [adminUser, miembro]);

  const proximos = expandirProximos(eventos, 3);
  const mostrar = maxItems ? proximos.slice(0, maxItems) : proximos;

  return (
    <section id="eventos" className="bg-white py-16 px-4">
      <div className="max-w-6xl mx-auto text-center mb-12">
        <h3 className="text-2xl md:text-3xl font-bold text-gray-800 mb-4">Próximos Eventos</h3>
        <p className="text-gray-600">Conéctate con nuestras actividades y reuniones especiales</p>
      </div>

      {loading && (
        <div className="max-w-6xl mx-auto text-center py-12">
          <div className="inline-block w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin" />
          <p className="text-gray-400 mt-3">Cargando eventos...</p>
        </div>
      )}

      {error && (
        <div className="max-w-6xl mx-auto text-center py-8 text-red-500">{error}</div>
      )}

      {!loading && !error && proximos.length === 0 && (
        <div className="max-w-6xl mx-auto text-center py-12">
          <p className="text-gray-500 text-lg">No hay eventos próximos registrados.</p>
        </div>
      )}

      {!loading && !error && mostrar.length > 0 && (
        <div className="max-w-6xl mx-auto grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {mostrar.map(ev => (
            <div
              key={ev._key}
              className="bg-white rounded-2xl shadow-md overflow-hidden border border-gray-100 hover:shadow-lg transition"
            >
              {ev.imagen_url && (
                <img
                  src={normUrl(ev.imagen_url)}
                  alt={ev.titulo}
                  className="w-full h-40 object-cover"
                  onError={e => { e.target.style.display = "none"; }}
                />
              )}
              {!ev.imagen_url && (
                <div
                  className="w-full h-3 rounded-t"
                  style={{ backgroundColor: ev.color || "#3B82F6" }}
                />
              )}
              {ev.imagen_url && (
                <div
                  className="w-full h-1"
                  style={{ backgroundColor: ev.color || "#3B82F6" }}
                />
              )}
              <div className="p-5">
                <div className="flex items-start justify-between gap-2 mb-2">
                  <h4
                    className="text-lg font-bold leading-tight"
                    style={{ color: ev.color || "#1D4ED8" }}
                  >
                    {ev.titulo}
                  </h4>
                  <span className={`text-xs px-2 py-0.5 rounded-full flex-shrink-0 ${
                    ev.tipo === "recurrente"
                      ? "bg-purple-100 text-purple-700"
                      : "bg-blue-100 text-blue-700"
                  }`}>
                    {ev.tipo === "recurrente" ? "🔁 Recurrente" : "📅 Especial"}
                  </span>
                </div>

                <p className="text-sm text-gray-500 mb-3">
                  {ev._fecha.toLocaleDateString("es-CL", {
                    weekday: "long",
                    year: "numeric",
                    month: "long",
                    day: "numeric",
                  })}
                  {ev.fecha_inicio && (
                    <> · {parseLocalDate(ev.fecha_inicio).toLocaleTimeString("es-CL", { hour: "2-digit", minute: "2-digit" })}</>
                  )}
                </p>

                {ev.descripcion && (
                  <p className="text-gray-600 text-sm mb-3">{renderTexto(ev.descripcion, estaLogueado)}</p>
                )}

                <div className="space-y-1 text-xs text-gray-500 mt-1">
                  {ev.lugar && <p>📍 {ev.lugar}</p>}
                  {ev.encargado_nombre ? (
                    <Avatar nombre={ev.encargado_nombre} apellido={ev.encargado_apellido} foto_url={ev.encargado_foto} label="Encargado/a" />
                  ) : (
                    <>
                      {ev.coordinador_nombre && (
                        <Avatar nombre={ev.coordinador_nombre} apellido={ev.coordinador_apellido} foto_url={ev.coordinador_foto} label="Coordinador/a" />
                      )}
                      {ev.predicador_nombre && (
                        <Avatar nombre={ev.predicador_nombre} apellido={ev.predicador_apellido} foto_url={ev.predicador_foto} label="Predicador/a" />
                      )}
                    </>
                  )}
                </div>
                {ev.notas && (
                  <div className="mt-3 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
                    <p className="text-xs font-semibold text-amber-700 mb-0.5">📝 Notas</p>
                    <p className="text-xs text-amber-900 whitespace-pre-wrap">{ev.notas}</p>
                  </div>
                )}
                {estaLogueado && ev.zoom_link && (
                  <a
                    href={ev.zoom_link}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="mt-3 flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold px-4 py-2 rounded-xl transition"
                  >
                    📹 Conéctate a Zoom
                  </a>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
