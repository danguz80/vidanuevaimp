import React from "react";
import { Link } from "react-router-dom";

export default function QuienesSomos() {
  return (
    <section className="bg-white py-20 px-4">
      <div className="max-w-7xl mx-auto grid md:grid-cols-2 gap-10 items-center">
        {/* Imagen */}
        <div className="relative rounded-lg overflow-hidden shadow-lg w-full h-[533px]">
          <div className="relative w-full h-[533px] rounded-lg overflow-hidden shadow-lg">
            <img
              src="/pastor_pulpito.jpeg"
              alt="Nuestra Iglesia"
              className="w-full h-full object-cover blur-none scale-105"
            />
            <div className="absolute inset-0 bg-white bg-opacity-30"></div>
          </div>

        </div>


        {/* Contenido */}
        <div>
          <h2 className="text-3xl font-bold text-gray-800 mb-4">¿Quiénes Somos?</h2>
          <p className="text-gray-700 mb-4 leading-relaxed">
            Somos una iglesia evangélica pentecostal comprometida con el mensaje de salvación,
            amor y restauración que ofrece Jesucristo. Nuestra misión es alcanzar vidas,
            edificar familias y glorificar a Dios a través del servicio y la enseñanza bíblica.
          </p>
          <p className="text-gray-700 mb-6 leading-relaxed">
            En Templo Vida Nueva creemos en el poder del Espíritu Santo, en la transformación de vidas
            y en el llamado a servir con humildad, unidad y gozo.
          </p>
          <Link
            to="/contacto"
            className="inline-block bg-blue-600 text-white px-6 py-2 rounded hover:bg-blue-700 transition"
          >
            Contáctanos
          </Link>
        </div>
      </div>
    </section>
  );
}
