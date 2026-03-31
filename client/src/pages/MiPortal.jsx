import React, { useEffect, useState, useRef } from "react";
import { useNavigate, Link } from "react-router-dom";
import { Eye, EyeOff, LogOut, Lock, Phone, Mail, MapPin, Calendar, ShieldCheck, Camera, PenLine, Check, X } from "lucide-react";
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
      const res = await fetch("/api/miembros/me/password", {
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
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 px-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm p-6">
        <h2 className="text-lg font-bold text-gray-800 mb-4 flex items-center gap-2">
          <Lock size={18} /> Cambiar contraseña
        </h2>
        {success ? (
          <p className="text-green-600 text-center py-4">✅ Contraseña actualizada</p>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
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
            <div className="flex gap-2 pt-1">
              <button type="button" onClick={onClose} className="flex-1 border border-gray-300 text-gray-700 rounded-lg py-2 text-sm hover:bg-gray-50">Cancelar</button>
              <button type="submit" disabled={loading} className="flex-1 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white rounded-lg py-2 text-sm font-medium">
                {loading ? "Guardando..." : "Guardar"}
              </button>
            </div>
          </form>
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

  // Foto
  const fileInputRef = useRef(null);
  const [subiendoFoto, setSubiendoFoto] = useState(false);
  const [errorFoto, setErrorFoto] = useState("");

  // Acerca de mí
  const [editandoAcerca, setEditandoAcerca] = useState(false);
  const [textoAcerca, setTextoAcerca] = useState("");
  const [guardandoAcerca, setGuardandoAcerca] = useState(false);
  const [errorAcerca, setErrorAcerca] = useState("");

  useEffect(() => {
    if (!miembro) { navigate("/portal/login"); return; }
    fetch("/api/miembros/me", { headers: { Authorization: `Bearer ${getToken()}` } })
      .then(r => r.json())
      .then(d => { setPerfil(d); setTextoAcerca(d.acerca_de_mi || ""); setLoading(false); })
      .catch(() => setLoading(false));
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
        const res = await fetch("/api/miembros/me/foto-perfil", {
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

  const guardarAcerca = async () => {
    setErrorAcerca("");
    if (contarPalabras(textoAcerca) > 100) {
      setErrorAcerca("Máximo 100 palabras");
      return;
    }
    setGuardandoAcerca(true);
    try {
      const res = await fetch("/api/miembros/me/acerca-de-mi", {
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
            <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wider">Acerca de mí</h2>
            {!editandoAcerca && (
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

        {/* Acciones */}
        <div className="bg-white rounded-2xl shadow-sm p-5">
          <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-3">Configuración</h2>
          <div className="space-y-3">
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
    </div>
  );
}
