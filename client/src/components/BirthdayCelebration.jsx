import React, { useEffect, useState, useCallback } from "react";
import { useAuth } from "../context/AuthContext";
import { useMemberAuth } from "../context/MemberAuthContext";

const API = import.meta.env.VITE_BACKEND_URL || "https://iglesia-backend.onrender.com";

// Clave local para marcar un cumpleaños como "ya visto" en este año
const seenKey = (id) => {
  const year = new Date().getUTCFullYear();
  return `cumple_visto_${id}_${year}`;
};

export default function BirthdayCelebration() {
  const { user, getToken } = useAuth();
  const { miembro, getToken: getMiembroToken } = useMemberAuth();

  const [cola, setCola] = useState([]); // festejados pendientes de mostrar
  const [actual, setActual] = useState(null); // el que se muestra ahora
  const [showSaludoInput, setShowSaludoInput] = useState(false);
  const [saludoTexto, setSaludoTexto] = useState("");
  const [enviandoSaludo, setEnviandoSaludo] = useState(false);
  const [saludoEnviado, setSaludoEnviado] = useState(false);

  // Función que devuelve el token disponible (admin tiene prioridad)
  const tokenActivo = useCallback(() => {
    if (user) return getToken();
    if (miembro) return getMiembroToken();
    return null;
  }, [user, miembro, getToken, getMiembroToken]);

  const esAdmin = !!user;

  useEffect(() => {
    const token = tokenActivo();
    if (!token) return;

    fetch(`${API}/api/cumpleanos/activos`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then(r => r.ok ? r.json() : [])
      .then(data => {
        if (!Array.isArray(data)) return;
        // Filtrar los que este navegador ya vio
        const pendientes = data.filter(m => !localStorage.getItem(seenKey(m.id)));
        if (pendientes.length > 0) {
          setCola(pendientes.slice(1));
          setActual(pendientes[0]);
        }
      })
      .catch(() => {});
  }, [user, miembro]); // eslint-disable-line react-hooks/exhaustive-deps

  const cerrar = () => {
    if (actual) localStorage.setItem(seenKey(actual.id), "1");
    setSaludoTexto("");
    setSaludoEnviado(false);
    setShowSaludoInput(false);
    if (cola.length > 0) {
      setActual(cola[0]);
      setCola(prev => prev.slice(1));
    } else {
      setActual(null);
    }
  };

  const enviarSaludo = async () => {
    if (!saludoTexto.trim() || !actual) return;
    setEnviandoSaludo(true);
    const token = tokenActivo();
    try {
      // Admin → endpoint de admin. Miembro → endpoint de miembro (nombre auto)
      const endpoint = esAdmin ? "/api/cumple-saludos" : "/api/cumple-saludos/from-member";
      const body = esAdmin
        ? { para_miembro_id: actual.id, de_nombre: "Iglesia Vida Nueva IMP", mensaje: saludoTexto.trim(), publico: false }
        : { para_miembro_id: actual.id, mensaje: saludoTexto.trim(), publico: false };

      const res = await fetch(`${API}${endpoint}`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify(body),
      });
      if (!res.ok) { const d = await res.json(); alert(d.error || "Error al enviar saludo"); return; }
      setSaludoEnviado(true);
      setSaludoTexto("");
      setShowSaludoInput(false);
    } catch {
      alert("Error de conexión");
    } finally {
      setEnviandoSaludo(false);
    }
  };

  if (!actual) return null;

  return (
    <div
      className="fixed inset-0 z-[9999] flex items-center justify-center p-4"
      style={{ background: "rgba(0,0,0,0.6)" }}
      onClick={cerrar}
    >
      <style>{`
        @keyframes global-confetti-fall {
          0%   { transform: translateY(-20px) rotate(0deg); opacity: 1; }
          100% { transform: translateY(420px) rotate(720deg); opacity: 0; }
        }
        .g-confetti {
          position: absolute;
          width: 10px; height: 10px;
          animation: global-confetti-fall linear infinite;
        }
      `}</style>

      <div
        className="relative bg-white rounded-3xl shadow-2xl overflow-hidden w-full max-w-sm text-center overflow-y-auto"
        onClick={e => e.stopPropagation()}
        style={{
          background: actual.sexo === 'masculino'
            ? "linear-gradient(135deg,#dbeafe 0%,#e0f2fe 55%,#f0f9ff 100%)"
            : "linear-gradient(135deg,#fff0fb 0%,#fff8e1 50%,#e8f5e9 100%)",
          maxHeight: "90vh"
        }}
      >
        {/* Confetti */}
        {[
          { left:"8%",  delay:"0s",    dur:"1.6s", color:"#f43f5e" },
          { left:"18%", delay:"0.2s",  dur:"1.9s", color:"#a855f7" },
          { left:"30%", delay:"0.4s",  dur:"1.4s", color:"#eab308" },
          { left:"42%", delay:"0.1s",  dur:"2.1s", color:"#3b82f6" },
          { left:"55%", delay:"0.5s",  dur:"1.7s", color:"#10b981" },
          { left:"67%", delay:"0.3s",  dur:"1.5s", color:"#f97316" },
          { left:"78%", delay:"0.6s",  dur:"1.8s", color:"#ec4899" },
          { left:"88%", delay:"0.15s", dur:"2.0s", color:"#6366f1" },
          { left:"24%", delay:"0.7s",  dur:"1.3s", color:"#14b8a6" },
          { left:"60%", delay:"0.35s", dur:"1.6s", color:"#f59e0b" },
          { left:"47%", delay:"0.55s", dur:"2.2s", color:"#8b5cf6" },
          { left:"72%", delay:"0.25s", dur:"1.4s", color:"#e11d48" },
        ].map((c, i) => (
          <div key={i} className="g-confetti" style={{
            left: c.left, top: "-12px", background: c.color,
            animationDelay: c.delay, animationDuration: c.dur,
            borderRadius: i % 2 === 0 ? "50%" : "2px",
          }} />
        ))}

        {/* Encabezado — color según género */}
        <div className="px-6 pt-8 pb-4" style={{ background: actual.sexo === 'masculino'
          ? "linear-gradient(135deg,#93c5fd,#bfdbfe,#6ee7b7)"
          : "linear-gradient(135deg,#f9a8d4,#fde68a,#86efac)" }}>
          <div className="text-5xl mb-2">🎂</div>
          <h2 className="text-2xl font-extrabold text-white" style={{ textShadow: "0 2px 8px rgba(0,0,0,0.2)" }}>
            ¡Feliz Cumpleaños!
          </h2>
        </div>

        {/* Foto + info */}
        <div className="px-6 py-6 flex flex-col items-center gap-3">
          {actual.foto_url ? (
            <img
              src={actual.foto_url}
              alt=""
              className={`w-28 h-28 rounded-full object-cover border-4 shadow-lg ${actual.sexo === 'masculino' ? 'border-blue-300' : 'border-pink-300'}`}
              style={actual.sexo === 'masculino'
                ? { boxShadow: "0 0 0 6px #bfdbfe, 0 0 0 10px #93c5fd" }
                : { boxShadow: "0 0 0 6px #fde68a, 0 0 0 10px #f9a8d4" }}
            />
          ) : (
            <div
              className={`w-28 h-28 rounded-full flex items-center justify-center text-4xl font-extrabold border-4 ${actual.sexo === 'masculino' ? 'border-blue-300' : 'border-pink-300'}`}
              style={actual.sexo === 'masculino'
                ? { background: "linear-gradient(135deg,#93c5fd,#bfdbfe)", boxShadow: "0 0 0 6px #bfdbfe, 0 0 0 10px #93c5fd", color: "#1d4ed8" }
                : { background: "linear-gradient(135deg,#f9a8d4,#fde68a)", boxShadow: "0 0 0 6px #fde68a, 0 0 0 10px #f9a8d4", color: "#be185d" }}
            >
              {actual.nombre?.[0]}{actual.apellido?.[0]}
            </div>
          )}
          <p className="text-2xl font-extrabold text-gray-800 mt-1">
            {actual.nombre} {actual.apellido}
          </p>
          <div className="flex items-center gap-2">
            <span className="text-5xl font-black" style={{ background: actual.sexo === 'masculino'
              ? "linear-gradient(90deg,#2563eb,#1d4ed8,#1e40af)"
              : "linear-gradient(90deg,#f43f5e,#a855f7,#3b82f6)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>
              {actual.edad}
            </span>
            <span className="text-lg font-semibold text-gray-500">años</span>
          </div>
          <div className="flex gap-2 text-2xl mt-1">
            {["🎉","✨","🎈","🌟","🎊","🎉"].map((e, i) => <span key={i}>{e}</span>)}
          </div>
        </div>

        <div className="px-6 pb-6 flex flex-col gap-2">
          {/* Enviar saludo */}
          {saludoEnviado ? (
            <div className="w-full py-2.5 rounded-xl text-sm font-semibold text-green-700 bg-green-50 border border-green-200 text-center">
              ✅ ¡Saludo enviado!
            </div>
          ) : showSaludoInput ? (
            <div className="flex flex-col gap-1.5 text-left">
              <textarea
                value={saludoTexto}
                onChange={e => setSaludoTexto(e.target.value)}
                placeholder="Escribe tu mensaje de felicitación..."
                rows={3}
                className="w-full border rounded-lg px-3 py-1.5 text-sm resize-none focus:outline-none focus:ring-2 bg-white"
                style={actual.sexo === 'masculino'
                  ? { borderColor: "#93c5fd", "--tw-ring-color": "#93c5fd" }
                  : { borderColor: "#f9a8d4", "--tw-ring-color": "#f9a8d4" }}
              />
              <p className="text-xs text-gray-400">El festejado podrá decidir si publicarlo en su perfil.</p>
              <div className="flex gap-2">
                <button
                  onClick={() => setShowSaludoInput(false)}
                  className="flex-1 border border-gray-300 text-gray-600 rounded-lg py-1.5 text-sm hover:bg-gray-50 transition"
                >
                  Cancelar
                </button>
                <button
                  onClick={enviarSaludo}
                  disabled={enviandoSaludo || !saludoTexto.trim()}
                  className="flex-1 text-white rounded-lg py-1.5 text-sm font-semibold disabled:opacity-50 transition"
                  style={{ background: actual.sexo === 'masculino'
                    ? "linear-gradient(90deg,#2563eb,#1d4ed8)"
                    : "linear-gradient(90deg,#ec4899,#a855f7)" }}
                >
                  {enviandoSaludo ? "Enviando..." : "Enviar 💌"}
                </button>
              </div>
            </div>
          ) : (
            <button
              onClick={() => setShowSaludoInput(true)}
              className="w-full py-2.5 rounded-xl font-bold text-white text-sm transition"
              style={{ background: actual.sexo === 'masculino'
                ? "linear-gradient(90deg,#2563eb,#1d4ed8)"
                : "linear-gradient(90deg,#ec4899,#a855f7)" }}
            >
              💌 Enviar saludo
            </button>
          )}

          {/* Celebrar / cerrar */}
          <button
            onClick={cerrar}
            className="w-full py-2.5 rounded-xl font-bold text-white text-base transition mt-1"
            style={{ background: actual.sexo === 'masculino'
              ? "linear-gradient(90deg,#1d4ed8,#1e40af)"
              : "linear-gradient(90deg,#f43f5e,#a855f7)" }}
          >
            🎂 ¡Celebrar!
          </button>
        </div>
      </div>
    </div>
  );
}
