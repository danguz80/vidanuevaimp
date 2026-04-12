import React from "react";
import { Link } from "react-router-dom";

export default function QuienesSomos() {
  return (
    <section className="relative bg-gradient-to-br from-violet-50 via-white to-indigo-50 py-24 px-4 overflow-hidden">
      {/* Decoración de fondo */}
      <div className="absolute top-0 right-0 w-96 h-96 bg-violet-100 rounded-full opacity-40 blur-3xl -translate-y-1/2 translate-x-1/3 pointer-events-none" />
      <div className="absolute bottom-0 left-0 w-72 h-72 bg-indigo-100 rounded-full opacity-40 blur-3xl translate-y-1/2 -translate-x-1/3 pointer-events-none" />

      <div className="max-w-7xl mx-auto grid md:grid-cols-2 gap-14 items-center relative">
        {/* Imagen */}
        <div className="relative rounded-2xl overflow-hidden shadow-2xl w-full h-[533px] group">
          <img
            src="/pastor_pulpito.jpeg"
            alt="Nuestra Iglesia"
            className="w-full h-full object-cover scale-105 group-hover:scale-100 transition-transform duration-700"
          />
          {/* Overlay con gradiente */}
          <div className="absolute inset-0 bg-gradient-to-t from-violet-900/40 via-transparent to-transparent" />
          {/* Badge decorativo */}
          <div className="absolute bottom-6 left-6 bg-white/90 backdrop-blur-sm px-4 py-2 rounded-full shadow-lg">
            <span className="text-violet-800 font-bold text-sm">Templo Vida Nueva · Valparaíso</span>
          </div>
        </div>

        {/* Contenido */}
        <div>
          <span className="inline-block text-amber-600 font-bold text-sm tracking-widest uppercase mb-3">Conócenos</span>
          <h2 className="text-4xl md:text-5xl font-bold text-violet-900 mb-6 leading-tight" style={{fontFamily:'"Playfair Display", Georgia, serif'}}>
            ¿Quiénes Somos?
          </h2>
          <div className="w-16 h-1 bg-gradient-to-r from-amber-400 to-orange-400 rounded-full mb-6" />
          <p className="text-slate-600 mb-4 leading-relaxed text-lg">
            Somos una iglesia evangélica pentecostal comprometida con el mensaje de salvación,
            amor y restauración que ofrece Jesucristo. Nuestra misión es alcanzar vidas,
            edificar familias y glorificar a Dios a través del servicio y la enseñanza bíblica.
          </p>
          <p className="text-slate-600 mb-8 leading-relaxed text-lg">
            En Templo Vida Nueva creemos en el poder del Espíritu Santo, en la transformación de vidas
            y en el llamado a servir con humildad, unidad y gozo.
          </p>
          <Link to="/contacto" className="btn-primary">
            Contáctanos
          </Link>
        </div>
      </div>
    </section>
  );
}
