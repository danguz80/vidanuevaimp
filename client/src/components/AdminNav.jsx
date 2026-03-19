import React from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

const NAV_ITEMS = [
  { label: "Mensajes", path: "/admin/mensajes", color: "blue" },
  { label: "Sermones", path: "/admin/videos", color: "green" },
  { label: "Hero", path: "/admin/hero", color: "purple" },
  { label: "Fondos", path: "/admin/fondos", color: "yellow" },
];

const COLOR_MAP = {
  blue:   { base: "bg-blue-600 hover:bg-blue-700",   active: "bg-blue-800" },
  green:  { base: "bg-green-600 hover:bg-green-700", active: "bg-green-800" },
  purple: { base: "bg-purple-600 hover:bg-purple-700", active: "bg-purple-800" },
  yellow: { base: "bg-yellow-600 hover:bg-yellow-700", active: "bg-yellow-800" },
};

export default function AdminNav() {
  const navigate = useNavigate();
  const location = useLocation();
  const { user, logout } = useAuth();

  const handleLogout = () => {
    logout();
    navigate("/");
  };

  return (
    <div className="bg-gray-900 text-white px-6 py-3 flex flex-wrap items-center justify-between gap-3">
      {/* Logo / inicio */}
      <button
        onClick={() => navigate("/admin")}
        className="text-white font-bold text-lg hover:text-blue-300 transition flex-shrink-0"
      >
        ⚙ Admin
      </button>

      {/* Botones de sección */}
      <nav className="flex flex-wrap gap-2">
        {NAV_ITEMS.map(item => {
          const isActive = location.pathname === item.path;
          const colors = COLOR_MAP[item.color];
          return (
            <button
              key={item.path}
              onClick={() => navigate(item.path)}
              className={`text-sm font-semibold py-1.5 px-4 rounded transition text-white ${
                isActive ? colors.active : colors.base
              }`}
            >
              {item.label}
            </button>
          );
        })}
      </nav>

      {/* Usuario + cerrar sesión */}
      <div className="flex items-center gap-3 flex-shrink-0">
        {user && (
          <span className="text-gray-300 text-sm hidden sm:block">
            {user.username}
          </span>
        )}
        <button
          onClick={handleLogout}
          className="bg-red-600 hover:bg-red-700 text-white text-sm font-semibold py-1.5 px-4 rounded transition"
        >
          Salir
        </button>
      </div>
    </div>
  );
}
