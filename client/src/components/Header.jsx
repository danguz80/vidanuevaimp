import React, { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { useMemberAuth } from "../context/MemberAuthContext";

export default function Header() {
  const [menuOpen, setMenuOpen] = useState(false);
  const { user, logout } = useAuth();
  const { miembro, logout: logoutMiembro } = useMemberAuth();
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    logoutMiembro();
    navigate("/");
    setMenuOpen(false);
  };

  return (
    <header className="bg-white shadow-md relative z-50">
      <div className="max-w-7xl mx-auto px-4 py-4 flex items-center justify-between">
        {/* Logo */}
        <Link to="/" className="flex items-center gap-4">
          <img
            src="/logo-horizontal.png"
            alt="Logo Iglesia"
            className="h-16 w-auto object-contain"
          />
        </Link>


        {/* Botón hamburguesa */}
        <button
          className="md:hidden text-gray-700 focus:outline-none"
          onClick={() => setMenuOpen(!menuOpen)}
        >
          <svg className="w-7 h-7" fill="none" stroke="currentColor" strokeWidth="2"
            viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
            <path strokeLinecap="round" strokeLinejoin="round"
              d="M4 6h16M4 12h16M4 18h16" />
          </svg>
        </button>

        {/* Menú en escritorio */}
        <nav className="hidden md:flex gap-4 items-center text-sm md:text-base">
          <Link to="/" className="text-gray-700 hover:text-blue-600">Inicio</Link>
          <Link to="/quienes-somos" className="text-gray-700 hover:text-blue-600">Quiénes Somos</Link>
          <Link to="/calendario" className="text-gray-700 hover:text-blue-600">Calendario</Link>
          <Link to="/galeria" className="text-gray-700 hover:text-blue-600">Galería</Link>
          <Link to="/soundcloud" className="text-gray-700 hover:text-blue-600">Música</Link>
          <Link to="/contacto" className="text-gray-700 hover:text-blue-600">Contacto</Link>
          <Link to="/donacion" className="bg-blue-600 text-white px-3 py-1 rounded hover:bg-blue-700">Donar</Link>
          
          {user && (
            <Link to="/admin" className="bg-purple-600 text-white px-3 py-1 rounded hover:bg-purple-700">Admin</Link>
          )}
          {miembro ? (
            <>
              <Link to="/portal" className="bg-indigo-600 text-white px-3 py-1 rounded hover:bg-indigo-700">
                {miembro.nombre}
              </Link>
              <button onClick={handleLogout} className="bg-gray-600 text-white px-3 py-1 rounded hover:bg-gray-700">Salir</button>
            </>
          ) : user ? (
            <button onClick={handleLogout} className="bg-gray-600 text-white px-3 py-1 rounded hover:bg-gray-700">Salir</button>
          ) : (
            <Link to="/portal/login" className="bg-green-600 text-white px-3 py-1 rounded hover:bg-green-700">Mi Portal</Link>
          )}
        </nav>
      </div>

      {/* Menú en móvil */}
      {menuOpen && (
        <div className="absolute top-full left-0 w-full bg-white shadow-md flex flex-col items-center py-4 space-y-3 md:hidden z-40">
          <Link to="/" onClick={() => setMenuOpen(false)} className="text-gray-700 hover:text-blue-600">Inicio</Link>
          <Link to="/quienes-somos" onClick={() => setMenuOpen(false)} className="text-gray-700 hover:text-blue-600">Quiénes Somos</Link>
          <Link to="/calendario" onClick={() => setMenuOpen(false)} className="text-gray-700 hover:text-blue-600">Calendario</Link>
          <Link to="/galeria" onClick={() => setMenuOpen(false)} className="text-gray-700 hover:text-blue-600">Galería</Link>
          <Link to="/soundcloud" onClick={() => setMenuOpen(false)} className="text-gray-700 hover:text-blue-600">Música</Link>
          <Link to="/contacto" onClick={() => setMenuOpen(false)} className="text-gray-700 hover:text-blue-600">Contacto</Link>
          <Link to="/donacion" onClick={() => setMenuOpen(false)} className="bg-blue-600 text-white px-6 py-2 rounded hover:bg-blue-700">Donar</Link>
          
          {user && (
            <Link to="/admin" onClick={() => setMenuOpen(false)} className="bg-purple-600 text-white px-6 py-2 rounded hover:bg-purple-700">Admin</Link>
          )}
          {miembro ? (
            <>
              <Link to="/portal" onClick={() => setMenuOpen(false)} className="bg-indigo-600 text-white px-6 py-2 rounded hover:bg-indigo-700">
                {miembro.nombre}
              </Link>
              <button onClick={handleLogout} className="bg-gray-600 text-white px-6 py-2 rounded hover:bg-gray-700">Salir</button>
            </>
          ) : user ? (
            <button onClick={handleLogout} className="bg-gray-600 text-white px-6 py-2 rounded hover:bg-gray-700">Salir</button>
          ) : (
            <Link to="/portal/login" onClick={() => setMenuOpen(false)} className="bg-green-600 text-white px-6 py-2 rounded hover:bg-green-700">Mi Portal</Link>
          )}
        </div>
      )}
    </header>
  );
}
