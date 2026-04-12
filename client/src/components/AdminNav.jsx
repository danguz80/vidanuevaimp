import React from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

// Ítems del panel completo (acceso total)
const NAV_ITEMS_FULL = [
  { label: "Miembros",      path: "/admin/miembros",       color: "indigo" },
  { label: "Calendario",    path: "/admin/calendario",     color: "teal" },
  { label: "Planificación", path: "/admin/planificacion",  color: "blue" },
  { label: "Mensajes",      path: "/admin/mensajes",       color: "sky" },
  { label: "Sermones",      path: "/admin/videos",         color: "green" },
  { label: "Hero",          path: "/admin/hero",           color: "purple" },
  { label: "Música",        path: "/admin/musica",         color: "rose" },
  { label: "Galería",       path: "/admin/galeria",        color: "violet" },
];

const NAV_ITEM_FONDOS     = { label: "Fondos",     path: "/admin/fondos",     color: "yellow" };
const NAV_ITEM_SECRETARIA = { label: "Secretaría", path: "/admin/secretaria", color: "cyan" };
const NAV_ITEM_TESORERIA  = { label: "Tesorería",  path: "/admin/tesoreria",  color: "emerald" };

// Roles con acceso total al panel
const ROLES_FULL       = ["admin", "Pastor", "Obispo"];
// Roles con acceso restringido
const ROLES_SECRETARIO = ["Secretario"];
const ROLES_TESORERO   = ["Tesorero"];

const COLOR_MAP = {
  indigo:  { base: "bg-indigo-600 hover:bg-indigo-700",   active: "bg-indigo-800" },
  teal:    { base: "bg-teal-600 hover:bg-teal-700",       active: "bg-teal-800" },
  blue:    { base: "bg-blue-600 hover:bg-blue-700",       active: "bg-blue-800" },
  green:   { base: "bg-green-600 hover:bg-green-700",     active: "bg-green-800" },
  purple:  { base: "bg-purple-600 hover:bg-purple-700",   active: "bg-purple-800" },
  yellow:  { base: "bg-yellow-600 hover:bg-yellow-700",   active: "bg-yellow-800" },
  rose:    { base: "bg-rose-600 hover:bg-rose-700",       active: "bg-rose-800" },
  violet:  { base: "bg-violet-600 hover:bg-violet-700",   active: "bg-violet-800" },
  cyan:    { base: "bg-cyan-600 hover:bg-cyan-700",       active: "bg-cyan-800" },
  sky:     { base: "bg-sky-600 hover:bg-sky-700",         active: "bg-sky-800" },
  emerald: { base: "bg-emerald-600 hover:bg-emerald-700", active: "bg-emerald-800" },
};

export default function AdminNav() {
  const navigate = useNavigate();
  const location = useLocation();
  const { user, roles, logout } = useAuth();

  const esFull       = roles.some(r => ROLES_FULL.includes(r));
  const esSecretario = !esFull && roles.some(r => ROLES_SECRETARIO.includes(r));
  const esTesorero   = !esFull && roles.some(r => ROLES_TESORERO.includes(r));

  // Acceso total: ve todo
  // Secretario solo: ve solo Secretaría
  // Tesorero solo: ve Fondos + Tesorería
  // Combinaciones mixtas se suman
  let visibleItems;
  if (esFull) {
    visibleItems = [...NAV_ITEMS_FULL, NAV_ITEM_FONDOS, NAV_ITEM_SECRETARIA, NAV_ITEM_TESORERIA];
  } else {
    visibleItems = [
      ...(esTesorero   ? [NAV_ITEM_FONDOS, NAV_ITEM_TESORERIA] : []),
      ...(esSecretario ? [NAV_ITEM_SECRETARIA]                  : []),
    ];
  }

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
        {visibleItems.map(item => {
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
