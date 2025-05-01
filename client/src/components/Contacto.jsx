import React, { useState } from "react";

const backendUrl = import.meta.env.VITE_BACKEND_URL;

export default function Contacto() {
  const [formData, setFormData] = useState({ nombre: "", correo: "", mensaje: "" });

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    try {
      const res = await fetch(`${backendUrl}/api/contacto`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formData),
      });

      if (res.ok) {
        alert("Petición enviada correctamente");
        setFormData({ nombre: "", correo: "", mensaje: "" });
      } else {
        alert("Error al enviar petición");
      }
    } catch (error) {
      console.error("Error:", error);
    }
  };

  return (
    <section id="contacto" className="bg-white py-16 px-4">
      <div className="max-w-4xl mx-auto text-center mb-10">
        <h3 className="text-2xl md:text-3xl font-bold text-gray-800 mb-4">¿Necesitas oración?</h3>
        <p className="text-gray-600">
          Estamos aquí para orar contigo y por ti. Completa el siguiente formulario y uno de nuestros líderes te contactará.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="max-w-2xl mx-auto space-y-6 text-left">
        <div>
          <label className="block text-gray-700 mb-1">Nombre</label>
          <input
            type="text"
            name="nombre"
            value={formData.nombre}
            onChange={handleChange}
            className="w-full border border-gray-300 p-2 rounded"
            required
          />
        </div>

        <div>
          <label className="block text-gray-700 mb-1">Correo electrónico</label>
          <input
            type="email"
            name="correo"
            value={formData.correo}
            onChange={handleChange}
            className="w-full border border-gray-300 p-2 rounded"
            required
          />
        </div>

        <div>
          <label className="block text-gray-700 mb-1">Petición de oración</label>
          <textarea
            name="mensaje"
            value={formData.mensaje}
            onChange={handleChange}
            className="w-full border border-gray-300 p-2 rounded h-32"
            required
          />
        </div>

        <div className="text-center">
          <button
            type="submit"
            className="bg-blue-600 text-white px-6 py-2 rounded hover:bg-blue-700 transition"
          >
            Enviar petición
          </button>
        </div>
      </form>
    </section>
  );
}
