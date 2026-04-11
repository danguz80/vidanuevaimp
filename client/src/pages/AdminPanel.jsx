import React, { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import AdminNav from "../components/AdminNav";

const ROLES_FULL       = ["admin", "Pastor", "Obispo"];
const ROLES_SECRETARIO = ["Secretario"];
const ROLES_TESORERO   = ["Tesorero"];

export default function AdminPanel() {
  const { user, roles } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (roles.length === 0) return; // esperar a que carguen los roles
    const esFull = roles.some(r => ROLES_FULL.includes(r));
    if (esFull) return; // acceso total, se queda en el panel
    // Roles restringidos: redirigir a su sección
    if (roles.some(r => ROLES_TESORERO.includes(r))) {
      navigate("/admin/tesoreria", { replace: true });
    } else if (roles.some(r => ROLES_SECRETARIO.includes(r))) {
      navigate("/admin/secretaria", { replace: true });
    }
  }, [roles]); // eslint-disable-line

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
