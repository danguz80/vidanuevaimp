import React, { useEffect, useState } from "react";

export default function AdminHero() {
    const [slides, setSlides] = useState([]);
    const [newSlide, setNewSlide] = useState({
        image_url: "",
        title: "",
        subtitle: "",
        title_effect: "fade-right",
        subtitle_effect: "fade-left",
        text_position: "center",
        title_font_size: "text-2xl",
        subtitle_font_size: "text-xl",
        title_color: "#ffffff",
        subtitle_color: "#ffffff",
        slide_duration: 5,
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
            alert("Por favor ingresa la URL de la imagen.");
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
                title_font_size: "text-2xl",
                subtitle_font_size: "text-xl",
                title_color: "#ffffff",
                subtitle_color: "#ffffff",
                slide_duration: 5,
            });

            fetchSlides();
            alert("Slide agregado exitosamente");
        } catch (error) {
            console.error("Error al agregar slide:", error);
        }
    };

    const handleDelete = async (id) => {
        if (!window.confirm("¿Estás seguro de eliminar este slide?")) return;
        try {
            await fetch(`${backendUrl}/api/hero/${id}`, { method: "DELETE" });
            fetchSlides();
            alert("Slide eliminado correctamente");
        } catch (error) {
            console.error("Error al eliminar slide:", error);
        }
    };

    const handleUpdate = async (slide) => {
        try {
            await fetch(`${backendUrl}/api/hero/${slide.id}`, {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    title: slide.title,
                    subtitle: slide.subtitle,
                    title_effect: slide.title_effect,
                    subtitle_effect: slide.subtitle_effect,
                    font_size_title: slide.font_size_title,
                    font_size_subtitle: slide.font_size_subtitle,
                    color_title: slide.color_title,
                    color_subtitle: slide.color_subtitle,
                    slide_duration: slide.slide_duration,
                }),
            });
            fetchSlides();
            alert("Cambios guardados correctamente");
        } catch (error) {
            console.error("Error al guardar cambios:", error);
        }
    };

    useEffect(() => {
        fetchSlides();
    }, []);

    return (
        <div className="p-8 max-w-4xl mx-auto">
            <h1 className="text-2xl font-bold mb-6 text-center">Administrar Hero</h1>

            {/* Formulario nuevo slide */}
            <div className="mb-8">
                <input
                    type="text"
                    placeholder="URL de la imagen"
                    value={newSlide.image_url}
                    onChange={(e) => setNewSlide({ ...newSlide, image_url: e.target.value })}
                    className="w-full mb-2 p-2 border rounded"
                />
                <input
                    type="text"
                    placeholder="Título"
                    value={newSlide.title}
                    onChange={(e) => setNewSlide({ ...newSlide, title: e.target.value })}
                    className="w-full mb-2 p-2 border rounded"
                />
                <input
                    type="text"
                    placeholder="Subtítulo"
                    value={newSlide.subtitle}
                    onChange={(e) => setNewSlide({ ...newSlide, subtitle: e.target.value })}
                    className="w-full mb-2 p-2 border rounded"
                />

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
                    <div>
                        <label className="block text-sm font-semibold mb-1">Efecto del Título</label>
                        <select
                            className="w-full p-2 border rounded"
                            value={newSlide.title_effect}
                            onChange={(e) => setNewSlide({ ...newSlide, title_effect: e.target.value })}
                        >
                            <option value="fade-right">Desde la derecha</option>
                            <option value="fade-left">Desde la izquierda</option>
                            <option value="fade-up">Desde abajo</option>
                            <option value="fade-down">Desde arriba</option>
                        </select>
                    </div>

                    <div>
                        <label className="block text-sm font-semibold mb-1">Efecto del Subtítulo</label>
                        <select
                            className="w-full p-2 border rounded"
                            value={newSlide.subtitle_effect}
                            onChange={(e) => setNewSlide({ ...newSlide, subtitle_effect: e.target.value })}
                        >
                            <option value="fade-left">Desde la izquierda</option>
                            <option value="fade-right">Desde la derecha</option>
                            <option value="fade-up">Desde abajo</option>
                            <option value="fade-down">Desde arriba</option>
                        </select>
                    </div>

                    <div>
                        <label className="block text-sm font-semibold mb-1">Posición del Texto</label>
                        <select
                            className="w-full p-2 border rounded"
                            value={newSlide.text_position}
                            onChange={(e) => setNewSlide({ ...newSlide, text_position: e.target.value })}
                        >
                            <option value="center">Centro</option>
                            <option value="top">Arriba</option>
                            <option value="bottom">Abajo</option>
                            <option value="left">Izquierda</option>
                            <option value="right">Derecha</option>
                        </select>
                    </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
                    <div>
                        <label className="block text-sm font-semibold mb-1">Tamaño fuente título</label>
                        <select
                            className="w-full p-2 border rounded"
                            value={newSlide.title_font_size}
                            onChange={(e) => setNewSlide({ ...newSlide, title_font_size: e.target.value })}
                        >
                            <option value="text-lg">Pequeña</option>
                            <option value="text-2xl">Mediana</option>
                            <option value="text-4xl">Grande</option>
                            <option value="text-6xl">Extra grande</option>
                        </select>
                    </div>
                    <div>
                        <label className="block text-sm font-semibold mb-1">Tamaño fuente subtítulo</label>
                        <select
                            className="w-full p-2 border rounded"
                            value={newSlide.subtitle_font_size}
                            onChange={(e) => setNewSlide({ ...newSlide, subtitle_font_size: e.target.value })}
                        >
                            <option value="text-md">Pequeña</option>
                            <option value="text-lg">Mediana</option>
                            <option value="text-xl">Grande</option>
                        </select>
                    </div>
                    <div>
                        <label className="block text-sm font-semibold mb-1">Duración entre slides (segundos)</label>
                        <input
                            type="number"
                            className="w-full p-2 border rounded"
                            min="1"
                            value={newSlide.slide_duration}
                            onChange={(e) => setNewSlide({ ...newSlide, slide_duration: e.target.value })}
                        />
                    </div>
                    <div>
                        <label className="block text-sm font-semibold mb-1">Color del Título</label>
                        <input
                            type="color"
                            className="w-full h-10"
                            value={newSlide.title_color}
                            onChange={(e) => setNewSlide({ ...newSlide, title_color: e.target.value })}
                        />
                    </div>
                    <div>
                        <label className="block text-sm font-semibold mb-1">Color del Subtítulo</label>
                        <input
                            type="color"
                            className="w-full h-10"
                            value={newSlide.subtitle_color}
                            onChange={(e) => setNewSlide({ ...newSlide, subtitle_color: e.target.value })}
                        />
                    </div>
                </div>

                <button
                    onClick={handleAddSlide}
                    className="bg-green-600 text-white px-4 py-2 rounded hover:bg-green-700"
                >
                    Agregar Slide
                </button>
            </div>

            {/* Lista de slides */}
            <ul className="space-y-4">
                {slides.map((slide) => (
                    <li key={slide.id} className="border p-4 rounded">
                        <div className="flex flex-col md:flex-row justify-between items-start gap-4">
                            <div className="flex-1">
                                <input
                                    type="text"
                                    value={slide.title}
                                    onChange={(e) =>
                                        setSlides((prev) =>
                                            prev.map((s) =>
                                                s.id === slide.id ? { ...s, title: e.target.value } : s
                                            )
                                        )
                                    }
                                    className="w-full mb-1 p-1 border rounded"
                                />
                                <input
                                    type="text"
                                    value={slide.subtitle}
                                    onChange={(e) =>
                                        setSlides((prev) =>
                                            prev.map((s) =>
                                                s.id === slide.id ? { ...s, subtitle: e.target.value } : s
                                            )
                                        )
                                    }
                                    className="w-full mb-2 p-1 border rounded"
                                />
                                <img src={slide.image_url} alt="" className="w-32 h-auto rounded shadow" />

                                <div className="grid grid-cols-1 md:grid-cols-2 gap-2 mt-2">
                                    <label>Tamaño fuente título</label>
                                    <select
                                        value={slide.font_size_title || "text-xl"}
                                        onChange={(e) =>
                                            setSlides((prev) =>
                                                prev.map((s) =>
                                                    s.id === slide.id ? { ...s, font_size_title: e.target.value } : s
                                                )
                                            )
                                        }
                                        className="p-1 border rounded"
                                    >
                                        <option value="text-lg">Pequeña</option>
                                        <option value="text-xl">Mediana</option>
                                        <option value="text-2xl">Grande</option>
                                        <option value="text-4xl">Extra grande</option>
                                    </select>

                                    <label>Tamaño fuente subtítulo</label>
                                    <select
                                        value={slide.font_size_subtitle || "text-md"}
                                        onChange={(e) =>
                                            setSlides((prev) =>
                                                prev.map((s) =>
                                                    s.id === slide.id ? { ...s, font_size_subtitle: e.target.value } : s
                                                )
                                            )
                                        }
                                        className="p-1 border rounded"
                                    >
                                        <option value="text-md">Pequeña</option>
                                        <option value="text-lg">Mediana</option>
                                        <option value="text-xl">Grande</option>
                                    </select>

                                    <label>Color título</label>
                                    <input
                                        type="color"
                                        value={slide.color_title || "#000000"}
                                        onChange={(e) =>
                                            setSlides((prev) =>
                                                prev.map((s) =>
                                                    s.id === slide.id ? { ...s, color_title: e.target.value } : s
                                                )
                                            )
                                        }
                                        className="p-1 border rounded"
                                    />

                                    <label>Color subtítulo</label>
                                    <input
                                        type="color"
                                        value={slide.color_subtitle || "#000000"}
                                        onChange={(e) =>
                                            setSlides((prev) =>
                                                prev.map((s) =>
                                                    s.id === slide.id ? { ...s, color_subtitle: e.target.value } : s
                                                )
                                            )
                                        }
                                        className="p-1 border rounded"
                                    />

                                    <label>Duración (segundos)</label>
                                    <input
                                        type="number"
                                        value={slide.slide_duration || ""}
                                        onChange={(e) =>
                                            setSlides((prev) =>
                                                prev.map((s) =>
                                                    s.id === slide.id ? { ...s, slide_duration: e.target.value } : s
                                                )
                                            )
                                        }
                                        className="p-1 border rounded"
                                    />
                                </div>
                            </div>

                            <div className="flex flex-col gap-2">
                                <button
                                    onClick={() => handleUpdate(slide)}
                                    className="bg-yellow-500 text-white px-3 py-1 rounded hover:bg-yellow-600"
                                >
                                    Guardar cambios
                                </button>

                                <button
                                    onClick={() => handleDelete(slide.id)}
                                    className="bg-red-600 text-white px-3 py-1 rounded hover:bg-red-700"
                                >
                                    Eliminar
                                </button>
                            </div>
                        </div>
                    </li>
                ))}
            </ul>
        </div>
    );
}
