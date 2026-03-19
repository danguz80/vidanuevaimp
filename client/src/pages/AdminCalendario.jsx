import React, { useState, useEffect } from "react";
import { useAuth } from "../context/AuthContext";
import AdminNav from "../components/AdminNav";

const API = import.meta.env.VITE_BACKEND_URL;

const DIAS_SEMANA = ["Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado", "Domingo"];
const MESES = ["Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio", "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"];

const COLORES_EVENTO = [
  { label: "Azul",   value: "#3B82F6" },
  { label: "Verde",  value: "#10B981" },
  { label: "Morado", value: "#8B5CF6" },
  { label: "Rojo",   value: "#EF4444" },
  { label: "Naranja",value: "#F97316" },
  { label: "Amarillo",value: "#EAB308" },
  { label: "Rosa",   value: "#EC4899" },
  { label: "Gris",   value: "#6B7280" },
];

const FORM_INICIAL = {
  titulo: "",
  descripcion: "",
  imagen_url: "",
  fecha_inicio: "",
  fecha_fin: "",
  lugar: "",
  tipo: "especial",
  recurrencia: "ninguna",
  dia_semana: "",
  coordinador_id: "",
  predicador_id: "",
  notas: "",
  color: "#3B82F6",
};

function diasEnMes(anio, mes) {
  return new Date(anio, mes + 1, 0).getDate();
}

// Devuelve el offset lunes=0 … domingo=6
function primerDiaMes(anio, mes) {
  const dia = new Date(anio, mes, 1).getDay(); // 0=dom,1=lun…6=sab
  return dia === 0 ? 6 : dia - 1;
}

// Aplica el override de ocurrencia (si existe para esa fecha) sobre un evento base
function mergeOc(ev, fecha) {
  if (!ev.ocurrencias || !Array.isArray(ev.ocurrencias)) return ev;
  const fs = fecha.toISOString().slice(0, 10);
  const oc = ev.ocurrencias.find(o => o.fecha && String(o.fecha).slice(0, 10) === fs);
  if (!oc) return ev;
  return {
    ...ev,
    coordinador_id:       oc.coordinador_id      !== undefined ? oc.coordinador_id      : ev.coordinador_id,
    coordinador_nombre:   oc.coordinador_nombre  != null      ? oc.coordinador_nombre  : ev.coordinador_nombre,
    coordinador_apellido: oc.coordinador_apellido != null     ? oc.coordinador_apellido : ev.coordinador_apellido,
    predicador_id:        oc.predicador_id       !== undefined ? oc.predicador_id       : ev.predicador_id,
    predicador_nombre:    oc.predicador_nombre   != null      ? oc.predicador_nombre   : ev.predicador_nombre,
    predicador_apellido:  oc.predicador_apellido != null      ? oc.predicador_apellido  : ev.predicador_apellido,
    notas:                oc.notas               != null      ? oc.notas                : ev.notas,
  };
}

