import React, { useState } from "react";
import { Copy, CheckCircle2 } from "lucide-react";

export default function Donacion() {
  const [copiedField, setCopiedField] = useState("");

  const copyToClipboard = (text, field) => {
    navigator.clipboard.writeText(text);
    setCopiedField(field);
    setTimeout(() => setCopiedField(""), 2000);
  };

  return (
    <div className="bg-gradient-to-b from-blue-50 to-white py-16 px-4">
      <div className="max-w-4xl mx-auto">
        {/* Encabezado */}
        <div className="text-center mb-12">
          <h1 className="text-4xl md:text-5xl font-bold text-gray-800 mb-4">
            Apoya Nuestro Ministerio
          </h1>
          <p className="text-lg text-gray-600 max-w-2xl mx-auto">
            Tus ofrendas y diezmos nos permiten seguir llevando el mensaje de esperanza y amor de Jesús.
            ¡Gracias por sembrar en el Reino de Dios!
          </p>
        </div>

        {/* Versículo */}
        <div className="bg-blue-600 text-white rounded-lg p-6 mb-12 text-center">
          <p className="text-lg italic mb-2">
            "Cada uno dé como propuso en su corazón: no con tristeza, ni por necesidad,
            porque Dios ama al dador alegre."
          </p>
          <p className="text-sm font-semibold">2 Corintios 9:7</p>
        </div>

        {/* Métodos de Donación */}
        <div className="grid md:grid-cols-2 gap-8 mb-12">
          {/* Transferencia Bancaria */}
          <div className="bg-white rounded-lg shadow-lg p-6 border-t-4 border-blue-600">
            <h3 className="text-2xl font-bold text-gray-800 mb-4">
              Transferencia Bancaria
            </h3>
            
            {/* ⚠️ IMPORTANTE: Actualiza estos datos con la información bancaria real de la iglesia */}
            <div className="space-y-4">
              <div>
                <label className="text-sm font-semibold text-gray-600">Banco</label>
                <div className="flex items-center justify-between bg-gray-50 p-3 rounded mt-1">
                  <span className="text-gray-800">Banco de Chile</span>
                </div>
              </div>
              
              <div>
                <label className="text-sm font-semibold text-gray-600">Tipo de Cuenta</label>
                <div className="flex items-center justify-between bg-gray-50 p-3 rounded mt-1">
                  <span className="text-gray-800">Cuenta Corriente</span>
                </div>
              </div>

              <div>
                <label className="text-sm font-semibold text-gray-600">Número de Cuenta</label>
                <div className="flex items-center justify-between bg-gray-50 p-3 rounded mt-1">
                  <span className="text-gray-800 font-mono">00000000000</span>
                  <button
                    onClick={() => copyToClipboard("00000000000", "cuenta")}
                    className="text-blue-600 hover:text-blue-700 transition"
                    title="Copiar número de cuenta"
                  >
                    {copiedField === "cuenta" ? (
                      <CheckCircle2 size={20} />
                    ) : (
                      <Copy size={20} />
                    )}
                  </button>
                </div>
              </div>

              <div>
                <label className="text-sm font-semibold text-gray-600">RUT</label>
                <div className="flex items-center justify-between bg-gray-50 p-3 rounded mt-1">
                  <span className="text-gray-800 font-mono">00.000.000-0</span>
                  <button
                    onClick={() => copyToClipboard("00.000.000-0", "rut")}
                    className="text-blue-600 hover:text-blue-700 transition"
                    title="Copiar RUT"
                  >
                    {copiedField === "rut" ? (
                      <CheckCircle2 size={20} />
                    ) : (
                      <Copy size={20} />
                    )}
                  </button>
                </div>
              </div>

              <div>
                <label className="text-sm font-semibold text-gray-600">Titular</label>
                <div className="flex items-center justify-between bg-gray-50 p-3 rounded mt-1">
                  <span className="text-gray-800">Iglesia Vida Nueva</span>
                </div>
              </div>

              <div>
                <label className="text-sm font-semibold text-gray-600">Email</label>
                <div className="flex items-center justify-between bg-gray-50 p-3 rounded mt-1">
                  <span className="text-gray-800">contacto@vidanuevaimp.com</span>
                  <button
                    onClick={() => copyToClipboard("contacto@vidanuevaimp.com", "email")}
                    className="text-blue-600 hover:text-blue-700 transition"
                    title="Copiar email"
                  >
                    {copiedField === "email" ? (
                      <CheckCircle2 size={20} />
                    ) : (
                      <Copy size={20} />
                    )}
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* Otras Formas de Donar */}
          <div className="space-y-8">
            {/* PayPal o Mercado Pago */}
            <div className="bg-white rounded-lg shadow-lg p-6 border-t-4 border-green-600">
              <h3 className="text-2xl font-bold text-gray-800 mb-4">
                Donación en Línea
              </h3>
              <p className="text-gray-600 mb-4">
                Próximamente podrás donar de forma segura a través de plataformas de pago en línea.
              </p>
              <div className="text-center text-gray-400">
                <p className="text-sm">En desarrollo</p>
              </div>
            </div>

            {/* En Persona */}
            <div className="bg-white rounded-lg shadow-lg p-6 border-t-4 border-purple-600">
              <h3 className="text-2xl font-bold text-gray-800 mb-4">
                Ofrenda Presencial
              </h3>
              <p className="text-gray-600 mb-4">
                También puedes entregar tu ofrenda directamente durante nuestros servicios:
              </p>
              <ul className="space-y-2 text-gray-700">
                <li>📍 Domingos 11:00 AM</li>
                <li>📍 Miércoles 7:00 PM</li>
              </ul>
            </div>
          </div>
        </div>

        {/* Nota de Agradecimiento */}
        <div className="bg-amber-50 border-l-4 border-amber-500 p-6 rounded">
          <h4 className="text-xl font-bold text-gray-800 mb-2">
            ¡Gracias por tu generosidad!
          </h4>
          <p className="text-gray-700">
            Cada donación es una bendición que nos permite continuar con nuestra misión de 
            predicar el evangelio, apoyar a la comunidad y llevar esperanza a quienes más lo necesitan. 
            Dios te bendiga abundantemente.
          </p>
        </div>

        {/* Información Adicional */}
        <div className="mt-8 text-center text-sm text-gray-600">
          <p>
            Si tienes alguna pregunta sobre las donaciones, contáctanos en{" "}
            <a href="mailto:contacto@vidanuevaimp.com" className="text-blue-600 hover:underline">
              contacto@vidanuevaimp.com
            </a>
          </p>
        </div>
      </div>
    </div>
  );
}
