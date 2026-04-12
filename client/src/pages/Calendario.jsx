import React, { useState, useEffect } from "react";

const API = import.meta.env.VITE_BACKEND_URL;

const DIAS_SEMANA = ["Lun", "Mar", "Mié", "Jue", "Vie", "Sáb", "Dom"];
const MESES = ["Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio",
               "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"];

function parseLocalDate(str) {
  if (!str) return null;
  return new Date(str.slice(0, 16));
}

function diasEnMes(anio, mes) {
  return new Date(anio, mes + 1, 0).getDate();
}

function primerDiaMes(anio, mes) {
  const dia = new Date(anio, mes, 1).getDay();
  return dia === 0 ? 6 : dia - 1;
}

function expandirEventos(eventos, anio, mes) {
  const resultado = [];
  const ultimoDia = new Date(anio, mes + 1, 0);

  for (const ev of eventos) {
    const inicio = parseLocalDate(ev.fecha_inicio);
    if (!inicio) continue;

    if (ev.tipo === "recurrente" && ev.recurrencia !== "ninguna") {
      switch (ev.recurrencia) {
        case "semanal": {
          const diaSemana = ev.dia_semana ?? inicio.getDay();
          let d = new Date(anio, mes, 1);
          while (d.getDay() !== diaSemana) d.setDate(d.getDate() + 1);
          while (d <= ultimoDia) {
            resultado.push({ ...ev, _fecha: new Date(d), _key: `${ev.id}-${d.getDate()}` });
            d.setDate(d.getDate() + 7);
          }
          break;
        }
        case "quincenal": {
          const diaSemana = ev.dia_semana ?? inicio.getDay();
          let d = new Date(anio, mes, 1);
          while (d.getDay() !== diaSemana) d.setDate(d.getDate() + 1);
          let count = 0;
          while (d <= ultimoDia) {
            if (count % 2 === 0)
              resultado.push({ ...ev, _fecha: new Date(d), _key: `${ev.id}-${d.getDate()}` });
            d.setDate(d.getDate() + 7);
            count++;
          }
          break;
        }
        case "mensual": {
          const dia = inicio.getDate();
          const fecha = new Date(anio, mes, dia);
          if (fecha.getMonth() === mes)
            resultado.push({ ...ev, _fecha: fecha, _key: `${ev.id}-m` });
          break;
        }
        case "anual": {
          if (inicio.getMonth() === mes) {
            const fecha = new Date(anio, mes, inicio.getDate());
            resultado.push({ ...ev, _fecha: fecha, _key: `${ev.id}-a` });
          }
          break;
        }
        default: break;
      }
    } else {
      if (inicio.getFullYear() === anio && inicio.getMonth() === mes) {
        resultado.push({ ...ev, _fecha: inicio, _key: `${ev.id}` });
      }
    }
  }
  return resultado;
}

function renderTexto(texto) {
  if (!texto) return null;
  const urlRegex = /(https?:\/\/[^\s]+)/g;
  const partes = texto.split(urlRegex);
  return partes.map((parte, i) =>
    urlRegex.test(parte)
      ? <a key={i} href={parte} target="_blank" rel="noopener noreferrer"
           className="text-blue-600 underline hover:text-blue-800 break-all">{parte}</a>
      : parte
  );
}

const normUrl = (url) => {
  if (!url) return null;
  if (url.startsWith("http://") || url.startsWith("https://") || url.startsWith("/")) return url;
  return "/" + url;
};

