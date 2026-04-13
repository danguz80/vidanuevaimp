import React, { useState, useEffect, useMemo } from "react";
import { useAuth } from "../context/AuthContext";
import { useMemberAuth } from "../context/MemberAuthContext";
import CumpleaniosModal from "../components/CumpleaniosModal";

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
            resultado.push({ ...mergeOc(ev, d), _fecha: new Date(d), _key: `${ev.id}-${d.getDate()}` });
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
              resultado.push({ ...mergeOc(ev, d), _fecha: new Date(d), _key: `${ev.id}-${d.getDate()}` });
            d.setDate(d.getDate() + 7);
            count++;
          }
          break;
        }
        case "mensual": {
          const dia = inicio.getDate();
          const fecha = new Date(anio, mes, dia);
          if (fecha.getMonth() === mes)
            resultado.push({ ...mergeOc(ev, fecha), _fecha: fecha, _key: `${ev.id}-m` });
          break;
        }
        case "anual": {
          if (inicio.getMonth() === mes) {
            const fecha = new Date(anio, mes, inicio.getDate());
            resultado.push({ ...mergeOc(ev, fecha), _fecha: fecha, _key: `${ev.id}-a` });
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

function Avatar({ nombre, apellido, foto_url, label }) {
  if (!nombre) return null;
  const initials = `${nombre?.[0] || ""}${apellido?.[0] || ""}`.toUpperCase();
  return (
    <div className="flex items-center gap-2.5">
      {foto_url ? (
        <img src={foto_url} className="w-8 h-8 rounded-full object-cover border border-gray-200 flex-shrink-0" alt="" />
      ) : (
        <div className="w-8 h-8 rounded-full bg-indigo-100 flex items-center justify-center text-xs font-bold text-indigo-600 flex-shrink-0">{initials}</div>
      )}
      <div>
        <p className="text-xs text-gray-400 leading-none mb-0.5">{label}</p>
        <p className="text-sm font-semibold text-gray-800">{nombre} {apellido}</p>
      </div>
    </div>
  );
}

function mergeOc(ev, fecha) {
  if (!ev.ocurrencias || !Array.isArray(ev.ocurrencias)) return ev;
  const fs = fecha.toLocaleDateString("sv");
  const oc = ev.ocurrencias.find(o => o.fecha && String(o.fecha).slice(0, 10) === fs);
  if (!oc) return ev;
  const tieneEncargadoOc = oc.encargado_id   !== undefined && oc.encargado_id   !== null;
  const tieneCoordOc     = oc.coordinador_id !== undefined && oc.coordinador_id !== null;
  const tienePredOc      = oc.predicador_id  !== undefined && oc.predicador_id  !== null;
  return {
    ...ev,
    encargado_nombre:     oc.encargado_nombre    != null ? oc.encargado_nombre    : ev.encargado_nombre,
    encargado_apellido:   oc.encargado_apellido  != null ? oc.encargado_apellido  : ev.encargado_apellido,
    encargado_foto:       tieneEncargadoOc ? oc.encargado_foto   : ev.encargado_foto,
    coordinador_nombre:   oc.coordinador_id !== undefined ? (tieneCoordOc ? oc.coordinador_nombre   : null) : ev.coordinador_nombre,
    coordinador_apellido: oc.coordinador_id !== undefined ? (tieneCoordOc ? oc.coordinador_apellido : null) : ev.coordinador_apellido,
    coordinador_foto:     oc.coordinador_id !== undefined ? (tieneCoordOc ? oc.coordinador_foto     : null) : ev.coordinador_foto,
    predicador_nombre:    oc.predicador_id  !== undefined ? (tienePredOc  ? oc.predicador_nombre    : null) : ev.predicador_nombre,
    predicador_apellido:  oc.predicador_id  !== undefined ? (tienePredOc  ? oc.predicador_apellido  : null) : ev.predicador_apellido,
    predicador_foto:      oc.predicador_id  !== undefined ? (tienePredOc  ? oc.predicador_foto      : null) : ev.predicador_foto,
    notas:                oc.notas != null ? oc.notas : ev.notas,
  };
}

const normUrl = (url) => {
  if (!url) return null;
  if (url.startsWith("http://") || url.startsWith("https://") || url.startsWith("/")) return url;
  return "/" + url;
};

function generarICS(rawEventos, mes, anio) {
  const pad = n => String(n).padStart(2, "0");
  const dtstamp = new Date().toISOString().replace(/[-:.Z]/g, "").slice(0, 15) + "Z";
  const escape = str => str
    ? str.replace(/\\/g, "\\\\").replace(/\n/g, "\\n").replace(/,/g, "\\,").replace(/;/g, "\\;")
    : "";

  const lineas = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Iglesia//Calendario//ES",
    `X-WR-CALNAME:Iglesia - ${MESES[mes]} ${anio}`,
    "X-WR-TIMEZONE:America/Santiago",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
  ];

  const agregarVEVENT = (ev, fecha) => {
    const orig = parseLocalDate(ev.fecha_inicio);
    const isAllDay = !orig || (orig.getHours() === 0 && orig.getMinutes() === 0);
    const yyyy = fecha.getFullYear();
    const mm = pad(fecha.getMonth() + 1);
    const dd = pad(fecha.getDate());
    const diaStr = `${yyyy}${mm}${dd}`;
    let dtstart, dtend;
    if (isAllDay) {
      dtstart = `DTSTART;VALUE=DATE:${diaStr}`;
      const sig = new Date(fecha);
      sig.setDate(sig.getDate() + 1);
      dtend = `DTEND;VALUE=DATE:${sig.getFullYear()}${pad(sig.getMonth()+1)}${pad(sig.getDate())}`;
    } else {
      const hh = pad(orig.getHours());
      const mn = pad(orig.getMinutes());
      dtstart = `DTSTART:${diaStr}T${hh}${mn}00`;
      if (ev.fecha_fin) {
        const fin = parseLocalDate(ev.fecha_fin);
        dtend = `DTEND:${diaStr}T${pad(fin.getHours())}${pad(fin.getMinutes())}00`;
      } else {
        dtend = `DTEND:${diaStr}T${hh}${mn}00`;
      }
    }
    // Construir DESCRIPTION con descripción + personas + zoom
    const partesDesc = [];
    if (ev.descripcion) partesDesc.push(ev.descripcion);
    if (ev.encargado_nombre)   partesDesc.push(`Encargado/a: ${ev.encargado_nombre} ${ev.encargado_apellido || ""} `.trim());
    if (ev.coordinador_nombre) partesDesc.push(`Coordinador/a: ${ev.coordinador_nombre} ${ev.coordinador_apellido || ""} `.trim());
    if (ev.predicador_nombre)  partesDesc.push(`Predicador/a: ${ev.predicador_nombre} ${ev.predicador_apellido || ""} `.trim());
    if (ev.zoom_link)          partesDesc.push(`Zoom: ${ev.zoom_link}`);

    lineas.push(
      "BEGIN:VEVENT",
      `UID:ev-${ev.id}-${diaStr}@iglesia`,
      `DTSTAMP:${dtstamp}`,
      dtstart, dtend,
      `SUMMARY:${escape(ev.titulo)}`,
    );
    if (partesDesc.length > 0) lineas.push(`DESCRIPTION:${escape(partesDesc.join("\n"))}`);
    if (ev.lugar)     lineas.push(`LOCATION:${escape(ev.lugar)}`);
    if (ev.zoom_link) lineas.push(`URL:${ev.zoom_link}`);
    lineas.push("END:VEVENT");
  };

  for (const ev of rawEventos) {
    const inicio = parseLocalDate(ev.fecha_inicio);
    if (!inicio) continue;

    if (ev.tipo === "recurrente" && ev.recurrencia && ev.recurrencia !== "ninguna") {
      switch (ev.recurrencia) {
        case "semanal": {
          const diaSemana = ev.dia_semana ?? inicio.getDay();
          let d = new Date(anio, mes, 1);
          while (d.getDay() !== diaSemana) d.setDate(d.getDate() + 1);
          while (d.getMonth() === mes) {
            agregarVEVENT(ev, new Date(d));
            d.setDate(d.getDate() + 7);
          }
          break;
        }
        case "quincenal": {
          const diaSemana = ev.dia_semana ?? inicio.getDay();
          let d = new Date(anio, mes, 1);
          while (d.getDay() !== diaSemana) d.setDate(d.getDate() + 1);
          let count = 0;
          while (d.getMonth() === mes) {
            if (count % 2 === 0) agregarVEVENT(ev, new Date(d));
            d.setDate(d.getDate() + 7);
            count++;
          }
          break;
        }
        case "mensual": {
          const fecha = new Date(anio, mes, inicio.getDate());
          if (fecha.getMonth() === mes) agregarVEVENT(ev, fecha);
          break;
        }
        case "anual": {
          if (inicio.getMonth() === mes) {
            agregarVEVENT(ev, new Date(anio, mes, inicio.getDate()));
          }
          break;
        }
        default: break;
      }
    } else {
      if (inicio.getFullYear() === anio && inicio.getMonth() === mes) {
        agregarVEVENT(ev, inicio);
      }
    }
  }

  lineas.push("END:VCALENDAR");
  return lineas.join("\r\n");
}

export default function Calendario() {
  const { user: adminUser, getToken } = useAuth();
  const { miembro, getToken: getMiembroToken } = useMemberAuth();
  const estaLogueado = !!(adminUser || miembro);

  const [eventos, setEventos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [hoy] = useState(new Date());
  const [mesActual, setMesActual] = useState(new Date().getMonth());
  const [anioActual, setAnioActual] = useState(new Date().getFullYear());
  const [diaSeleccionado, setDiaSeleccionado] = useState(null);
  const [vistaEvento, setVistaEvento] = useState(null);

  // Cumpleaños
  const [cumpleanos, setCumpleanos] = useState([]);
  const [modalCumple, setModalCumple] = useState(null);

  useEffect(() => {
    const token = adminUser ? getToken() : miembro ? getMiembroToken() : null;
    const url = token ? `${API}/api/eventos/autenticados` : `${API}/api/eventos/publicos`;
    const headers = token ? { Authorization: `Bearer ${token}` } : {};
    fetch(url, { headers })
      .then(r => r.json())
      .then(data => setEventos(Array.isArray(data) ? data : []))
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [adminUser, miembro]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    const token = localStorage.getItem("token") || localStorage.getItem("miembro_token");
    if (!token) { setCumpleanos([]); return; }
    fetch(`${API}/api/cumpleanos/mes?mes=${mesActual + 1}`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then(r => r.ok ? r.json() : [])
      .then(data => setCumpleanos(Array.isArray(data) ? data : []))
      .catch(() => setCumpleanos([]));
  }, [mesActual, estaLogueado]);

  const cumpleaniosPorDia = useMemo(() => {
    const mapa = {};
    for (const m of cumpleanos) {
      if (!m.fecha_nacimiento) continue;
      const f = new Date(m.fecha_nacimiento);
      const dia = f.getUTCDate();
      if (!mapa[dia]) mapa[dia] = [];
      mapa[dia].push(m);
    }
    return mapa;
  }, [cumpleanos]);

  const diasDesdeCumple = (m) => {
    if (!m?.fecha_nacimiento) return 999;
    const ahora = new Date();
    const f = new Date(m.fecha_nacimiento);
    const cumple = new Date(Date.UTC(ahora.getUTCFullYear(), f.getUTCMonth(), f.getUTCDate()));
    const hoyUTC = new Date(Date.UTC(ahora.getUTCFullYear(), ahora.getUTCMonth(), ahora.getUTCDate()));
    let diff = Math.floor((hoyUTC - cumple) / 86400000);
    if (diff < 0) {
      const prev = new Date(Date.UTC(ahora.getUTCFullYear() - 1, f.getUTCMonth(), f.getUTCDate()));
      diff = Math.floor((hoyUTC - prev) / 86400000);
    }
    return diff;
  };

  const cerrarModalCumple = () => {
    setModalCumple(null);
  };

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

  const exportarICS = () => {
    if (eventos.length === 0) return;
    const contenido = generarICS(eventos, mesActual, anioActual);
    const blob = new Blob([contenido], { type: "text/calendar;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `iglesia-${MESES[mesActual].toLowerCase()}-${anioActual}.ics`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

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
              <div className="flex items-center gap-1">
                {estaLogueado && eventosExpandidos.length > 0 && (
                  <button
                    onClick={exportarICS}
                    title={`Exportar eventos de ${MESES[mesActual]} al calendario`}
                    className="flex items-center gap-1.5 text-xs text-indigo-600 hover:text-indigo-800 hover:bg-indigo-50 px-2.5 py-1.5 rounded-lg transition font-medium border border-indigo-200"
                  >
                    📅 <span className="hidden sm:inline">Exportar .ics</span>
                  </button>
                )}
                <button
                  onClick={mesSiguiente}
                  className="p-2 hover:bg-gray-100 rounded-full transition text-xl"
                >›</button>
              </div>
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
                        {estaLogueado && (cumpleaniosPorDia[dia] || []).map(m => (
                          <div
                            key={`b-${m.id}`}
                            onClick={e => { e.stopPropagation(); setModalCumple(m); }}
                            className={`text-xs truncate rounded px-1 py-0.5 font-medium cursor-pointer transition ${m.sexo === 'masculino' ? 'bg-blue-100 text-blue-800 hover:bg-blue-200' : 'bg-pink-100 text-pink-700 hover:bg-pink-200'}`}
                            title={`Cumpleaños: ${m.nombre} ${m.apellido}`}
                          >
                            🎂 {m.nombre} {m.apellido}
                          </div>
                        ))}
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
                {estaLogueado && (cumpleaniosPorDia[diaSeleccionado] || []).length > 0 && (
                  <div className="mb-3 border-b border-pink-100 pb-3">
                    <p className="text-xs font-semibold text-pink-500 uppercase tracking-wide mb-1">🎂 Cumpleaños</p>
                    <div className="space-y-1">
                      {(cumpleaniosPorDia[diaSeleccionado] || []).map(m => (
                        <div
                          key={`bd-${m.id}`}
                          className={`flex items-center gap-2 rounded-lg px-3 py-2 cursor-pointer hover:opacity-80 transition ${m.sexo === 'masculino' ? 'bg-blue-50' : 'bg-pink-50'}`}
                          onClick={() => setModalCumple(m)}
                        >
                          {m.foto_url ? (
                            <img src={m.foto_url} alt="" className="w-7 h-7 rounded-full object-cover flex-shrink-0" />
                          ) : (
                            <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0 ${m.sexo === 'masculino' ? 'bg-blue-200 text-blue-700' : 'bg-pink-200 text-pink-600'}`}>
                              {m.nombre[0]}{m.apellido?.[0]}
                            </div>
                          )}
                          <span className="text-sm font-medium text-gray-800">{m.nombre} {m.apellido}</span>
                          <span className={`ml-auto text-xs font-semibold ${m.sexo === 'masculino' ? 'text-blue-600' : 'text-pink-500'}`}>{m.edad} años</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
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

              {/* Personas asignadas */}
              {(vistaEvento.encargado_nombre || vistaEvento.coordinador_nombre || vistaEvento.predicador_nombre) && (
                <div className="bg-gray-50 rounded-xl p-3 mb-3 space-y-2.5">
                  <Avatar nombre={vistaEvento.encargado_nombre}   apellido={vistaEvento.encargado_apellido}   foto_url={vistaEvento.encargado_foto}   label="Encargado" />
                  <Avatar nombre={vistaEvento.coordinador_nombre} apellido={vistaEvento.coordinador_apellido} foto_url={vistaEvento.coordinador_foto} label="Coordinador" />
                  <Avatar nombre={vistaEvento.predicador_nombre}  apellido={vistaEvento.predicador_apellido}  foto_url={vistaEvento.predicador_foto}  label="Predicador" />
                </div>
              )}

              {vistaEvento.descripcion && (
                <div className="text-sm text-gray-700 whitespace-pre-line mb-3">
                  {renderTexto(vistaEvento.descripcion)}
                </div>
              )}

              {vistaEvento.notas && (
                <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3 mb-3 text-sm text-yellow-800 whitespace-pre-line">
                  📝 {vistaEvento.notas}
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

      {/* Modal Cumpleaños 🎉 */}
      {modalCumple && (
        <CumpleaniosModal
          miembro={modalCumple}
          diasDesde={diasDesdeCumple(modalCumple)}
          onClose={cerrarModalCumple}
          onEnviarSaludo={async (texto, deNombre) => {
            const adminToken = localStorage.getItem("token");
            const miembroToken = localStorage.getItem("miembro_token");
            const token = adminToken || miembroToken;
            const endpoint = adminToken ? "/api/cumple-saludos" : "/api/cumple-saludos/from-member";
            const body = adminToken
              ? { para_miembro_id: modalCumple.id, de_nombre: deNombre, mensaje: texto, publico: false }
              : { para_miembro_id: modalCumple.id, mensaje: texto, publico: false };
            const res = await fetch(`${API}${endpoint}`, {
              method: "POST",
              headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
              body: JSON.stringify(body),
            });
            if (!res.ok) { const d = await res.json(); throw new Error(d.error || "Error al enviar"); }
          }}
        />
      )}
    </div>
  );
}
