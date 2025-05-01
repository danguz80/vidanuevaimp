import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";

const backendUrl = import.meta.env.VITE_BACKEND_URL;

export default function AdminMensajes() {
  const [mensajes, setMensajes] = useState([]);
  const navigate = useNavigate();

  useEffect(() => {
    const fetchMensajes = async () => {
      try {
        const res = await fetch(`${backendUrl}/api/contacto`);
        const data = await res.json();
        setMensajes(data);
      } catch (error) {
        console.error("Error al obtener mensajes:", error);
      }
    };

    fetchMensajes();
  }, []);

  const handleRespondidoToggle = async (id, nuevoEstado) => {
    try {
      await fetch(`${backendUrl}/api/mensajes/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ respondido: nuevoEstado }),
      });
      setMensajes((prev) =>
        prev.map((msg) =>
          msg.id === id ? { ...msg, respondido: nuevoEstado } : msg
        )
      );
    } catch (error) {
      console.error("Error al marcar como respondido:", error);
    }
  };

  const handleEliminar = async (id) => {
    if (!confirm("¿Estás seguro de que quieres eliminar este mensaje?")) return;
    try {
      await fetch(`${backendUrl}/api/mensajes/${id}`, { method: "DELETE" });
      setMensajes((prev) => prev.filter((msg) => msg.id !== id));
    } catch (error) {
      console.error("Error al eliminar mensaje:", error);
    }
  };

  const formatearFecha = (fechaIso) => {
    return new Date(fechaIso).toLocaleString("es-CL");
  };

  return (
    <div className="p-6">
      <h2 className="text-2xl font-bold text-center mb-4">Mensajes Recibidos</h2>

      <div className="flex justify-center mb-6">
        <button
          onClick={() => navigate("/admin")}
          className="bg-gray-700 text-white px-6 py-2 rounded hover:bg-gray-800 transition"
        >
          Volver al Panel de Administración
        </button>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full table-auto border-collapse text-left">
          <thead>
            <tr className="bg-gray-200">
              <th className="px-4 py-2">Fecha</th>
              <th className="px-4 py-2">Nombre</th>
              <th className="px-4 py-2">Correo</th>
              <th className="px-4 py-2">Mensaje</th>
              <th className="px-4 py-2 text-center">¿Respondido?</th>
              <th className="px-4 py-2 text-center">Eliminar</th>
            </tr>
          </thead>
          <tbody>
            {mensajes.map((msg) => (
              <tr key={msg.id} className="border-t">
                <td className="px-4 py-2 whitespace-nowrap">{formatearFecha(msg.fecha)}</td>
                <td className="px-4 py-2 whitespace-nowrap">{msg.nombre}</td>
                <td className="px-4 py-2 whitespace-nowrap">{msg.correo}</td>
                <td className="px-4 py-2">{msg.mensaje}</td>
                <td className="px-4 py-2 text-center">
                  <input
                    type="checkbox"
                    checked={msg.respondido}
                    onChange={(e) =>
                      handleRespondidoToggle(msg.id, e.target.checked)
                    }
                  />
                </td>
                <td className="px-4 py-2 text-center">
                  <button
                    onClick={() => handleEliminar(msg.id)}
                    className="bg-red-600 text-white px-3 py-1 rounded hover:bg-red-700"
                  >
                    Eliminar
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
