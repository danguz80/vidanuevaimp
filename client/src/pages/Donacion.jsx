import React, { useState, useEffect, useRef } from "react";
import { Heart, Gift, Church, Users, Book, Lightbulb } from "lucide-react";

export default function DonacionPage() {
  const [amount, setAmount] = useState(null);
  const [customAmount, setCustomAmount] = useState("");
  const [showPayPalButtons, setShowPayPalButtons] = useState(false);
  const paypalRef = useRef();
  
  // Montos predefinidos en pesos chilenos
  const predefinedAmounts = [5000, 10000, 20000, 50000, 100000, 200000];

  useEffect(() => {
    // Cargar el SDK de PayPal con CLP (pesos chilenos)
    const script = document.createElement("script");
    script.src = "https://www.paypal.com/sdk/js?client-id=ARh2dyL9_bTmMf9WoDZG4bkOr_zEBhyJFcuk5h1ollXIESmwTWKb3mhFoxHTkblwMMTTOuh8zWrWfSMP&currency=CLP&locale=es_CL";
    script.async = true;
    
    script.onload = () => {
      setShowPayPalButtons(true);
    };
    
    document.body.appendChild(script);

    return () => {
      if (document.body.contains(script)) {
        document.body.removeChild(script);
      }
    };
  }, []);

  useEffect(() => {
    const finalAmount = customAmount || amount;
    
    if (showPayPalButtons && window.paypal && finalAmount && finalAmount > 0) {
      // Limpiar botones anteriores
      if (paypalRef.current) {
        paypalRef.current.innerHTML = '';
      }

      window.paypal.Buttons({
        style: {
          layout: 'vertical',
          color: 'blue',
          shape: 'rect',
          label: 'donate'
        },
        createOrder: (data, actions) => {
          return actions.order.create({
            purchase_units: [{
              amount: {
                currency_code: 'CLP',
                value: finalAmount.toString()
              },
              description: 'Donación - Iglesia Misión Pentecostés Templo Vida Nueva'
            }]
          });
        },
        onApprove: async (data, actions) => {
          const order = await actions.order.capture();
          alert('¡Gracias por tu donación! Que Dios te bendiga abundantemente.');
          console.log('Donación completada:', order);
        },
        onError: (err) => {
          console.error('Error en PayPal:', err);
          alert('Hubo un error al procesar la donación. Por favor intenta nuevamente.');
        }
      }).render(paypalRef.current);
    }
  }, [showPayPalButtons, amount, customAmount]);

  const handlePayPalMe = () => {
    // Opción alternativa con PayPal.me (requiere cuenta)
    window.open('https://www.paypal.com/paypalme/imptvn', '_blank');
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-blue-50 to-white">
      {/* Hero Section */}
      <section className="bg-blue-600 text-white py-16 px-4">
        <div className="max-w-4xl mx-auto text-center">
          <h1 className="text-4xl md:text-5xl font-bold mb-4">
            Apoya Nuestro Ministerio
          </h1>
          <p className="text-xl mb-2">Iglesia Misión Pentecostés Templo Vida Nueva</p>
          <p className="text-blue-100 italic">
            "Cada uno dé como propuso en su corazón: no con tristeza, ni por necesidad, porque Dios ama al dador alegre" - 2 Corintios 9:7
          </p>
        </div>
      </section>

      <div className="max-w-6xl mx-auto px-4 py-12">
        <div className="grid md:grid-cols-2 gap-8 mb-12">
          {/* Información sobre donaciones */}
          <div className="bg-white rounded-lg shadow-lg p-8">
            <h2 className="text-2xl font-bold text-gray-800 mb-6 flex items-center gap-2">
              <Heart className="text-red-500" />
              ¿Por qué donar?
            </h2>
            <div className="space-y-4">
              <div className="flex gap-3">
                <Church className="text-blue-600 flex-shrink-0 mt-1" size={24} />
                <div>
                  <h3 className="font-semibold text-gray-800">Mantenimiento del Templo</h3>
                  <p className="text-gray-600 text-sm">Cuidamos la casa de Dios para que sea un lugar acogedor para todos</p>
                </div>
              </div>
              <div className="flex gap-3">
                <Users className="text-blue-600 flex-shrink-0 mt-1" size={24} />
                <div>
                  <h3 className="font-semibold text-gray-800">Programas Comunitarios</h3>
                  <p className="text-gray-600 text-sm">Ayudamos a familias necesitadas y organizamos actividades para la comunidad</p>
                </div>
              </div>
              <div className="flex gap-3">
                <Book className="text-blue-600 flex-shrink-0 mt-1" size={24} />
                <div>
                  <h3 className="font-semibold text-gray-800">Enseñanza y Discipulado</h3>
                  <p className="text-gray-600 text-sm">Materiales, estudios bíblicos y recursos para el crecimiento espiritual</p>
                </div>
              </div>
              <div className="flex gap-3">
                <Lightbulb className="text-blue-600 flex-shrink-0 mt-1" size={24} />
                <div>
                  <h3 className="font-semibold text-gray-800">Evangelismo y Misiones</h3>
                  <p className="text-gray-600 text-sm">Llevamos el mensaje de Cristo a nuevos lugares y comunidades</p>
                </div>
              </div>
            </div>
          </div>

          {/* Formulario de donación */}
          <div className="bg-white rounded-lg shadow-lg p-8">
            <h2 className="text-2xl font-bold text-gray-800 mb-6 flex items-center gap-2">
              <Gift className="text-green-500" />
              Realizar Donación
            </h2>

            <div className="mb-6">
              <label className="block text-sm font-semibold text-gray-700 mb-3">
                Selecciona un monto (CLP):
              </label>
              <div className="grid grid-cols-3 gap-3 mb-4">
                {predefinedAmounts.map((amt) => (
                  <button
                    key={amt}
                    onClick={() => {
                      setAmount(amt);
                      setCustomAmount("");
                    }}
                    className={`py-3 px-4 rounded-lg font-semibold transition ${
                      amount === amt
                        ? "bg-blue-600 text-white"
                        : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                    }`}
                  >
                    ${amt.toLocaleString('es-CL')}
                  </button>
                ))}
              </div>

              <div className="relative">
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  O ingresa otro monto:
                </label>
                <div className="relative">
                  <span className="absolute left-3 top-3 text-gray-500 font-semibold">$</span>
                  <input
                    type="number"
                    value={customAmount}
                    onChange={(e) => {
                      setCustomAmount(e.target.value);
                      setAmount(null);
                    }}
                    placeholder="0"
                    className="w-full pl-8 pr-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    min="1000"
                    step="1000"
                  />
                </div>
              </div>
            </div>

            {/* Botones de PayPal */}
            {(amount || customAmount) && (
              <div className="mb-4">
                <div ref={paypalRef} className="min-h-[150px]"></div>
              </div>
            )}

            {!amount && !customAmount && (
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 text-center text-blue-700 mb-4">
                Selecciona o ingresa un monto para ver las opciones de pago
              </div>
            )}

            <div className="text-center text-sm text-gray-500 mb-4">
              ✓ No necesitas cuenta de PayPal para donar<br />
              ✓ Tu donación es segura y encriptada
            </div>

            {/* Opción alternativa con PayPal.me */}
            <div className="pt-4 border-t border-gray-200">
              <button
                onClick={handlePayPalMe}
                className="w-full bg-gray-100 hover:bg-gray-200 text-gray-700 font-semibold py-3 px-6 rounded-lg transition"
              >
                O dona cualquier monto con PayPal.me
              </button>
            </div>

            {/* Información de PayPal directo */}
            <div className="mt-6 pt-6 border-t border-gray-200">
              <p className="text-sm text-gray-600 mb-2 text-center">O envía directamente a nuestra cuenta PayPal:</p>
              <p className="text-center font-semibold text-gray-800 bg-gray-50 py-2 px-4 rounded">
                vidanuevaimp@gmail.com
              </p>
              <p className="text-xs text-center text-gray-500 mt-2">
                paypal.me/imptvn
              </p>
            </div>
          </div>
        </div>

        {/* Versículos adicionales */}
        <div className="bg-blue-50 rounded-lg p-8 text-center">
          <h3 className="text-xl font-bold text-gray-800 mb-4">La Bendición de Dar</h3>
          <div className="grid md:grid-cols-2 gap-6 max-w-4xl mx-auto">
            <div className="bg-white p-4 rounded-lg shadow">
              <p className="text-gray-700 italic">
                "Dad, y se os dará; medida buena, apretada, remecida y rebosando darán en vuestro regazo"
              </p>
              <p className="text-sm text-gray-500 mt-2">Lucas 6:38</p>
            </div>
            <div className="bg-white p-4 rounded-lg shadow">
              <p className="text-gray-700 italic">
                "Honra a Jehová con tus bienes, y con las primicias de todos tus frutos"
              </p>
              <p className="text-sm text-gray-500 mt-2">Proverbios 3:9</p>
            </div>
          </div>
        </div>

        {/* Contacto */}
        <div className="text-center mt-12 text-gray-600">
          <p className="mb-2">¿Preguntas sobre donaciones?</p>
          <p className="font-semibold">Contáctanos: vidanuevaimp@gmail.com</p>
        </div>
      </div>
    </div>
  );
}
