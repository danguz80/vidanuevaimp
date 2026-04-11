import React, { useEffect, useState, useRef } from "react";
import { useNavigate, Link } from "react-router-dom";

const API_URL = import.meta.env.VITE_BACKEND_URL || "https://iglesia-backend.onrender.com";
import { Eye, EyeOff, LogOut, Lock, Phone, Mail, MapPin, Calendar, ShieldCheck, Camera, PenLine, Check, X, Bell, Star, Mic, DoorOpen, CalendarOff, Plus, Trash2, Users, Music, Music2 } from "lucide-react";
import { useMemberAuth } from "../context/MemberAuthContext";
import { useAuth } from "../context/AuthContext";

function calcularEdad(fechaNac) {
  if (!fechaNac) return null;
  const hoy = new Date();
  const nac = new Date(fechaNac);
  let edad = hoy.getFullYear() - nac.getFullYear();
  const m = hoy.getMonth() - nac.getMonth();
  if (m < 0 || (m === 0 && hoy.getDate() < nac.getDate())) edad--;
  return edad;
}

// Parsea un string ISO sin zona (ej. "2026-04-05T10:00:00") como hora local
function parseLocalDate(str) {
  if (!str) return null;
  const s = String(str).replace("T", " ").slice(0, 19);
  const [fecha, hora] = s.split(" ");
  const [y, mo, d] = fecha.split("-").map(Number);
  const [h = 0, mi = 0, se = 0] = (hora || "").split(":").map(Number);
  return new Date(y, mo - 1, d, h, mi, se);
}

const MESES_NOMBRE = ["Enero","Febrero","Marzo","Abril","Mayo","Junio","Julio","Agosto","Septiembre","Octubre","Noviembre","Diciembre"];

// Expande los eventos base del miembro para un mes dado y devuelve compromisos concretos
function obtenerCompromisosDelMes(eventos, ocurrencias, anio, mes) {
  const resultado = [];
  const primerDia = new Date(anio, mes, 1);
  const ultimoDia = new Date(anio, mes + 1, 0);

  // Ocurrencias específicas mapeadas por evento_id+fecha para detectar overrides
  const ocMap = {};
  for (const oc of (ocurrencias || [])) {
    const key = `${oc.evento_id}_${String(oc.fecha).slice(0, 10)}`;
    ocMap[key] = oc;
  }

  for (const ev of (eventos || [])) {
    const inicio = parseLocalDate(ev.fecha_inicio);
    if (!inicio) continue;
    const agregarFecha = (fecha) => {
      const key = `${ev.id}_${fecha.toLocaleDateString("sv")}`;
      // Si existe una ocurrencia específica para ese día, el rol puede cambiar
      const oc = ocMap[key];
      resultado.push({
        id: ev.id,
        titulo: ev.titulo,
        fecha,
        color: ev.color || "#3B82F6",
        lugar: ev.lugar || "",
        rol: oc?.rol || ev.rol_base,
        esOcurrencia: !!oc,
        keyNot: `${ev.id}_${ev.rol_base}_${anio}_${String(mes + 1).padStart(2, "0")}`,
      });
    };

    if (ev.tipo === "recurrente" && ev.recurrencia !== "ninguna") {
      switch (ev.recurrencia) {
        case "semanal": {
          const ds = ev.dia_semana ?? inicio.getDay();
          let d = new Date(anio, mes, 1);
          while (d.getDay() !== ds) d.setDate(d.getDate() + 1);
          while (d <= ultimoDia) { agregarFecha(new Date(d)); d.setDate(d.getDate() + 7); }
          break;
        }
        case "quincenal": {
          const ds = ev.dia_semana ?? inicio.getDay();
          let d = new Date(anio, mes, 1);
          while (d.getDay() !== ds) d.setDate(d.getDate() + 1);
          let cnt = 0;
          while (d <= ultimoDia) { if (cnt % 2 === 0) agregarFecha(new Date(d)); d.setDate(d.getDate() + 7); cnt++; }
          break;
        }
        case "mensual": {
          const fecha = new Date(anio, mes, inicio.getDate());
          if (fecha >= primerDia && fecha <= ultimoDia) agregarFecha(fecha);
          break;
        }
        case "anual": {
          if (inicio.getMonth() === mes) agregarFecha(new Date(anio, mes, inicio.getDate()));
          break;
        }
        default: break;
      }
    } else {
      if (inicio.getFullYear() === anio && inicio.getMonth() === mes) agregarFecha(inicio);
    }
  }

  // También agregar ocurrencias específicas de eventos donde el miembro NO es el base
  for (const oc of (ocurrencias || [])) {
    const fecha = parseLocalDate(oc.fecha);
    if (!fecha || fecha.getFullYear() !== anio || fecha.getMonth() !== mes) continue;
    // Si ya fue procesada como override de un evento base, no duplicar
    const estaEnEventosBase = (eventos || []).some(e => e.id === oc.evento_id);
    if (!estaEnEventosBase) {
      resultado.push({
        id: oc.evento_id,
        titulo: oc.titulo,
        fecha,
        color: oc.color || "#3B82F6",
        lugar: oc.lugar || "",
        rol: oc.rol,
        esOcurrencia: true,
        keyNot: `oc_${oc.evento_id}_${String(oc.fecha).slice(0, 10)}`,
      });
    }
  }

  resultado.sort((a, b) => a.fecha - b.fecha);
  return resultado;
}

