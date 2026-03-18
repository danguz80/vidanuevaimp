import React from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

export default function AdminPanel() {
  const navigate = useNavigate();
  const { user, logout } = useAuth();

  const handleLogout = () => {
    logout();
    navigate("/");
  };

  return (
    <div className="p-8 max-w-4xl mx-auto text-center">
      <div className="mb-6 flex justify-between items-center">
        <h1 className="text-3xl font-bold">Panel de Administración</h1>
        <div className="flex items-center gap-4">
          <span className="text-gray-600">Bienvenido, <strong>{user?.username}</strong></span>
          <button
            onClick={handleLogout}
            className="bg-red-600 hover:bg-red-700 text-white font-semibold py-2 px-4 rounded transition"
          >
            Cerrar Sesión
          </button>
        </div>
      </div>

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

        <button
          onClick={() => navigate("/admin/fondos")}
          className="bg-yellow-600 hover:bg-yellow-700 text-white font-semibold py-3 px-6 rounded transition"
        >
          Fondos y Donaciones
        </button>
      </div>
    </div>
  );
}
