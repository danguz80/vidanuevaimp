import React from "react";
import { Link } from "react-router-dom";

export default function NotFound() {
  return (
    <div className="flex flex-col items-center justify-center min-h-[70vh] text-center px-4 animate-fade-in">
      <div className="mb-8 w-32 h-32">
        <img
          src="/logo_transparente.png"
          alt="Cruz decorativa"
          className="w-full h-full object-contain"
        />
      </div>

      <h1 className="text-5xl font-bold text-blue-600 mb-2">404</h1>
      <h2 className="text-2xl font-semibold text-gray-800 mb-2">Página no encontrada</h2>
      <p className="text-gray-600 mb-6">
        Parece que esta ruta no existe. Pero no te preocupes, puedes volver al inicio.
      </p>

      <Link
        to="/"
        className="bg-blue-600 text-white px-6 py-2 rounded hover:bg-blue-700 transition"
      >
        Volver al inicio
      </Link>
    </div>
  );
}