const ROL_CONFIG = {
  Encargado:    { icon: Star,     bg: "bg-amber-50",  border: "border-amber-200",  text: "text-amber-700",  dot: "bg-amber-400"  },
  Coordinador:  { icon: Star,     bg: "bg-blue-50",   border: "border-blue-200",   text: "text-blue-700",   dot: "bg-blue-400"   },
  Predicador:   { icon: Mic,      bg: "bg-purple-50", border: "border-purple-200", text: "text-purple-700", dot: "bg-purple-400" },
  Portero:      { icon: DoorOpen, bg: "bg-green-50",  border: "border-green-200",  text: "text-green-700",  dot: "bg-green-400"  },
};

// Modal de notificación de servicios asignados
function ModalServicio({ compromisos, porteroMeses, onClose }) {
  return (
    <div className="fixed inset-0 bg-black/60 flex items-end sm:items-center justify-center z-50">
      <div className="bg-white rounded-t-2xl sm:rounded-2xl shadow-2xl w-full sm:max-w-sm max-h-[90vh] flex flex-col overflow-hidden">
        <div className="bg-indigo-600 px-5 py-4 flex items-center gap-3 shrink-0">
          <div className="w-9 h-9 rounded-full bg-white/20 flex items-center justify-center shrink-0">
            <Bell size={18} className="text-white" />
          </div>
          <div>
            <p className="text-white font-bold text-base leading-tight">Tienes servicios asignados</p>
            <p className="text-indigo-200 text-xs mt-0.5">La iglesia cuenta contigo</p>
          </div>
        </div>
        <div className="px-5 py-4 space-y-2.5 overflow-y-auto flex-1">
          {porteroMeses.map(({ anio, mes }) => {
            const cfg = ROL_CONFIG["Portero"];
            return (
              <div key={`p_${anio}_${mes}`} className={`flex items-center gap-3 rounded-xl border ${cfg.bg} ${cfg.border} px-3 py-2.5`}>
                <span className={`w-2 h-2 rounded-full shrink-0 ${cfg.dot}`} />
                <div className="min-w-0">
                  <p className={`text-xs font-bold ${cfg.text}`}>Portero del Mes</p>
                  <p className="text-sm font-semibold text-gray-800 truncate">
                    {MESES_NOMBRE[mes - 1]} {anio}
                  </p>
                </div>
              </div>
            );
          })}
          {compromisos.map((c, i) => {
            const cfg = ROL_CONFIG[c.rol] || ROL_CONFIG["Encargado"];
            return (
              <div key={i} className={`flex items-center gap-3 rounded-xl border ${cfg.bg} ${cfg.border} px-3 py-2.5`}>
                <span className={`w-2 h-2 rounded-full shrink-0 ${cfg.dot}`} />
                <div className="min-w-0">
                  <p className={`text-xs font-bold ${cfg.text}`}>{c.rol}</p>
                  <p className="text-sm font-semibold text-gray-800 truncate">{c.titulo}</p>
                  <p className="text-xs text-gray-500 capitalize">
                    {c.fecha.toLocaleDateString("es-CL", { weekday: "long", day: "numeric", month: "long" })}
                  </p>
                </div>
              </div>
            );
          })}
        </div>
        <div className="px-5 pb-6 pt-3 shrink-0">
          <button
            onClick={onClose}
            className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-semibold rounded-xl py-3 text-sm transition"
          >
            Entendido
          </button>
        </div>
      </div>
    </div>
  );
}

