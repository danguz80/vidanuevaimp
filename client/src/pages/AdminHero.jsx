// 1. Instala react-hot-toast si no lo tienes:
// npm install react-hot-toast

import React, { useEffect, useState } from "react";
import toast, { Toaster } from "react-hot-toast";

export default function AdminHero() {
  const [slides, setSlides] = useState([]);
  const [newSlide, setNewSlide] = useState({
    image_url: "",
    title: "",
    subtitle: "",
    title_effect: "fade-right",
    subtitle_effect: "fade-left",
    text_position: "center",
  });

  const backendUrl = import.meta.env.VITE_BACKEND_URL;

  const fetchSlides = async () => {
    try {
      const res = await fetch(`${backendUrl}/api/hero`);
      const data = await res.json();
      setSlides(data);
    } catch (error) {
      console.error("Error al obtener slides:", error);
    }
  };

  const handleAddSlide = async () => {
    if (!newSlide.image_url.trim()) {
      toast.error("Por favor ingresa la URL de la imagen.");
      return;
    }

    try {
      await fetch(`${backendUrl}/api/hero`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(newSlide),
      });

      setNewSlide({
        image_url: "",
        title: "",
        subtitle: "",
        title_effect: "fade-right",
        subtitle_effect: "fade-left",
        text_position: "center",
      });

      toast.success("Slide agregado exitosamente");
      fetchSlides();
    } catch (error) {
      toast.error("Error al agregar slide");
      console.error("Error al agregar slide:", error);
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm("¿Estás seguro de eliminar este slide?")) return;
    try {
      await fetch(`${backendUrl}/api/hero/${id}`, { method: "DELETE" });
      toast.success("Slide eliminado");
      fetchSlides();
    } catch (error) {
      toast.error("Error al eliminar");
      console.error("Error al eliminar slide:", error);
    }
  };

  const handleToggle = async (id, active) => {
    try {
      await fetch(`${backendUrl}/api/hero/${id}/toggle`, { method: "PATCH" });
      toast.success(active ? "Slide desactivado" : "Slide activado");
      fetchSlides();
    } catch (error) {
      toast.error("Error al cambiar estado");
      console.error("Error al cambiar estado:", error);
    }
  };

  const handleUpdate = async (slide) => {
    try {
      await fetch(`${backendUrl}/api/hero/${slide.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(slide),
      });
      toast.success("Cambios guardados");
      fetchSlides();
    } catch (error) {
      toast.error("Error al guardar cambios");
      console.error("Error al guardar cambios:", error);
    }
  };

  useEffect(() => {
    fetchSlides();
  }, []);

  return (
    <div className="p-8 max-w-4xl mx-auto">
      <Toaster />
      <h1 className="text-2xl font-bold mb-6 text-center">Administrar Hero</h1>

      {/* Aquí continuarías con el formulario de nuevo slide y lista de slides como ya lo tienes */}
    </div>
  );
}
