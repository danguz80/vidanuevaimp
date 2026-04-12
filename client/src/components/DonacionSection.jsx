import React from "react";
import { Link } from "react-router-dom";

export default function DonacionSection() {
  return (
    <section id="donacion" className="relative py-24 px-4 text-center overflow-hidden">
      {/* Fondo con gradiente rico */}
      <div className="absolute inset-0 bg-gradient-to-br from-violet-800 via-purple-800 to-indigo-900" />
      {/* Patrón decorativo */}
      <div className="absolute inset-0 opacity-10" style={{backgroundImage: 'radial-gradient(circle at 2px 2px, white 1px, transparent 0)', backgroundSize: '32px 32px'}} />
      <div className="absolute top-0 right-0 w-80 h-80 bg-amber-500 opacity-10 rounded-full blur-3xl" />
      <div className="absolute bottom-0 left-0 w-80 h-80 bg-violet-400 opacity-10 rounded-full blur-3xl" />

      <div className="max-w-3xl mx-auto relative">
        <span className="inline-block text-amber-400 font-bold text-sm tracking-widest uppercase mb-3">Apoya el Ministerio</span>
        <h3 className="text-4xl md:text-5xl font-bold text-white mb-6 leading-tight" style={{fontFamily:'"Playfair Display", Georgia, serif'}}>
          Siembra en el Reino
        </h3>
        <div className="w-16 h-1 bg-gradient-to-r from-amber-400 to-orange-400 rounded-full mx-auto mb-6" />
        <p className="text-violet-200 mb-8 text-lg leading-relaxed">
          Tus ofrendas y diezmos nos permiten seguir llevando el mensaje de Jesús.
          ¡Gracias por sembrar en el Reino!
        </p>
        <Link to="/donacion" className="btn-gold text-base px-8 py-3">
          Ir a Donar
        </Link>
      </div>
    </section>
  );
}
