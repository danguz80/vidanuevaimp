import React from "react";

export default function Donacion() {
  return (
    <section id="donacion" className="bg-blue-50 py-16 px-4 text-center">
      <div className="max-w-3xl mx-auto">
        <h3 className="text-2xl md:text-3xl font-bold text-gray-800 mb-4">Apoya el Ministerio</h3>
        <p className="text-gray-700 mb-6">
          Tus ofrendas y diezmos nos permiten seguir llevando el mensaje de Jesús. ¡Gracias por sembrar en el Reino!
        </p>
        <a
          href="/donacion"
          className="inline-block bg-blue-600 text-white px-6 py-3 rounded hover:bg-blue-700 transition"
        >
          Ir a Donar
        </a>
      </div>
    </section>
  );
}
