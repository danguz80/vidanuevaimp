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

  const navLinkClass = "relative text-violet-200 hover:text-amber-400 font-semibold tracking-wide transition-colors duration-200 after:absolute after:bottom-0 after:left-0 after:w-0 after:h-0.5 after:bg-amber-400 hover:after:w-full after:transition-all after:duration-300";

  return (
    <header className="bg-gradient-to-r from-violet-950 via-purple-900 to-indigo-900 shadow-xl relative z-50">
      {/* Línea decorativa superior */}
      <div className="h-1 w-full bg-gradient-to-r from-amber-400 via-orange-400 to-amber-500" />

      <div className="max-w-7xl mx-auto px-4 py-3 flex items-center justify-between">
        {/* Logo */}
        <Link to="/" className="flex items-center gap-3">
          <img
            src="/logo-horizontal.png"
            alt="Logo Iglesia"
            className="h-14 w-auto object-contain brightness-0 invert"
          />
        </Link>

        {/* Botón hamburguesa */}
        <button
          className="md:hidden text-violet-200 hover:text-amber-400 focus:outline-none transition-colors"
          onClick={() => setMenuOpen(!menuOpen)}
        >
          {menuOpen ? (
            <svg className="w-7 h-7" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          ) : (
            <svg className="w-7 h-7" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h16" />
            </svg>
          )}
        </button>

        {/* Menú en escritorio */}
        <nav className="hidden md:flex gap-6 items-center text-sm">
          <Link to="/" className={navLinkClass}>Inicio</Link>
          <Link to="/quienes-somos" className={navLinkClass}>Quiénes Somos</Link>
          <Link to="/calendario" className={navLinkClass}>Calendario</Link>
          <Link to="/galeria" className={navLinkClass}>Galería</Link>
          <Link to="/soundcloud" className={navLinkClass}>Música</Link>
          <Link to="/contacto" className={navLinkClass}>Contacto</Link>

          <Link to="/donacion" className="btn-gold text-sm py-1.5 px-5">Donar</Link>

          {user && (
            <Link to="/admin" className="bg-violet-600/60 border border-violet-400/40 text-violet-100 px-3 py-1.5 rounded-full text-xs font-semibold hover:bg-violet-600 transition-colors">Admin</Link>
          )}
          {miembro ? (
            <>
              <Link to="/portal" className="bg-indigo-500/60 border border-indigo-400/40 text-indigo-100 px-3 py-1.5 rounded-full text-xs font-semibold hover:bg-indigo-500 transition-colors">
                {miembro.nombre}
              </Link>
              <button onClick={handleLogout} className="text-violet-300 hover:text-red-400 text-xs font-semibold transition-colors">Salir</button>
            </>
          ) : user ? (
            <button onClick={handleLogout} className="text-violet-300 hover:text-red-400 text-xs font-semibold transition-colors">Salir</button>
          ) : (
            <Link to="/portal/login" className="border border-violet-400/50 text-violet-200 px-3 py-1.5 rounded-full text-xs font-semibold hover:bg-violet-800/50 transition-colors">Mi Portal</Link>
          )}
        </nav>
      </div>

      {/* Menú en móvil */}
      {menuOpen && (
        <div className="absolute top-full left-0 w-full bg-gradient-to-b from-violet-950 to-indigo-900 shadow-2xl flex flex-col items-center py-6 space-y-4 md:hidden z-40 border-t border-violet-700/40">
          <Link to="/" onClick={() => setMenuOpen(false)} className="text-violet-200 hover:text-amber-400 font-semibold transition-colors">Inicio</Link>
          <Link to="/quienes-somos" onClick={() => setMenuOpen(false)} className="text-violet-200 hover:text-amber-400 font-semibold transition-colors">Quiénes Somos</Link>
          <Link to="/calendario" onClick={() => setMenuOpen(false)} className="text-violet-200 hover:text-amber-400 font-semibold transition-colors">Calendario</Link>
          <Link to="/galeria" onClick={() => setMenuOpen(false)} className="text-violet-200 hover:text-amber-400 font-semibold transition-colors">Galería</Link>
          <Link to="/soundcloud" onClick={() => setMenuOpen(false)} className="text-violet-200 hover:text-amber-400 font-semibold transition-colors">Música</Link>
          <Link to="/contacto" onClick={() => setMenuOpen(false)} className="text-violet-200 hover:text-amber-400 font-semibold transition-colors">Contacto</Link>

          <div className="h-px w-24 bg-violet-700/50" />

          <Link to="/donacion" onClick={() => setMenuOpen(false)} className="btn-gold text-sm">Donar</Link>

          {user && (
            <Link to="/admin" onClick={() => setMenuOpen(false)} className="bg-violet-600/60 border border-violet-400/40 text-violet-100 px-6 py-2 rounded-full text-sm font-semibold hover:bg-violet-600 transition-colors">Admin</Link>
          )}
          {miembro ? (
            <>
              <Link to="/portal" onClick={() => setMenuOpen(false)} className="bg-indigo-500/60 border border-indigo-400/40 text-indigo-100 px-6 py-2 rounded-full text-sm font-semibold">
                {miembro.nombre}
              </Link>
              <button onClick={handleLogout} className="text-violet-300 hover:text-red-400 text-sm font-semibold transition-colors">Salir</button>
            </>
          ) : user ? (
            <button onClick={handleLogout} className="text-violet-300 hover:text-red-400 text-sm font-semibold transition-colors">Salir</button>
          ) : (
            <Link to="/portal/login" onClick={() => setMenuOpen(false)} className="border border-violet-400/50 text-violet-200 px-6 py-2 rounded-full text-sm font-semibold hover:bg-violet-800/50 transition-colors">Mi Portal</Link>
          )}
        </div>
      )}
    </header>
  );
}