function CambiarPasswordModal({ onClose, getToken }) {
  const [actual, setActual] = useState("");
  const [nueva, setNueva] = useState("");
  const [confirmar, setConfirmar] = useState("");
  const [showActual, setShowActual] = useState(false);
  const [showNueva, setShowNueva] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    if (nueva !== confirmar) { setError("Las contraseñas no coinciden"); return; }
    if (nueva.length < 6) { setError("Mínimo 6 caracteres"); return; }
    setLoading(true);
    try {
      const res = await fetch(`${API_URL}/api/miembros/me/password`, {
        method: "PUT",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${getToken()}` },
        body: JSON.stringify({ passwordActual: actual, passwordNuevo: nueva }),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error); return; }
      setSuccess(true);
      setTimeout(onClose, 1500);
    } catch { setError("Error de conexión"); }
    finally { setLoading(false); }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-end sm:items-center justify-center z-50">
      <div className="bg-white rounded-t-2xl sm:rounded-2xl shadow-xl w-full sm:max-w-sm max-h-[90vh] flex flex-col overflow-hidden">
        <div className="flex items-center justify-between px-6 py-4 border-b shrink-0">
          <h2 className="text-lg font-bold text-gray-800 flex items-center gap-2">
            <Lock size={18} /> Cambiar contraseña
          </h2>
          <button type="button" onClick={onClose} className="text-gray-400 hover:text-gray-600 text-2xl leading-none">&times;</button>
        </div>
        <div className="overflow-y-auto flex-1 px-6 py-4">
          {success ? (
            <p className="text-green-600 text-center py-4">✅ Contraseña actualizada</p>
          ) : (
            <form id="pwd-form" onSubmit={handleSubmit} className="space-y-4">
              {error && <p className="text-red-600 text-sm bg-red-50 border border-red-200 rounded px-3 py-2">{error}</p>}
              <div>
                <label className="text-sm font-medium text-gray-700 block mb-1">Contraseña actual</label>
                <div className="relative">
                  <input type={showActual ? "text" : "password"} value={actual} onChange={e => setActual(e.target.value)}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 pr-9 text-sm focus:ring-2 focus:ring-indigo-500 focus:outline-none" required />
                  <button type="button" onClick={() => setShowActual(!showActual)} className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400" tabIndex={-1}>
                    {showActual ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
              </div>
              <div>
                <label className="text-sm font-medium text-gray-700 block mb-1">Nueva contraseña</label>
                <div className="relative">
                  <input type={showNueva ? "text" : "password"} value={nueva} onChange={e => setNueva(e.target.value)}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 pr-9 text-sm focus:ring-2 focus:ring-indigo-500 focus:outline-none" required />
                  <button type="button" onClick={() => setShowNueva(!showNueva)} className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400" tabIndex={-1}>
                    {showNueva ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
              </div>
              <div>
                <label className="text-sm font-medium text-gray-700 block mb-1">Confirmar contraseña</label>
                <input type="password" value={confirmar} onChange={e => setConfirmar(e.target.value)}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500 focus:outline-none" required />
              </div>
            </form>
          )}
        </div>
        {!success && (
          <div className="flex gap-2 px-6 py-4 border-t bg-gray-50 shrink-0">
            <button type="button" onClick={onClose} className="flex-1 border border-gray-300 text-gray-700 rounded-lg py-2.5 text-sm hover:bg-gray-100">Cancelar</button>
            <button type="submit" form="pwd-form" disabled={loading} className="flex-1 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white rounded-lg py-2.5 text-sm font-medium">
              {loading ? "Guardando..." : "Guardar"}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

function contarPalabras(texto) {
  return (texto || "").trim().split(/\s+/).filter(Boolean).length;
}

export default function MiPortal() {
  const { miembro, logout, getToken } = useMemberAuth();
  const { user: adminUser, logout: adminLogout } = useAuth();
  const [perfil, setPerfil] = useState(null);
  const [loading, setLoading] = useState(true);
  const [showCambiarPwd, setShowCambiarPwd] = useState(false);
  const navigate = useNavigate();

  // Compromisos
  const [compromisos, setCompromisos] = useState({ proximos: [], portero: [] });
  const [cargandoCompromisos, setCargandoCompromisos] = useState(true);
  const [modalServicio, setModalServicio] = useState(false);

  // Foto
  const fileInputRef = useRef(null);
  const [subiendoFoto, setSubiendoFoto] = useState(false);
  const [errorFoto, setErrorFoto] = useState("");

  // Acerca de mí
  const [editandoAcerca, setEditandoAcerca] = useState(false);
  const [textoAcerca, setTextoAcerca] = useState("");
  const [guardandoAcerca, setGuardandoAcerca] = useState(false);
  const [errorAcerca, setErrorAcerca] = useState("");

  // Disponibilidad / Mi Horario
  const [bloqueos, setBloqueos] = useState([]);
  const [cargandoBloqueos, setCargandoBloqueos] = useState(true);
  const [nuevoBloqueo, setNuevoBloqueo] = useState({ fecha_inicio: "", fecha_fin: "", motivo: "" });
  const [guardandoBloqueo, setGuardandoBloqueo] = useState(false);
  const [errorBloqueo, setErrorBloqueo] = useState("");
  const [mostrarFormBloqueo, setMostrarFormBloqueo] = useState(false);

  useEffect(() => {
    if (!miembro) { navigate("/portal/login"); return; }
    fetch(`${API_URL}/api/miembros/me`, { headers: { Authorization: `Bearer ${getToken()}` } })
      .then(r => r.json())
      .then(d => { setPerfil(d); setTextoAcerca(d.acerca_de_mi || ""); setLoading(false); })
      .catch(() => setLoading(false));

    // Cargar compromisos
    fetch(`${API_URL}/api/miembros/me/compromisos`, { headers: { Authorization: `Bearer ${getToken()}` } })
      .then(r => {
        if (!r.ok) { console.error("Compromisos HTTP error:", r.status); return null; }
        return r.json();
      })
      .then(data => {
        if (!data) { setCargandoCompromisos(false); return; }
        setCompromisos(data);
        setCargandoCompromisos(false);
        // ── Lógica de notificación: mostrar modal si hay compromisos nuevos no vistos ──
        const notKeys = new Set();
        for (const c of (data.proximos || [])) {
          notKeys.add(`oc_${c.evento_id}_${c.fecha}_${c.rol}`);
        }
        for (const { anio, mes } of (data.portero || [])) {
          notKeys.add(`portero_${anio}_${mes}`);
        }
        if (notKeys.size === 0) return;
        const storageKey = `compromisos_vistos_${miembro.id}`;
        const vistos = new Set(JSON.parse(localStorage.getItem(storageKey) || "[]"));
        const hayNuevos = [...notKeys].some(k => !vistos.has(k));
        if (hayNuevos) setModalServicio(true);
      })
      .catch(err => { console.error("Error fetch compromisos:", err); setCargandoCompromisos(false); });

    // Cargar bloqueos de disponibilidad
    fetch(`${API_URL}/api/miembros/me/disponibilidad`, { headers: { Authorization: `Bearer ${getToken()}` } })
      .then(r => r.json())
      .then(d => { setBloqueos(Array.isArray(d) ? d : []); setCargandoBloqueos(false); })
      .catch(() => setCargandoBloqueos(false));
  }, [miembro]);

  const cambiarFoto = (file) => {
    if (!file) return;
    setErrorFoto("");
    if (file.size > 1 * 1024 * 1024) {
      setErrorFoto("La imagen supera 1 MB. Elige una más pequeña.");
      return;
    }
    const reader = new FileReader();
    reader.onload = async (e) => {
      setSubiendoFoto(true);
      try {
        const res = await fetch(`${API_URL}/api/miembros/me/foto-perfil`, {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${getToken()}` },
          body: JSON.stringify({ imagen_base64: e.target.result }),
        });
        const data = await res.json();
        if (!res.ok) { setErrorFoto(data.error || "Error al subir foto"); return; }
        setPerfil(prev => ({ ...prev, foto_url: data.foto_url }));
      } catch { setErrorFoto("Error de conexión"); }
      finally { setSubiendoFoto(false); }
    };
    reader.readAsDataURL(file);
  };

  const guardarBloqueo = async () => {
    setErrorBloqueo("");
    if (!nuevoBloqueo.fecha_inicio) { setErrorBloqueo("La fecha de inicio es requerida"); return; }
    if (nuevoBloqueo.fecha_fin && nuevoBloqueo.fecha_fin < nuevoBloqueo.fecha_inicio) {
      setErrorBloqueo("La fecha fin no puede ser anterior al inicio");
      return;
    }
    setGuardandoBloqueo(true);
    try {
      const res = await fetch(`${API_URL}/api/miembros/me/disponibilidad`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${getToken()}` },
        body: JSON.stringify(nuevoBloqueo),
      });
      const data = await res.json();
      if (!res.ok) { setErrorBloqueo(data.error || "Error al guardar"); return; }
      setBloqueos(prev => [...prev, data].sort((a, b) => a.fecha_inicio.localeCompare(b.fecha_inicio)));
      setNuevoBloqueo({ fecha_inicio: "", fecha_fin: "", motivo: "" });
      setMostrarFormBloqueo(false);
    } catch { setErrorBloqueo("Error de conexión"); }
    finally { setGuardandoBloqueo(false); }
  };

  const eliminarBloqueo = async (id) => {
    try {
      await fetch(`${API_URL}/api/miembros/me/disponibilidad/${id}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${getToken()}` },
      });
      setBloqueos(prev => prev.filter(b => b.id !== id));
    } catch { /* silencioso */ }
  };

  const guardarAcerca = async () => {    setErrorAcerca("");
    if (contarPalabras(textoAcerca) > 100) {
      setErrorAcerca("Máximo 100 palabras");
      return;
    }
    setGuardandoAcerca(true);
    try {
      const res = await fetch(`${API_URL}/api/miembros/me/acerca-de-mi`, {
        method: "PUT",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${getToken()}` },
        body: JSON.stringify({ acerca_de_mi: textoAcerca }),
      });
      const data = await res.json();
      if (!res.ok) { setErrorAcerca(data.error || "Error al guardar"); return; }
      setPerfil(prev => ({ ...prev, acerca_de_mi: textoAcerca || null }));
      setEditandoAcerca(false);
    } catch { setErrorAcerca("Error de conexión"); }
    finally { setGuardandoAcerca(false); }
  };

  const cerrarModalServicio = () => {
    setModalServicio(false);
    const notKeys = new Set();
    for (const c of (compromisos.proximos || [])) {
      notKeys.add(`oc_${c.evento_id}_${c.fecha}_${c.rol}`);
    }
    for (const { anio, mes } of (compromisos.portero || [])) {
      notKeys.add(`portero_${anio}_${mes}`);
    }
    const storageKey = `compromisos_vistos_${miembro.id}`;
    localStorage.setItem(storageKey, JSON.stringify([...notKeys]));
  };

  const handleLogout = () => { logout(); adminLogout(); navigate("/portal/login"); };

  if (!miembro) return null;
  if (loading) return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center">
      <p className="text-gray-500">Cargando...</p>
    </div>
  );

  const edad = calcularEdad(perfil?.fecha_nacimiento);
  const foto = perfil?.foto_url || null;
  const iniciales = `${perfil?.nombre?.[0] || ""}${perfil?.apellido?.[0] || ""}`.toUpperCase();

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-indigo-700 text-white">
        <div className="max-w-2xl mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            {foto ? (
              <img src={foto} alt="" className="w-10 h-10 rounded-full object-cover border-2 border-white/40" />
            ) : (
              <div className="w-10 h-10 rounded-full bg-indigo-500 flex items-center justify-center text-sm font-bold border-2 border-white/40">
                {iniciales}
              </div>
            )}
            <div>
              <p className="font-semibold text-sm leading-tight">{perfil?.nombre} {perfil?.apellido}</p>
              <p className="text-indigo-200 text-xs">{perfil?.email}</p>
            </div>
          </div>
          <button onClick={handleLogout} className="flex items-center gap-1.5 text-indigo-200 hover:text-white text-sm transition">
            <LogOut size={16} /> Salir
          </button>
        </div>
      </div>

      <div className="max-w-2xl mx-auto px-4 py-6 space-y-4">
        {/* Foto + nombre */}
        <div className="bg-white rounded-2xl shadow-sm p-6 flex flex-col items-center text-center gap-3">
          {/* Avatar con hover para cambiar foto */}
          <div className="relative group">
            {foto ? (
              <img src={foto} alt="" className="w-24 h-24 rounded-full object-cover ring-4 ring-indigo-100" />
            ) : (
              <div className="w-24 h-24 rounded-full bg-indigo-100 flex items-center justify-center text-3xl font-bold text-indigo-500 ring-4 ring-indigo-50">
                {iniciales}
              </div>
            )}
            <button
              onClick={() => fileInputRef.current?.click()}
              disabled={subiendoFoto}
              className="absolute inset-0 rounded-full bg-black/40 opacity-0 group-hover:opacity-100 transition flex flex-col items-center justify-center text-white text-xs font-semibold gap-0.5"
            >
              {subiendoFoto ? (
                <span className="text-xs">Subiendo...</span>
              ) : (
                <><Camera size={18} /><span>Cambiar</span></>
              )}
            </button>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/jpeg,image/png,image/webp"
              className="hidden"
              onChange={(e) => cambiarFoto(e.target.files[0])}
            />
          </div>
          {errorFoto && (
            <p className="text-xs text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-1.5">{errorFoto}</p>
          )}
          {!errorFoto && (
            <p className="text-xs text-gray-400">Toca la foto para cambiarla · máx. 1 MB</p>
          )}
          <div>
            <h1 className="text-xl font-bold text-gray-800">{perfil?.nombre} {perfil?.apellido}</h1>
            {perfil?.roles?.length > 0 && (
              <div className="flex flex-wrap justify-center gap-1.5 mt-2">
                {perfil.roles.map(r => (
                  <span key={r} className="bg-indigo-50 text-indigo-700 text-xs font-medium px-2.5 py-0.5 rounded-full border border-indigo-100">{r}</span>
                ))}
              </div>
            )}
            <span className={`inline-block mt-2 text-xs px-3 py-1 rounded-full font-medium ${
              perfil?.estado === "activo" ? "bg-green-100 text-green-700" :
              perfil?.estado === "inactivo" ? "bg-gray-100 text-gray-600" :
              "bg-yellow-100 text-yellow-700"
            }`}>
              {perfil?.estado || "activo"}
            </span>
          </div>
        </div>

        {/* Acerca de mí */}
        <div className="bg-white rounded-2xl shadow-sm p-5">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wider">Acerca de mí</h2>            {!editandoAcerca && (
              <button
                onClick={() => { setTextoAcerca(perfil?.acerca_de_mi || ""); setEditandoAcerca(true); setErrorAcerca(""); }}
                className="flex items-center gap-1 text-xs text-indigo-600 hover:text-indigo-800 font-medium transition"
              >
                <PenLine size={13} /> Editar
              </button>
            )}
          </div>
          {editandoAcerca ? (
            <div className="space-y-2">
              <textarea
                rows={4}
                value={textoAcerca}
                onChange={e => setTextoAcerca(e.target.value)}
                placeholder="Cuéntale a la congregación sobre ti. Por ejemplo: de dónde eres, cuántos años llevas en la iglesia, en qué trabajas, y una palabra de aliento para todos."
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm resize-none focus:ring-2 focus:ring-indigo-400 focus:outline-none"
              />
              <div className="flex items-center justify-between">
                <span className={`text-xs ${
                  contarPalabras(textoAcerca) > 100 ? "text-red-500 font-semibold" : "text-gray-400"
                }`}>
                  {contarPalabras(textoAcerca)} / 100 palabras
                </span>
                <div className="flex gap-2">
                  <button
                    onClick={() => { setEditandoAcerca(false); setTextoAcerca(perfil?.acerca_de_mi || ""); setErrorAcerca(""); }}
                    className="flex items-center gap-1 text-xs text-gray-500 hover:text-gray-700 border border-gray-300 rounded-lg px-3 py-1.5 transition"
                  >
                    <X size={12} /> Cancelar
                  </button>
                  <button
                    onClick={guardarAcerca}
                    disabled={guardandoAcerca || contarPalabras(textoAcerca) > 100}
                    className="flex items-center gap-1 text-xs bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white rounded-lg px-3 py-1.5 font-medium transition"
                  >
                    <Check size={12} /> {guardandoAcerca ? "Guardando..." : "Guardar"}
                  </button>
                </div>
              </div>
              {errorAcerca && <p className="text-xs text-red-500">{errorAcerca}</p>}
            </div>
          ) : perfil?.acerca_de_mi ? (
            <p className="text-sm text-gray-700 whitespace-pre-line leading-relaxed">{perfil.acerca_de_mi}</p>
          ) : (
            <p className="text-sm text-gray-400 italic">Aún no has escrito nada. ¡Preséntate a la congregación!</p>
          )}
        </div>

        {/* ── Mis servicios ────────────────────────────────────────── */}
        {(() => {
          const hoy = new Date();
          hoy.setHours(0, 0, 0, 0);
          const porteroProximos = (compromisos.portero || []).filter(({ anio, mes }) => {
            const fp = new Date(anio, mes - 1, 1);
            return fp >= new Date(hoy.getFullYear(), hoy.getMonth(), 1);
          });
          const eventosLista = (compromisos.proximos || []).map(c => ({
            ...c,
            fecha: new Date(c.fecha + 'T00:00:00'),
          }));
          const total = porteroProximos.length + eventosLista.length;
          return (
            <div className="bg-white rounded-2xl shadow-sm p-5">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wider flex items-center gap-2">
                  <Bell size={14} className="text-indigo-400" /> Mis servicios
                </h2>
                {total > 0 && (
                  <span className="bg-indigo-100 text-indigo-700 text-xs font-bold px-2 py-0.5 rounded-full">{total}</span>
                )}
              </div>
              {cargandoCompromisos ? (
                <p className="text-sm text-gray-400">Cargando servicios...</p>
              ) : total === 0 ? (
                <p className="text-sm text-gray-400 italic">No tienes servicios asignados próximamente.</p>
              ) : (
                <div className="space-y-2">
                  {porteroProximos.map(({ anio, mes }) => {
                    const cfg = ROL_CONFIG["Portero"];
                    const IconoRol = cfg.icon;
                    return (
                      <div key={`p_${anio}_${mes}`} className={`flex items-center gap-3 rounded-xl border ${cfg.bg} ${cfg.border} px-3 py-2.5`}>
                        <IconoRol size={16} className={cfg.text} />
                        <div className="min-w-0 flex-1">
                          <p className={`text-xs font-bold ${cfg.text}`}>Portero del Mes</p>
                          <p className="text-sm font-semibold text-gray-800">{MESES_NOMBRE[mes - 1]} {anio}</p>
                        </div>
                      </div>
                    );
                  })}
                  {eventosLista.map((c, i) => {
                    const cfg = ROL_CONFIG[c.rol] || ROL_CONFIG["Encargado"];
                    const IconoRol = cfg.icon;
                    return (
                      <div key={i} className={`flex items-center gap-3 rounded-xl border ${cfg.bg} ${cfg.border} px-3 py-2.5`}>
                        <IconoRol size={16} className={cfg.text} />
                        <div className="min-w-0 flex-1">
                          <p className={`text-xs font-bold ${cfg.text}`}>{c.rol}</p>
                          <p className="text-sm font-semibold text-gray-800 truncate">{c.titulo}</p>
                          <p className="text-xs text-gray-500 capitalize">
                            {c.fecha.toLocaleDateString("es-CL", { weekday: "long", day: "numeric", month: "long" })}
                            {c.lugar ? ` · ${c.lugar}` : ""}
                          </p>
                        </div>
                        <span
                          className="w-3 h-3 rounded-full shrink-0"
                          style={{ backgroundColor: c.color }}
                        />
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })()}

        {/* Datos personales */}
        <div className="bg-white rounded-2xl shadow-sm p-5">
          <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-4">Mis datos</h2>
          <div className="space-y-3">
            {perfil?.fecha_nacimiento && (
              <div className="flex items-center gap-3 text-sm text-gray-700">
                <Calendar size={16} className="text-indigo-400 shrink-0" />
                <span>
                  {new Date(perfil.fecha_nacimiento).toLocaleDateString("es-CL", { day: "numeric", month: "long", year: "numeric" })}
                  {edad !== null && <span className="text-gray-400 ml-1">({edad} años)</span>}
                </span>
              </div>
            )}
            {perfil?.celular && (
              <div className="flex items-center gap-3 text-sm text-gray-700">
                <Phone size={16} className="text-indigo-400 shrink-0" />
                <span>{perfil.celular}</span>
              </div>
            )}
            {perfil?.email && (
              <div className="flex items-center gap-3 text-sm text-gray-700">
                <Mail size={16} className="text-indigo-400 shrink-0" />
                <span>{perfil.email}</span>
              </div>
            )}
            {perfil?.direccion && (
              <div className="flex items-center gap-3 text-sm text-gray-700">
                <MapPin size={16} className="text-indigo-400 shrink-0" />
                <span>{perfil.direccion}</span>
              </div>
            )}
          </div>
        </div>

        {/* ── Mi Horario ─────────────────────────────────────────── */}
        <div className="bg-white rounded-2xl shadow-sm p-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wider flex items-center gap-2">
              <CalendarOff size={14} className="text-rose-400" /> Mi Horario
            </h2>
            <button
              onClick={() => { setMostrarFormBloqueo(v => !v); setErrorBloqueo(""); }}
              className="flex items-center gap-1 text-xs text-rose-600 hover:text-rose-800 font-medium transition"
            >
              <Plus size={13} /> Bloquear fechas
            </button>
          </div>

          {mostrarFormBloqueo && (
            <div className="mb-4 bg-rose-50 border border-rose-200 rounded-xl p-4 space-y-3">
              <p className="text-xs text-rose-700 font-medium">Indica el período en que no estarás disponible</p>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Desde *</label>
                  <input
                    type="date"
                    value={nuevoBloqueo.fecha_inicio}
                    onChange={e => setNuevoBloqueo(p => ({ ...p, fecha_inicio: e.target.value }))}
                    className="w-full border rounded-lg px-2 py-1.5 text-sm focus:ring-2 focus:ring-rose-400 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Hasta <span className="text-gray-400">(opcional)</span></label>
                  <input
                    type="date"
                    value={nuevoBloqueo.fecha_fin}
                    min={nuevoBloqueo.fecha_inicio}
                    onChange={e => setNuevoBloqueo(p => ({ ...p, fecha_fin: e.target.value }))}
                    className="w-full border rounded-lg px-2 py-1.5 text-sm focus:ring-2 focus:ring-rose-400 focus:outline-none"
                  />
                </div>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Motivo <span className="text-gray-400">(opcional)</span></label>
                <input
                  type="text"
                  value={nuevoBloqueo.motivo}
                  onChange={e => setNuevoBloqueo(p => ({ ...p, motivo: e.target.value }))}
                  placeholder="Viaje, vacaciones, compromiso familiar..."
                  className="w-full border rounded-lg px-2 py-1.5 text-sm focus:ring-2 focus:ring-rose-400 focus:outline-none"
                />
              </div>
              {errorBloqueo && (
                <p className="text-xs text-red-600 bg-red-50 border border-red-200 rounded px-2 py-1">{errorBloqueo}</p>
              )}
              <div className="flex gap-2">
                <button
                  onClick={() => { setMostrarFormBloqueo(false); setErrorBloqueo(""); setNuevoBloqueo({ fecha_inicio: "", fecha_fin: "", motivo: "" }); }}
                  className="flex-1 border border-gray-300 text-gray-600 text-xs rounded-lg py-2 hover:bg-gray-50 transition"
                >
                  Cancelar
                </button>
                <button
                  onClick={guardarBloqueo}
                  disabled={guardandoBloqueo}
                  className="flex-1 bg-rose-600 hover:bg-rose-700 text-white text-xs font-semibold rounded-lg py-2 transition disabled:opacity-50"
                >
                  {guardandoBloqueo ? "Guardando..." : "Guardar"}
                </button>
              </div>
            </div>
          )}

          {cargandoBloqueos ? (
            <p className="text-sm text-gray-400">Cargando...</p>
          ) : bloqueos.length === 0 ? (
            <p className="text-sm text-gray-400 italic">No tienes fechas bloqueadas. Estás disponible para todos los servicios.</p>
          ) : (
            <div className="space-y-2">
              {bloqueos.map(b => {
                const inicio = new Date(b.fecha_inicio.slice(0, 10) + "T12:00:00");
                const fin    = new Date(b.fecha_fin.slice(0, 10)   + "T12:00:00");
                const esMismoDia = b.fecha_inicio === b.fecha_fin;
                const fmt = (d) => d.toLocaleDateString("es-CL", { day: "numeric", month: "short", year: "numeric" });
                return (
                  <div key={b.id} className="flex items-start gap-3 bg-rose-50 border border-rose-200 rounded-xl px-3 py-2.5">
                    <CalendarOff size={15} className="text-rose-400 mt-0.5 shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-rose-800">
                        {esMismoDia ? fmt(inicio) : `${fmt(inicio)} — ${fmt(fin)}`}
                      </p>
                      {b.motivo && <p className="text-xs text-rose-600 truncate">{b.motivo}</p>}
                    </div>
                    <button
                      onClick={() => eliminarBloqueo(b.id)}
                      className="text-rose-300 hover:text-rose-600 transition shrink-0"
                      title="Eliminar"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Acciones */}
        <div className="bg-white rounded-2xl shadow-sm p-5">
          <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-3">Configuración</h2>
          <div className="space-y-3">
            <button
              onClick={() => navigate("/portal/directorio")}
              className="flex items-center gap-2 text-sm text-indigo-700 hover:text-indigo-900 font-medium transition"
            >
              <Users size={16} /> Directorio de miembros
            </button>
            <button
              onClick={() => navigate("/portal/musica")}
              className="flex items-center gap-2 text-sm text-indigo-700 hover:text-indigo-900 font-medium transition"
            >
              <Music size={16} /> Biblioteca de música
            </button>
            <button
              onClick={() => navigate("/portal/canciones")}
              className="flex items-center gap-2 text-sm text-violet-700 hover:text-violet-900 font-medium transition"
            >
              <Music2 size={16} /> Canciones (cifrado)
            </button>
            <button
              onClick={() => setShowCambiarPwd(true)}
              className="flex items-center gap-2 text-sm text-indigo-700 hover:text-indigo-900 font-medium transition"
            >
              <Lock size={16} /> Cambiar contraseña
            </button>
            {adminUser && (
              <Link
                to="/admin"
                className="flex items-center gap-2 text-sm text-purple-700 hover:text-purple-900 font-medium transition"
              >
                <ShieldCheck size={16} /> Panel de Administración
              </Link>
            )}
          </div>
        </div>

        <p className="text-center text-xs text-gray-400">
          <Link to="/" className="hover:underline">← Volver al sitio</Link>
        </p>
      </div>

      {showCambiarPwd && (
        <CambiarPasswordModal onClose={() => setShowCambiarPwd(false)} getToken={getToken} />
      )}

      {modalServicio && (() => {
        const hoy = new Date();
        hoy.setHours(0, 0, 0, 0);
        const porteroProximos = (compromisos.portero || []).filter(({ anio, mes }) =>
          new Date(anio, mes - 1, 1) >= new Date(hoy.getFullYear(), hoy.getMonth(), 1)
        );
        const eventosLista = (compromisos.proximos || []).map(c => ({
          ...c,
          fecha: new Date(c.fecha + 'T00:00:00'),
        }));
        return (
          <ModalServicio
            compromisos={eventosLista}
            porteroMeses={porteroProximos}
            onClose={cerrarModalServicio}
          />
        );
      })()}
    </div>
  );
}
