import React from "react";
import { FaChurch, FaVideo, FaPrayingHands, FaChalkboardTeacher } from "react-icons/fa";

const horarios = [
  { dia: "Martes", hora: "20:00", tipo: "Culto Online", icon: <FaVideo className="text-blue-500" />, detalle: "Vía Zoom" },
  { dia: "Jueves", hora: "10:30", tipo: "Dorcas", icon: <FaVideo className="text-pink-500" />, detalle: "Online vía Zoom" },
  { dia: "Jueves", hora: "19:00", tipo: "Culto General", icon: <FaChurch className="text-green-600" />, detalle: "Presencial" },
  { dia: "Viernes", hora: "20:00", tipo: "Oración Online", icon: <FaPrayingHands className="text-blue-500" />, detalle: "Vía Zoom" },
  { dia: "Domingo", hora: "11:30", tipo: "Culto General", icon: <FaChurch className="text-green-600" />, detalle: "Presencial" },
  { dia: "Domingo", hora: "", tipo: "Escuela Dominical", icon: <FaChalkboardTeacher className="text-yellow-600" />, detalle: "Durante el culto" },
];

export default function Horarios() {
  return (
    <section className="relative bg-gradient-to-br from-indigo-50 via-violet-50 to-purple-50 py-24 px-4 text-center overflow-hidden">
      {/* Decoración */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-violet-100 rounded-full opacity-30 blur-3xl pointer-events-none" />

      <div className="max-w-5xl mx-auto relative">
        <span className="inline-block text-amber-600 font-bold text-sm tracking-widest uppercase mb-3">Reuniones</span>
        <h2 className="text-4xl md:text-5xl font-bold text-violet-900 mb-3" style={{fontFamily:'"Playfair Display", Georgia, serif'}}>
          Horarios
        </h2>
        <div className="w-16 h-1 bg-gradient-to-r from-amber-400 to-orange-400 rounded-full mx-auto mb-12" />

        <div className="grid md:grid-cols-2 gap-5 text-left">
          {horarios.map((h, i) => (
            <div
              key={i}
              className="flex items-start gap-4 bg-white/80 backdrop-blur-sm p-6 rounded-2xl shadow-md border border-violet-100 hover:shadow-xl hover:-translate-y-1 transition-all duration-300 group"
            >
              <div className="text-3xl w-12 h-12 flex items-center justify-center bg-gradient-to-br from-violet-100 to-indigo-100 rounded-xl group-hover:from-violet-200 group-hover:to-indigo-200 transition-colors shrink-0">
                {h.icon}
              </div>
              <div>
                <h3 className="text-lg font-bold text-violet-900">{h.tipo}</h3>
                <p className="text-slate-600 mt-1">
                  <span className="font-semibold text-indigo-700">{h.dia}</span>
                  {h.hora && <span className="text-slate-500"> · {h.hora}</span>}
                </p>
                <span className="inline-block mt-1.5 text-xs font-semibold bg-violet-100 text-violet-700 px-2.5 py-0.5 rounded-full">{h.detalle}</span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