export default function Calendario() {
  const [eventos, setEventos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [hoy] = useState(new Date());
  const [mesActual, setMesActual] = useState(new Date().getMonth());
  const [anioActual, setAnioActual] = useState(new Date().getFullYear());
  const [diaSeleccionado, setDiaSeleccionado] = useState(null);
  const [vistaEvento, setVistaEvento] = useState(null);

  useEffect(() => {
    fetch(`${API}/api/eventos/publicos`)
      .then(r => r.json())
      .then(data => setEventos(Array.isArray(data) ? data : []))
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  const mesAnterior = () => {
    if (mesActual === 0) { setMesActual(11); setAnioActual(a => a - 1); }
    else setMesActual(m => m - 1);
  };
  const mesSiguiente = () => {
    if (mesActual === 11) { setMesActual(0); setAnioActual(a => a + 1); }
    else setMesActual(m => m + 1);
  };

  const totalDias = diasEnMes(anioActual, mesActual);
  const primerDia = primerDiaMes(anioActual, mesActual);
  const eventosExpandidos = expandirEventos(eventos, anioActual, mesActual);

  const eventosPorDia = {};
  for (const ev of eventosExpandidos) {
    const dia = ev._fecha.getDate();
    if (!eventosPorDia[dia]) eventosPorDia[dia] = [];
    eventosPorDia[dia].push(ev);
  }
  for (const dia in eventosPorDia) {
    eventosPorDia[dia].sort((a, b) => {
      const tA = a.fecha_inicio ? a.fecha_inicio.slice(11, 16) : "00:00";
      const tB = b.fecha_inicio ? b.fecha_inicio.slice(11, 16) : "00:00";
      return tA.localeCompare(tB);
    });
  }

  const esHoy = (dia) =>
    dia === hoy.getDate() && mesActual === hoy.getMonth() && anioActual === hoy.getFullYear();

  const proximosEventos = eventosExpandidos
    .filter(ev => {
      const hoyDate = new Date(hoy.getFullYear(), hoy.getMonth(), hoy.getDate());
      return ev._fecha >= hoyDate;
    })
    .sort((a, b) => a._fecha - b._fecha)
    .slice(0, 8);

  const celdasVacias = Array(primerDia).fill(null);
  const dias = Array.from({ length: totalDias }, (_, i) => i + 1);

  return (
    <div className="p-4 md:p-6 max-w-7xl mx-auto">
      <div className="mb-6">
        <h1 className="text-3xl font-bold text-gray-800">Calendario</h1>
        <p className="text-gray-500 mt-1">Actividades y eventos de la iglesia</p>
      </div>

      {loading ? (
        <div className="py-20 text-center text-gray-400">Cargando calendario…</div>
      ) : (
        <div className="grid grid-cols-1 xl:grid-cols-4 gap-6">
          {/* Calendario */}
          <div className="xl:col-span-3">
            {/* Navegación mes */}
            <div className="flex items-center justify-between mb-4">
              <button
                onClick={mesAnterior}
                className="p-2 hover:bg-gray-100 rounded-full transition text-xl"
              >‹</button>
              <h2 className="text-xl font-bold text-gray-800">
                {MESES[mesActual]} {anioActual}
              </h2>
              <button
                onClick={mesSiguiente}
                className="p-2 hover:bg-gray-100 rounded-full transition text-xl"
              >›</button>
            </div>

            {/* Grilla */}
            <div className="bg-white rounded-2xl shadow overflow-hidden">
              <div className="grid grid-cols-7 bg-gray-100">
                {DIAS_SEMANA.map(d => (
                  <div key={d} className="text-center text-xs font-semibold text-gray-500 py-2">{d}</div>
                ))}
              </div>
              <div className="grid grid-cols-7">
                {celdasVacias.map((_, i) => (
                  <div key={`v-${i}`} className="border-t border-r border-gray-100 min-h-[80px] bg-gray-50/50 p-1" />
                ))}
                {dias.map(dia => {
                  const evsDia = eventosPorDia[dia] || [];
                  const activo = diaSeleccionado === dia;
                  return (
                    <div
                      key={dia}
                      onClick={() => setDiaSeleccionado(activo ? null : dia)}
                      className={`border-t border-r border-gray-100 min-h-[80px] p-1 cursor-pointer transition ${
                        activo ? "bg-blue-50" : "hover:bg-gray-50"
                      }`}
                    >
                      <div className={`text-xs font-semibold mb-1 w-6 h-6 flex items-center justify-center rounded-full ${
                        esHoy(dia) ? "bg-blue-600 text-white" : "text-gray-600"
                      }`}>{dia}</div>
                      <div className="space-y-0.5">
                        {evsDia.slice(0, 3).map(ev => (
                          <div
                            key={ev._key}
                            onClick={e => { e.stopPropagation(); setVistaEvento(ev); }}
                            className="text-xs truncate rounded px-1 py-0.5 text-white font-medium cursor-pointer hover:opacity-80 transition"
                            style={{ backgroundColor: ev.color || "#3B82F6" }}
                          >
                            {ev.titulo}
                          </div>
                        ))}
                        {evsDia.length > 3 && (
                          <div className="text-xs text-gray-400 pl-1">+{evsDia.length - 3} más</div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Detalle día seleccionado */}
            {diaSeleccionado && (
              <div className="mt-4 bg-white rounded-xl shadow p-4">
                <h3 className="font-bold text-gray-800 mb-3">
                  {diaSeleccionado} de {MESES[mesActual]} {anioActual}
                </h3>
                {(eventosPorDia[diaSeleccionado] || []).length === 0 ? (
                  <p className="text-gray-400 text-sm">Sin eventos este día.</p>
                ) : (
                  <div className="space-y-2">
                    {(eventosPorDia[diaSeleccionado] || []).map(ev => (
                      <div
                        key={ev._key}
                        className="flex items-center gap-3 p-3 rounded-lg border hover:bg-gray-50 cursor-pointer transition"
                        onClick={() => setVistaEvento(ev)}
                      >
                        <div className="w-3 h-3 rounded-full flex-shrink-0" style={{ background: ev.color }} />
                        <div className="flex-1">
                          <p className="font-semibold text-gray-800 text-sm">{ev.titulo}</p>
                          {ev.lugar && <p className="text-xs text-gray-400">📍 {ev.lugar}</p>}
                        </div>
                        {ev.fecha_inicio && (() => {
                          const h = parseLocalDate(ev.fecha_inicio);
                          if (h && !(h.getHours() === 0 && h.getMinutes() === 0))
                            return <span className="text-xs text-gray-500">{h.toLocaleTimeString("es-CL", { hour: "2-digit", minute: "2-digit" })}</span>;
                        })()}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Sidebar — Próximos eventos */}
          <div className="space-y-4">
            <h3 className="font-bold text-gray-700 text-lg">Próximos Eventos</h3>
            {proximosEventos.length === 0 ? (
              <p className="text-gray-400 text-sm">No hay eventos próximos.</p>
            ) : (
              <div className="space-y-3">
                {proximosEventos.map(ev => (
                  <div
                    key={ev._key}
                    onClick={() => setVistaEvento(ev)}
                    className="bg-white rounded-xl shadow-sm p-3 cursor-pointer hover:shadow-md transition border-l-4"
                    style={{ borderLeftColor: ev.color || "#3B82F6" }}
                  >
                    <p className="font-semibold text-gray-800 text-sm">{ev.titulo}</p>
                    <p className="text-xs text-gray-500 mt-0.5">
                      {ev._fecha.toLocaleDateString("es-CL", {
                        weekday: "long", day: "numeric", month: "short"
                      })}
                    </p>
                    {ev.fecha_inicio && (() => {
                      const h = parseLocalDate(ev.fecha_inicio);
                      if (h && !(h.getHours() === 0 && h.getMinutes() === 0))
                        return <p className="text-xs text-blue-600 font-medium mt-0.5">🕐 {h.toLocaleTimeString("es-CL", { hour: "2-digit", minute: "2-digit" })}</p>;
                    })()}
                    {ev.lugar && <p className="text-xs text-gray-400 mt-0.5">📍 {ev.lugar}</p>}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Modal detalle evento */}
      {vistaEvento && (
        <div
          className="fixed inset-0 bg-black/50 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4"
          onClick={() => setVistaEvento(null)}
        >
          <div
            className="bg-white rounded-t-2xl sm:rounded-2xl shadow-2xl w-full sm:max-w-md max-h-[92vh] flex flex-col overflow-hidden"
            onClick={e => e.stopPropagation()}
          >
            {vistaEvento.imagen_url && (
              <img
                src={normUrl(vistaEvento.imagen_url)}
                alt={vistaEvento.titulo}
                className="w-full h-40 object-cover rounded-t-2xl shrink-0"
              />
            )}
            <div className="p-6 overflow-y-auto flex-1">
              <div className="flex items-start gap-3 mb-4">
                <div className="w-4 h-4 rounded-full mt-1 flex-shrink-0" style={{ background: vistaEvento.color || "#3B82F6" }} />
                <div>
                  <h3 className="text-xl font-bold text-gray-800">{vistaEvento.titulo}</h3>
                  <p className="text-sm text-gray-500 capitalize mt-0.5">
                    {vistaEvento._fecha.toLocaleDateString("es-CL", {
                      weekday: "long", year: "numeric", month: "long", day: "numeric"
                    })}
                  </p>
                  {vistaEvento.fecha_inicio && (() => {
                    const h = parseLocalDate(vistaEvento.fecha_inicio);
                    if (h && !(h.getHours() === 0 && h.getMinutes() === 0))
                      return (
                        <span className="inline-flex items-center gap-1 bg-blue-50 border border-blue-200 text-blue-700 text-xs font-semibold px-2.5 py-0.5 rounded-full mt-1">
                          🕐 {h.toLocaleTimeString("es-CL", { hour: "2-digit", minute: "2-digit" })}
                        </span>
                      );
                  })()}
                </div>
              </div>

              {vistaEvento.lugar && (
                <div className="flex items-center gap-2 mb-3 text-sm text-gray-600">
                  <span>📍</span>
                  <span>{vistaEvento.lugar}</span>
                </div>
              )}

              {vistaEvento.zoom_link && (
                <a
                  href={vistaEvento.zoom_link}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 mb-3 text-sm text-blue-600 hover:underline"
                >
                  🎥 Unirse por Zoom
                </a>
              )}

              {vistaEvento.descripcion && (
                <div className="text-sm text-gray-700 whitespace-pre-line mb-3">
                  {renderTexto(vistaEvento.descripcion)}
                </div>
              )}

              {vistaEvento.tipo === "recurrente" && (
                <span className="inline-block text-xs px-2 py-0.5 rounded-full bg-purple-100 text-purple-700 mt-1">
                  🔁 {vistaEvento.recurrencia}
                </span>
              )}
            </div>

            <div className="border-t p-4 flex justify-end shrink-0">
              <button
                onClick={() => setVistaEvento(null)}
                className="bg-gray-100 hover:bg-gray-200 text-gray-700 px-5 py-2 rounded-lg text-sm font-medium transition"
              >
                Cerrar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
