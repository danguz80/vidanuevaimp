import React, { useState } from "react";

/**
 * Modal de cumpleaños reutilizable para AdminCalendario y Calendario.
 *
 * Props:
 *  - miembro         : objeto { id, nombre, apellido, foto_url, sexo, fecha_nacimiento, edad }
 *  - diasDesde       : número de días desde el cumpleaños (0 = hoy, 1-7 = ventana)
 *  - onClose         : () => void
 *  - onEnviarSaludo  : async (texto: string, deNombre: string) => Promise<void>
 *                      el padre se encarga de llamar al endpoint correcto
 *  - conCampoDe      : boolean — si true muestra campo "De parte de..." (sección admin)
 *  - deNombreInicial : string  — valor inicial para "De parte de..." (admin)
 */
export default function CumpleaniosModal({
  miembro,
  diasDesde = 999,
  onClose,
  onEnviarSaludo,
  conCampoDe = false,
  deNombreInicial = "Iglesia Vida Nueva IMP",
}) {
  const [showSaludoInput, setShowSaludoInput] = useState(false);
  const [saludoTexto, setSaludoTexto] = useState("");
  const [saludoDeNombre, setSaludoDeNombre] = useState(deNombreInicial);
  const [enviandoSaludo, setEnviandoSaludo] = useState(false);
  const [saludoEnviado, setSaludoEnviado] = useState(false);

  const esMasculino = miembro?.sexo === "masculino";

  const gradientePrincipal = esMasculino
    ? "linear-gradient(135deg,#93c5fd,#bfdbfe,#6ee7b7)"
    : "linear-gradient(135deg,#f9a8d4,#fde68a,#86efac)";

  const gradienteBoton = esMasculino
    ? "linear-gradient(90deg,#2563eb,#1d4ed8)"
    : "linear-gradient(90deg,#ec4899,#a855f7)";

  const gradienteCelebrar = esMasculino
    ? "linear-gradient(90deg,#1d4ed8,#1e40af)"
    : "linear-gradient(90deg,#f43f5e,#a855f7)";

  const fondoCard = esMasculino
    ? "linear-gradient(135deg,#dbeafe 0%,#e0f2fe 55%,#f0f9ff 100%)"
    : "linear-gradient(135deg,#fff0fb 0%,#fff8e1 50%,#e8f5e9 100%)";

  const borderFotoColor = esMasculino ? "border-blue-300" : "border-pink-300";
  const shadowFoto = esMasculino
    ? { boxShadow: "0 0 0 6px #bfdbfe, 0 0 0 10px #93c5fd" }
    : { boxShadow: "0 0 0 6px #fde68a, 0 0 0 10px #f9a8d4" };
  const gradienteNumero = esMasculino
    ? "linear-gradient(90deg,#2563eb,#1d4ed8,#1e40af)"
    : "linear-gradient(90deg,#f43f5e,#a855f7,#3b82f6)";

  const handleEnviar = async () => {
    if (!saludoTexto.trim()) return;
    setEnviandoSaludo(true);
    try {
      await onEnviarSaludo(saludoTexto.trim(), saludoDeNombre.trim() || deNombreInicial);
      setSaludoEnviado(true);
      setSaludoTexto("");
      setShowSaludoInput(false);
    } catch {
      // el padre ya maneja el error con alert
    } finally {
      setEnviandoSaludo(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: "rgba(0,0,0,0.55)" }}
      onClick={onClose}
    >
      <style>{`
        @keyframes cumple-confetti-fall {
          0%   { transform: translateY(-20px) rotate(0deg); opacity: 1; }
          100% { transform: translateY(380px) rotate(720deg); opacity: 0; }
        }
        .cumple-confetti-piece {
          position: absolute;
          width: 10px; height: 10px;
          animation: cumple-confetti-fall linear infinite;
        }
      `}</style>

      <div
        className="relative rounded-3xl shadow-2xl overflow-hidden w-full max-w-sm text-center overflow-y-auto"
        onClick={e => e.stopPropagation()}
        style={{ background: fondoCard, maxHeight: "90vh" }}
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
          <div key={i} className="cumple-confetti-piece" style={{
            left: c.left, top: "-12px", background: c.color,
            animationDelay: c.delay, animationDuration: c.dur,
            borderRadius: i % 2 === 0 ? "50%" : "2px",
          }} />
        ))}

        {/* Encabezado */}
        <div className="px-6 pt-8 pb-4" style={{ background: gradientePrincipal }}>
          <div className="text-5xl mb-2">🎂</div>
          <h2 className="text-2xl font-extrabold text-white" style={{ textShadow: "0 2px 8px rgba(0,0,0,0.2)" }}>
            ¡Feliz Cumpleaños!
          </h2>
        </div>

        {/* Foto + info */}
        <div className="px-6 py-6 flex flex-col items-center gap-3">
          {miembro?.foto_url ? (
            <img
              src={miembro.foto_url}
              alt=""
              className={`w-28 h-28 rounded-full object-cover border-4 shadow-lg ${borderFotoColor}`}
              style={shadowFoto}
            />
          ) : (
            <div
              className={`w-28 h-28 rounded-full flex items-center justify-center text-4xl font-extrabold border-4 ${borderFotoColor}`}
              style={esMasculino
                ? { background: "linear-gradient(135deg,#93c5fd,#bfdbfe)", ...shadowFoto, color: "#1d4ed8" }
                : { background: "linear-gradient(135deg,#f9a8d4,#fde68a)", ...shadowFoto, color: "#be185d" }}
            >
              {miembro?.nombre?.[0]}{miembro?.apellido?.[0]}
            </div>
          )}

          <p className="text-2xl font-extrabold text-gray-800 mt-1">
            {miembro?.nombre} {miembro?.apellido}
          </p>

          <div className="flex items-center gap-2">
            <span
              className="text-5xl font-black"
              style={{ background: gradienteNumero, WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}
            >
              {miembro?.edad}
            </span>
            <span className="text-lg font-semibold text-gray-500">años</span>
          </div>

          <div className="flex gap-2 text-2xl mt-1">
            {["🎉","✨","🎈","🌟","🎊","🎉"].map((e, i) => <span key={i}>{e}</span>)}
          </div>
        </div>

        {/* Botones */}
        <div className="px-6 pb-6 flex flex-col gap-2">
          {diasDesde <= 7 && (saludoEnviado ? (
            <div className="w-full py-2.5 rounded-xl text-sm font-semibold text-green-700 bg-green-50 border border-green-200 text-center">
              ✅ ¡Saludo enviado con éxito!
            </div>
          ) : showSaludoInput ? (
            <div className="flex flex-col gap-1.5 text-left">
              {conCampoDe && (
                <input
                  value={saludoDeNombre}
                  onChange={e => setSaludoDeNombre(e.target.value)}
                  placeholder="De parte de..."
                  className={`w-full border rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 bg-white ${
                    esMasculino ? "border-blue-200 focus:ring-blue-300" : "border-pink-200 focus:ring-pink-300"
                  }`}
                />
              )}
              <textarea
                value={saludoTexto}
                onChange={e => setSaludoTexto(e.target.value)}
                placeholder="Escribe un mensaje de saludo..."
                rows={3}
                className={`w-full border rounded-lg px-3 py-1.5 text-sm resize-none focus:outline-none focus:ring-2 bg-white ${
                  esMasculino ? "border-blue-200 focus:ring-blue-300" : "border-pink-200 focus:ring-pink-300"
                }`}
              />
              <p className="text-xs text-gray-400">El festejado podrá decidir si hacerlo público en su perfil.</p>
              <div className="flex gap-2">
                <button
                  onClick={() => setShowSaludoInput(false)}
                  className="flex-1 border border-gray-300 text-gray-600 rounded-lg py-1.5 text-sm hover:bg-gray-50 transition"
                >
                  Cancelar
                </button>
                <button
                  onClick={handleEnviar}
                  disabled={enviandoSaludo || !saludoTexto.trim()}
                  className="flex-1 text-white rounded-lg py-1.5 text-sm font-semibold disabled:opacity-50 transition"
                  style={{ background: gradienteBoton }}
                >
                  {enviandoSaludo ? "Enviando..." : "Enviar 💌"}
                </button>
              </div>
            </div>
          ) : (
            <button
              onClick={() => setShowSaludoInput(true)}
              className="w-full py-2.5 rounded-xl font-bold text-white text-sm transition"
              style={{ background: gradienteBoton }}
            >
              💌 Enviar saludo
            </button>
          ))}

          <button
            onClick={onClose}
            className="w-full py-2.5 rounded-xl font-bold text-white text-base transition mt-1"
            style={{ background: gradienteCelebrar }}
          >
            🎂 ¡Celebrar!
          </button>
        </div>
      </div>
    </div>
  );
}