// Expande un evento recurrente dentro de un mes dado
function expandirEventos(eventos, anio, mes) {
  const resultado = [];
  const primerDia = new Date(anio, mes, 1);
  const ultimoDia = new Date(anio, mes + 1, 0);

  for (const ev of eventos) {
    const inicio = new Date(ev.fecha_inicio);

    if (ev.tipo === "recurrente" && ev.recurrencia !== "ninguna") {
      switch (ev.recurrencia) {
        case "semanal": {
          const diaSemana = ev.dia_semana ?? inicio.getDay();
          // Encontrar el primer día del mes que coincida con el día de semana
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
            if (count % 2 === 0) {
              resultado.push({ ...mergeOc(ev, d), _fecha: new Date(d), _key: `${ev.id}-${d.getDate()}` });
            }
            d.setDate(d.getDate() + 7);
            count++;
          }
          break;
        }
        case "mensual": {
          const dia = inicio.getDate();
          const fecha = new Date(anio, mes, dia);
          if (fecha >= primerDia && fecha <= ultimoDia) {
            resultado.push({ ...mergeOc(ev, fecha), _fecha: fecha, _key: `${ev.id}-m` });
          }
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
      // Evento especial (una sola vez)
      if (inicio.getFullYear() === anio && inicio.getMonth() === mes) {
        resultado.push({ ...mergeOc(ev, inicio), _fecha: inicio, _key: `${ev.id}` });
      }
    }
  }
  return resultado;
}

// Normaliza URLs relativas añadiendo / al inicio si es necesario
const normUrl = (url) => {
  if (!url) return null;
  if (url.startsWith("http://") || url.startsWith("https://") || url.startsWith("/")) return url;
  return "/" + url;
};

export default function AdminCalendario() {
  const { getToken } = useAuth();
  const [eventos, setEventos] = useState([]);
  const [miembros, setMiembros] = useState([]);
  const [loading, setLoading] = useState(true);
  const [hoy] = useState(new Date());
  const [mesActual, setMesActual] = useState(new Date().getMonth());
  const [anioActual, setAnioActual] = useState(new Date().getFullYear());
  const [modalAbierto, setModalAbierto] = useState(false);
  const [editando, setEditando] = useState(null);
  const [form, setForm] = useState(FORM_INICIAL);
  const [guardando, setGuardando] = useState(false);
  const [diaSeleccionado, setDiaSeleccionado] = useState(null);
  const [vistaEvento, setVistaEvento] = useState(null);
  const [ocForm, setOcForm] = useState({ coordinador_id: "", predicador_id: "", notas: "" });
  const [guardandoOc, setGuardandoOc] = useState(false);

  const headers = () => ({ Authorization: `Bearer ${getToken()}` });

  const cargar = async () => {
    try {
      const [resEv, resMem] = await Promise.all([
        fetch(`${API}/api/eventos`, { headers: headers() }),
        fetch(`${API}/api/miembros`, { headers: headers() }),
      ]);
      const ev = await resEv.json();
      const mem = await resMem.json();
      setEventos(Array.isArray(ev) ? ev : []);
      setMiembros(Array.isArray(mem) ? mem : []);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { cargar(); }, []);

  const mesAnterior = () => {
    if (mesActual === 0) { setMesActual(11); setAnioActual(a => a - 1); }
    else setMesActual(m => m - 1);
  };
  const mesSiguiente = () => {
    if (mesActual === 11) { setMesActual(0); setAnioActual(a => a + 1); }
    else setMesActual(m => m + 1);
  };

  const abrirNuevo = (diaInicio = null) => {
    setEditando(null);
    const fechaBase = diaInicio
      ? new Date(anioActual, mesActual, diaInicio)
      : new Date();
    const iso = fechaBase.toISOString().slice(0, 16);
    setForm({ ...FORM_INICIAL, fecha_inicio: iso });
    setModalAbierto(true);
  };

  const abrirEditar = (ev) => {
    setVistaEvento(null);
    setEditando(ev.id);
    setForm({
      titulo: ev.titulo || "",
      descripcion: ev.descripcion || "",
      imagen_url: ev.imagen_url || "",
      fecha_inicio: ev.fecha_inicio ? ev.fecha_inicio.slice(0, 16) : "",
      fecha_fin: ev.fecha_fin ? ev.fecha_fin.slice(0, 16) : "",
      lugar: ev.lugar || "",
      tipo: ev.tipo || "especial",
      recurrencia: ev.recurrencia || "ninguna",
      dia_semana: ev.dia_semana ?? "",
      coordinador_id: ev.coordinador_id || "",
      predicador_id: ev.predicador_id || "",
      notas: ev.notas || "",
      color: ev.color || "#3B82F6",
    });
    setModalAbierto(true);
  };

  const cerrarModal = () => {
    setModalAbierto(false);
    setEditando(null);
    setForm(FORM_INICIAL);
  };

  // Sincroniza el formulario de ocurrencia al seleccionar un evento recurrente
  useEffect(() => {
    if (vistaEvento && vistaEvento.tipo === "recurrente") {
      setOcForm({
        coordinador_id: vistaEvento.coordinador_id ? String(vistaEvento.coordinador_id) : "",
        predicador_id:  vistaEvento.predicador_id  ? String(vistaEvento.predicador_id)  : "",
        notas:          vistaEvento.notas || "",
      });
    }
  }, [vistaEvento]);

  const guardarOcurrencia = async () => {
    if (!vistaEvento || !vistaEvento._fecha) return;
    setGuardandoOc(true);
    try {
      const fecha = vistaEvento._fecha.toISOString().slice(0, 10);
      const res = await fetch(`${API}/api/eventos/${vistaEvento.id}/ocurrencias`, {
        method: "POST",
        headers: { ...headers(), "Content-Type": "application/json" },
        body: JSON.stringify({
          fecha,
          coordinador_id: ocForm.coordinador_id || null,
          predicador_id:  ocForm.predicador_id  || null,
          notas:          ocForm.notas          || null,
        }),
      });
      if (!res.ok) throw new Error("Error al guardar");
      await cargar();
      setVistaEvento(null);
    } catch {
      alert("Error al guardar la asignación para esta fecha.");
    } finally {
      setGuardandoOc(false);
    }
  };

  const guardar = async () => {
    if (!form.titulo.trim() || !form.fecha_inicio) {
      alert("Título y fecha de inicio son obligatorios");
      return;
    }
    setGuardando(true);
    try {
      const url = editando ? `${API}/api/eventos/${editando}` : `${API}/api/eventos`;
      const method = editando ? "PUT" : "POST";
      const body = {
        ...form,
        dia_semana: form.dia_semana !== "" ? parseInt(form.dia_semana) : null,
        coordinador_id: form.coordinador_id || null,
        predicador_id: form.predicador_id || null,
      };
      const res = await fetch(url, {
        method,
        headers: { ...headers(), "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) throw new Error("Error al guardar");
      await cargar();
      cerrarModal();
    } catch (e) {
      alert("Error al guardar el evento");
    } finally {
      setGuardando(false);
    }
  };

  const eliminar = async (id) => {
    if (!confirm("¿Eliminar este evento?")) return;
    try {
      await fetch(`${API}/api/eventos/${id}`, { method: "DELETE", headers: headers() });
      setEventos(prev => prev.filter(e => e.id !== id));
      setVistaEvento(null);
    } catch (e) {
      alert("Error al eliminar");
    }
  };

  // Construir la grilla del mes
  const totalDias = diasEnMes(anioActual, mesActual);
  const primerDia = primerDiaMes(anioActual, mesActual);
  const eventosExpandidos = expandirEventos(eventos, anioActual, mesActual);

  const eventosPorDia = {};
  for (const ev of eventosExpandidos) {
    const dia = ev._fecha.getDate();
    if (!eventosPorDia[dia]) eventosPorDia[dia] = [];
    eventosPorDia[dia].push(ev);
  }

  const celdasVacias = Array(primerDia).fill(null);
  const dias = Array.from({ length: totalDias }, (_, i) => i + 1);

  const esHoy = (dia) =>
    dia === hoy.getDate() && mesActual === hoy.getMonth() && anioActual === hoy.getFullYear();

  // Vista lista de próximos eventos
  const proximosEventos = eventosExpandidos
    .filter(ev => {
      const f = ev._fecha;
      const hoyDate = new Date(hoy.getFullYear(), hoy.getMonth(), hoy.getDate());
      return f >= hoyDate;
    })
    .sort((a, b) => a._fecha - b._fecha)
    .slice(0, 8);

  return (
    <>
      <AdminNav />
      <div className="p-4 md:p-6 max-w-7xl mx-auto">
        {/* Encabezado */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
          <div>
            <h1 className="text-3xl font-bold text-gray-800">Calendario</h1>
            <p className="text-gray-500 mt-1">{eventos.length} evento{eventos.length !== 1 ? "s" : ""} registrado{eventos.length !== 1 ? "s" : ""}</p>
          </div>
          <button
            onClick={() => abrirNuevo()}
            className="bg-blue-600 hover:bg-blue-700 text-white font-semibold py-2 px-5 rounded-lg transition flex items-center gap-2"
          >
            <span className="text-xl leading-none">+</span> Nuevo Evento
          </button>
        </div>

        <div className="grid grid-cols-1 xl:grid-cols-4 gap-6">
          {/* Calendario */}
          <div className="xl:col-span-3">
            {/* Navegación mes */}
            <div className="flex items-center justify-between mb-4">
              <button onClick={mesAnterior} className="p-2 hover:bg-gray-100 rounded-full transition text-xl">‹</button>
              <h2 className="text-xl font-bold text-gray-800">
                {MESES[mesActual]} {anioActual}
              </h2>
              <button onClick={mesSiguiente} className="p-2 hover:bg-gray-100 rounded-full transition text-xl">›</button>
            </div>

            {/* Grilla */}
            <div className="bg-white rounded-2xl shadow overflow-hidden">
              {/* Días de la semana */}
              <div className="grid grid-cols-7 bg-gray-100">
                {DIAS_SEMANA.map(d => (
                  <div key={d} className="text-center text-xs font-semibold text-gray-500 py-2">
                    {d.slice(0, 3)}
                  </div>
                ))}
              </div>

              {/* Celdas */}
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
                <div className="flex justify-between items-center mb-3">
                  <h3 className="font-bold text-gray-800">
                    {diaSeleccionado} de {MESES[mesActual]} {anioActual}
                  </h3>
                  <button
                    onClick={() => abrirNuevo(diaSeleccionado)}
                    className="text-sm bg-blue-50 hover:bg-blue-100 text-blue-700 px-3 py-1 rounded font-medium transition"
                  >
                    + Agregar evento
                  </button>
                </div>
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
                        <span className={`text-xs px-2 py-0.5 rounded-full ${ev.tipo === "recurrente" ? "bg-purple-100 text-purple-700" : "bg-blue-100 text-blue-700"}`}>
                          {ev.tipo}
                        </span>
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
            {loading ? (
              <p className="text-gray-400 text-sm">Cargando...</p>
            ) : proximosEventos.length === 0 ? (
              <p className="text-gray-400 text-sm">No hay eventos próximos.</p>
            ) : (
              <div className="space-y-3">
                {proximosEventos.map(ev => (
                  <div
                    key={ev._key}
                    onClick={() => setVistaEvento(ev)}
                    className="bg-white rounded-xl shadow-sm p-3 cursor-pointer hover:shadow-md transition border-l-4"
                    style={{ borderLeftColor: ev.color }}
                  >
                    <p className="font-semibold text-gray-800 text-sm">{ev.titulo}</p>
                    <p className="text-xs text-gray-500 mt-0.5">
                      {ev._fecha.toLocaleDateString("es-CL", {
                        weekday: "long", day: "numeric", month: "short"
                      })}
                    </p>
                    {ev.lugar && <p className="text-xs text-gray-400 mt-0.5">📍 {ev.lugar}</p>}
                    {ev.coordinador_nombre && (
                      <p className="text-xs text-gray-400 mt-0.5">
                        🎯 {ev.coordinador_nombre} {ev.coordinador_apellido}
                      </p>
                    )}
                    {ev.predicador_nombre && (
                      <p className="text-xs text-gray-400 mt-0.5">
                        🎤 {ev.predicador_nombre} {ev.predicador_apellido}
                      </p>
                    )}
                    <span className={`mt-1 inline-block text-xs px-2 py-0.5 rounded-full ${ev.tipo === "recurrente" ? "bg-purple-100 text-purple-700" : "bg-blue-100 text-blue-700"}`}>
                      {ev.tipo === "recurrente" ? `🔁 ${ev.recurrencia}` : "📅 especial"}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Modal detalle evento */}
      {vistaEvento && !modalAbierto && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md">
            {vistaEvento.imagen_url && (
              <img src={normUrl(vistaEvento.imagen_url)} alt={vistaEvento.titulo} className="w-full h-40 object-cover rounded-t-2xl" />
            )}
            <div className="p-6">
              <div className="flex items-start gap-3 mb-4">
                <div className="w-4 h-4 rounded-full mt-1 flex-shrink-0" style={{ background: vistaEvento.color }} />
                <div>
                  <h3 className="text-xl font-bold text-gray-800">{vistaEvento.titulo}</h3>
                  <p className="text-sm text-gray-500 mt-0.5">
                    {vistaEvento._fecha.toLocaleDateString("es-CL", {
                      weekday: "long", year: "numeric", month: "long", day: "numeric"
                    })}
                  </p>
                </div>
              </div>
              {vistaEvento.descripcion && (
                <p className="text-gray-600 text-sm mb-3">{vistaEvento.descripcion}</p>
              )}
              {vistaEvento.notas && (
                <div className="bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 mb-3">
                  <p className="text-xs font-semibold text-amber-700 mb-0.5">📝 Notas</p>
                  <p className="text-sm text-amber-900 whitespace-pre-wrap">{vistaEvento.notas}</p>
                </div>
              )}
              {vistaEvento.lugar && <p className="text-sm text-gray-500 mb-1">📍 {vistaEvento.lugar}</p>}
              {vistaEvento.coordinador_nombre && (
                <p className="text-sm text-gray-500 mb-1">
                  🎯 Coordinador/a: {vistaEvento.coordinador_nombre} {vistaEvento.coordinador_apellido}
                </p>
              )}
              {vistaEvento.predicador_nombre && (
                <p className="text-sm text-gray-500 mb-1">
                  🎤 Predicador/a: {vistaEvento.predicador_nombre} {vistaEvento.predicador_apellido}
                </p>
              )}

              {/* Asignación específica para esta ocurrencia (solo recurrentes) */}
              {vistaEvento.tipo === "recurrente" && (
                <div className="border-t pt-4 mt-3">
                  <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">Asignar para esta fecha</p>
                  <div className="grid grid-cols-2 gap-3 mb-3">
                    <div>
                      <label className="block text-xs font-medium text-gray-600 mb-1">Coordinador/a</label>
                      <select
                        value={ocForm.coordinador_id}
                        onChange={e => setOcForm(p => ({ ...p, coordinador_id: e.target.value }))}
                        className="w-full border rounded-lg px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-teal-400"
                      >
                        <option value="">Sin asignar</option>
                        {miembros.map(m => (
                          <option key={m.id} value={m.id}>{m.nombre} {m.apellido}</option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-gray-600 mb-1">Predicador/a</label>
                      <select
                        value={ocForm.predicador_id}
                        onChange={e => setOcForm(p => ({ ...p, predicador_id: e.target.value }))}
                        className="w-full border rounded-lg px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-teal-400"
                      >
                        <option value="">Sin asignar</option>
                        {miembros.map(m => (
                          <option key={m.id} value={m.id}>{m.nombre} {m.apellido}</option>
                        ))}
                      </select>
                    </div>
                  </div>
                  <div className="mb-3">
                    <label className="block text-xs font-medium text-gray-600 mb-1">Notas para esta fecha</label>
                    <textarea
                      rows={3}
                      value={ocForm.notas}
                      onChange={e => setOcForm(p => ({ ...p, notas: e.target.value }))}
                      className="w-full border rounded-lg px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-teal-400 resize-none"
                      placeholder="Anuncios, cambios, instrucciones especiales..."
                    />
                  </div>
                  <button
                    onClick={guardarOcurrencia}
                    disabled={guardandoOc}
                    className="w-full bg-teal-500 hover:bg-teal-600 text-white text-sm font-semibold py-2 rounded-lg transition disabled:opacity-50"
                  >
                    {guardandoOc ? "Guardando..." : "💾 Guardar para esta fecha"}
                  </button>
                </div>
              )}
              <p className="text-sm mt-3">
                <span className={`px-2 py-1 rounded-full text-xs font-semibold ${
                  vistaEvento.tipo === "recurrente" ? "bg-purple-100 text-purple-700" : "bg-blue-100 text-blue-700"
                }`}>
                  {vistaEvento.tipo === "recurrente"
                    ? `🔁 Recurrente · ${vistaEvento.recurrencia}`
                    : "📅 Evento especial"}
                </span>
              </p>
              <div className="flex gap-3 mt-5">
                <button
                  onClick={() => abrirEditar(vistaEvento)}
                  className="flex-1 bg-amber-100 hover:bg-amber-200 text-amber-700 font-semibold py-2 rounded-lg transition text-sm"
                >
                  Editar
                </button>
                <button
                  onClick={() => eliminar(vistaEvento.id)}
                  className="flex-1 bg-red-100 hover:bg-red-200 text-red-600 font-semibold py-2 rounded-lg transition text-sm"
                >
                  Eliminar
                </button>
                <button
                  onClick={() => setVistaEvento(null)}
                  className="flex-1 bg-gray-100 hover:bg-gray-200 text-gray-600 font-semibold py-2 rounded-lg transition text-sm"
                >
                  Cerrar
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Modal crear/editar evento */}
      {modalAbierto && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-start justify-center p-4 overflow-y-auto">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-xl my-8">
            <div className="flex justify-between items-center p-6 border-b">
              <h2 className="text-xl font-bold text-gray-800">
                {editando ? "Editar Evento" : "Nuevo Evento"}
              </h2>
              <button onClick={cerrarModal} className="text-gray-400 hover:text-gray-600 text-2xl leading-none">&times;</button>
            </div>

            <div className="p-6 space-y-4">
              {/* Título */}
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1">Título *</label>
                <input
                  type="text"
                  value={form.titulo}
                  onChange={e => setForm(p => ({ ...p, titulo: e.target.value }))}
                  className="w-full border rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-400"
                />
              </div>

              {/* Fechas */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-1">Fecha/Hora inicio *</label>
                  <input
                    type="datetime-local"
                    value={form.fecha_inicio}
                    onChange={e => setForm(p => ({ ...p, fecha_inicio: e.target.value }))}
                    className="w-full border rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-400"
                  />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-1">Fecha/Hora término</label>
                  <input
                    type="datetime-local"
                    value={form.fecha_fin}
                    onChange={e => setForm(p => ({ ...p, fecha_fin: e.target.value }))}
                    className="w-full border rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-400"
                  />
                </div>
              </div>

              {/* Tipo y recurrencia */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-1">Tipo</label>
                  <select
                    value={form.tipo}
                    onChange={e => setForm(p => ({
                      ...p,
                      tipo: e.target.value,
                      recurrencia: e.target.value === "especial"
                        ? "ninguna"
                        : (p.recurrencia === "ninguna" ? "semanal" : p.recurrencia),
                    }))}
                    className="w-full border rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-400"
                  >
                    <option value="especial">📅 Especial (una sola vez)</option>
                    <option value="recurrente">🔁 Recurrente</option>
                  </select>
                </div>
                {form.tipo === "recurrente" && (
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-1">Frecuencia</label>
                    <select
                      value={form.recurrencia}
                      onChange={e => setForm(p => ({ ...p, recurrencia: e.target.value }))}
                      className="w-full border rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-400"
                    >
                      <option value="semanal">Semanal</option>
                      <option value="quincenal">Quincenal</option>
                      <option value="mensual">Mensual</option>
                      <option value="anual">Anual</option>
                    </select>
                  </div>
                )}
              </div>

              {/* Día de semana para recurrentes semanales/quincenales */}
              {form.tipo === "recurrente" && (form.recurrencia === "semanal" || form.recurrencia === "quincenal") && (
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-1">Día de la semana</label>
                  <select
                    value={form.dia_semana}
                    onChange={e => setForm(p => ({ ...p, dia_semana: e.target.value }))}
                    className="w-full border rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-400"
                  >
                    <option value="">Usar el día de la fecha de inicio</option>
                    {[
                      { label: "Lunes",     jsDay: 1 },
                      { label: "Martes",    jsDay: 2 },
                      { label: "Miércoles", jsDay: 3 },
                      { label: "Jueves",    jsDay: 4 },
                      { label: "Viernes",   jsDay: 5 },
                      { label: "Sábado",    jsDay: 6 },
                      { label: "Domingo",   jsDay: 0 },
                    ].map(({ label, jsDay }) => (
                      <option key={jsDay} value={jsDay}>{label}</option>
                    ))}
                  </select>
                </div>
              )}

              {/* Lugar */}
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1">Lugar</label>
                <input
                  type="text"
                  value={form.lugar}
                  onChange={e => setForm(p => ({ ...p, lugar: e.target.value }))}
                  placeholder="Templo, Salón, etc."
                  className="w-full border rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-400"
                />
              </div>

              {/* Coordinador y Predicador */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-1">Coordinador/a</label>
                  <select
                    value={form.coordinador_id}
                    onChange={e => setForm(p => ({ ...p, coordinador_id: e.target.value }))}
                    className="w-full border rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-400"
                  >
                    <option value="">Sin asignar</option>
                    {miembros.map(m => (
                      <option key={m.id} value={m.id}>{m.nombre} {m.apellido}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-1">Predicador/a</label>
                  <select
                    value={form.predicador_id}
                    onChange={e => setForm(p => ({ ...p, predicador_id: e.target.value }))}
                    className="w-full border rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-400"
                  >
                    <option value="">Sin asignar</option>
                    {miembros.map(m => (
                      <option key={m.id} value={m.id}>{m.nombre} {m.apellido}</option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Descripción */}
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1">Descripción</label>
                <textarea
                  rows={3}
                  value={form.descripcion}
                  onChange={e => setForm(p => ({ ...p, descripcion: e.target.value }))}
                  className="w-full border rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-400 resize-none"
                  placeholder="Detalles del evento..."
                />
              </div>

              {/* Notas */}
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1">Notas</label>
                <textarea
                  rows={3}
                  value={form.notas}
                  onChange={e => setForm(p => ({ ...p, notas: e.target.value }))}
                  className="w-full border rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-amber-400 resize-none"
                  placeholder="Notas internas, instrucciones generales del evento..."
                />
              </div>

              {/* Imagen */}
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1">URL Imagen</label>
                <input
                  type="text"
                  value={form.imagen_url}
                  onChange={e => setForm(p => ({ ...p, imagen_url: e.target.value }))}
                  placeholder="https://... o /carpeta/imagen.jpg"
                  className="w-full border rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-400"
                />
                {form.imagen_url && (
                  <img
                    src={normUrl(form.imagen_url)}
                    alt="preview"
                    className="mt-2 h-24 w-full object-cover rounded-lg border"
                    onError={e => { e.target.style.display = "none"; }}
                    onLoad={e => { e.target.style.display = "block"; }}
                  />
                )}
              </div>

              {/* Color */}
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">Color del evento</label>
                <div className="flex flex-wrap gap-2">
                  {COLORES_EVENTO.map(c => (
                    <button
                      key={c.value}
                      type="button"
                      onClick={() => setForm(p => ({ ...p, color: c.value }))}
                      className={`w-8 h-8 rounded-full border-4 transition ${
                        form.color === c.value ? "border-gray-800 scale-110" : "border-transparent"
                      }`}
                      style={{ backgroundColor: c.value }}
                      title={c.label}
                    />
                  ))}
                </div>
              </div>
            </div>

            <div className="flex justify-end gap-3 px-6 py-4 border-t bg-gray-50 rounded-b-2xl">
              <button onClick={cerrarModal} className="px-5 py-2 text-gray-600 hover:text-gray-800 font-medium transition">
                Cancelar
              </button>
              <button
                onClick={guardar}
                disabled={guardando}
                className="bg-blue-600 hover:bg-blue-700 text-white font-semibold px-6 py-2 rounded-lg transition disabled:opacity-50"
              >
                {guardando ? "Guardando..." : editando ? "Guardar Cambios" : "Crear Evento"}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
