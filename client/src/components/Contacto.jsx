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
    <section id="contacto" className="relative bg-gradient-to-br from-violet-50 via-white to-indigo-50 py-24 px-4 overflow-hidden">
      <div className="absolute top-0 right-0 w-64 h-64 bg-violet-100 rounded-full opacity-50 blur-3xl -translate-y-1/2 translate-x-1/3 pointer-events-none" />

      <div className="max-w-4xl mx-auto text-center mb-12">
        <span className="inline-block text-amber-600 font-bold text-sm tracking-widest uppercase mb-3">Escríbenos</span>
        <h3 className="text-4xl md:text-5xl font-bold text-violet-900 mb-4" style={{fontFamily:'"Playfair Display", Georgia, serif'}}>
          ¡Contáctanos!
        </h3>
        <div className="w-16 h-1 bg-gradient-to-r from-amber-400 to-orange-400 rounded-full mx-auto mb-5" />
        <p className="text-slate-600 text-lg max-w-2xl mx-auto">
          Si necesitas comunicarnos algo, realizar alguna consulta, petición de oración, o por cualquier otro motivo, rellena con tus datos el siguiente formulario y detállanos el motivo de tu inquietud.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="max-w-2xl mx-auto space-y-5 text-left relative">
        <div>
          <label className="block text-violet-900 font-semibold mb-1.5 text-sm">Nombre</label>
          <input
            type="text"
            name="nombre"
            value={formData.nombre}
            onChange={handleChange}
            className="w-full border-2 border-violet-200 focus:border-violet-500 bg-white/80 backdrop-blur-sm p-3 rounded-xl outline-none transition-colors duration-200 text-slate-700"
            required
          />
        </div>

        <div>
          <label className="block text-violet-900 font-semibold mb-1.5 text-sm">Correo electrónico</label>
          <input
            type="email"
            name="correo"
            value={formData.correo}
            onChange={handleChange}
            className="w-full border-2 border-violet-200 focus:border-violet-500 bg-white/80 backdrop-blur-sm p-3 rounded-xl outline-none transition-colors duration-200 text-slate-700"
            required
          />
        </div>

        <div>
          <label className="block text-violet-900 font-semibold mb-1.5 text-sm">¡Escríbenos!</label>
          <textarea
            name="mensaje"
            value={formData.mensaje}
            onChange={handleChange}
            className="w-full border-2 border-violet-200 focus:border-violet-500 bg-white/80 backdrop-blur-sm p-3 rounded-xl outline-none transition-colors duration-200 text-slate-700 h-36 resize-none"
            required
          />
        </div>

        <div className="text-center pt-2">
          <button type="submit" className="btn-primary text-base px-10 py-3">
            Enviar mensaje
          </button>
        </div>
      </form>
    </section>
  );
}
