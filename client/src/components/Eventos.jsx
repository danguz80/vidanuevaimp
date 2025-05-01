import React from "react";

export default function Eventos() {
  return (
    <section id="eventos" className="bg-white py-16 px-4">
      <div className="max-w-6xl mx-auto text-center mb-12">
        <h3 className="text-2xl md:text-3xl font-bold text-gray-800 mb-4">Próximos Eventos</h3>
        <p className="text-gray-600">Conéctate con nuestras actividades y reuniones especiales</p>
      </div>

      <div className="max-w-6xl mx-auto grid gap-8 md:grid-cols-2 lg:grid-cols-3">
        {/* Evento 1 */}
        <div className="bg-blue-50 rounded-lg shadow-sm p-6 text-left">
          <h4 className="text-xl font-semibold text-blue-700 mb-2">Culto de Adoración</h4>
          <p className="text-gray-700 mb-1">📅 Domingo 14 de abril, 10:00 AM</p>
          <p className="text-gray-600">Un tiempo de alabanza, palabra y comunión en el templo Vida Nueva.</p>
        </div>

        {/* Evento 2 */}
        <div className="bg-blue-50 rounded-lg shadow-sm p-6 text-left">
          <h4 className="text-xl font-semibold text-blue-700 mb-2">Reunión de Jóvenes</h4>
          <p className="text-gray-700 mb-1">📅 Viernes 19 de abril, 19:30 Hrs</p>
          <p className="text-gray-600">Encuentro juvenil con dinámicas, música y mensaje especial.</p>
        </div>

        {/* Evento 3 */}
        <div className="bg-blue-50 rounded-lg shadow-sm p-6 text-left">
          <h4 className="text-xl font-semibold text-blue-700 mb-2">Estudio Bíblico</h4>
          <p className="text-gray-700 mb-1">📅 Miércoles 17 de abril, 20:00 Hrs</p>
          <p className="text-gray-600">Profundiza en la Palabra con enseñanzas prácticas para tu vida.</p>
        </div>
      </div>

      <div className="text-center mt-10">
        <a
          href="#"
          className="inline-block bg-blue-600 text-white px-6 py-2 rounded hover:bg-blue-700 transition"
        >
          Ver todos los eventos
        </a>
      </div>
    </section>
  );
}
