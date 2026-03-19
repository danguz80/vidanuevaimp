import React from "react";
import { useAuth } from "../context/AuthContext";
import AdminNav from "../components/AdminNav";

export default function AdminPanel() {
  const { user } = useAuth();

  return (
    <>
      <AdminNav />
      <div className="p-8 max-w-4xl mx-auto text-center">
        <h1 className="text-3xl font-bold mb-3">Panel de Administración</h1>
        <p className="text-gray-600">
          Bienvenido, <strong>{user?.username}</strong>. Selecciona una sección en la barra de arriba.
        </p>
      </div>
    </>
  );
}
