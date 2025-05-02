import React from "react";
import { useNavigate } from "react-router-dom";

export default function AdminPanel() {
  const navigate = useNavigate();

  return (
    <div className="p-8 max-w-4xl mx-auto text-center">
      <h1 className="text-3xl font-bold mb-8">Panel de Administración</h1>

      <div className="flex flex-col md:flex-row gap-6 justify-center">
        <button
          onClick={() => navigate("/admin/mensajes")}
          className="bg-blue-600 hover:bg-blue-700 text-white font-semibold py-3 px-6 rounded transition"
        >
          Ver Mensajes de Contacto
        </button>

        <button
          onClick={() => navigate("/admin/videos")}
          className="bg-green-600 hover:bg-green-700 text-white font-semibold py-3 px-6 rounded transition"
        >
          Administrar Videos de Sermones
        </button>

        <button
          onClick={() => navigate("/admin/hero")}
          className="bg-purple-600 hover:bg-purple-700 text-white font-semibold py-3 px-6 rounded transition"
        >
          Administrar Hero
        </button>
      </div>
    </div>
  );
}
