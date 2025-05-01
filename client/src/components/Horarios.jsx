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
    <section className="bg-gray-50 py-20 px-4 text-center">
      <div className="max-w-5xl mx-auto">
        <h2 className="text-3xl font-bold text-gray-800 mb-10">Horarios de Reunión</h2>

        <div className="grid md:grid-cols-2 gap-6 text-left">
          {horarios.map((h, i) => (
            <div
              key={i}
              className="flex items-start gap-4 bg-white p-6 rounded-lg shadow-md border border-gray-100"
            >
              <div className="text-3xl">{h.icon}</div>
              <div>
                <h3 className="text-lg font-semibold text-gray-800">{h.tipo}</h3>
                <p className="text-gray-600">
                  <strong>{h.dia}</strong>{h.hora && ` - ${h.hora}`}<br />
                  <span className="text-sm">{h.detalle}</span>
                </p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
