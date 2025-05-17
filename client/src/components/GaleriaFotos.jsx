import React, { useEffect, useState } from "react";
import axios from "axios";

const agruparPorAnio = (fotos) => {
    return fotos.reduce((acc, foto) => {
        const anio = foto.fecha_toma?.substring(0, 4) || "Sin año";
        if (!acc[anio]) acc[anio] = [];
        acc[anio].push(foto);
        return acc;
    }, {});
};

const GaleriaFotos = () => {
    const [paginas, setPaginas] = useState([]); // fotos por página
    const [cursores, setCursores] = useState([null]); // cursor por página
    const [paginaActual, setPaginaActual] = useState(0);
    const [loading, setLoading] = useState(false);
    const [selectedImage, setSelectedImage] = useState(null);

    const cargarPagina = async (paginaIndex) => {
        setLoading(true);
        try {
            const cursor = cursores[paginaIndex];

            const res = await axios.get(`${import.meta.env.VITE_BACKEND_URL}/api/galeria`, {
                params: { cursor }
            });

            const nuevasPaginas = [...paginas];
            nuevasPaginas[paginaIndex] = res.data.fotos;
            setPaginas(nuevasPaginas);

            const nuevosCursores = [...cursores];
            nuevosCursores[paginaIndex + 1] = res.data.nextCursor;
            setCursores(nuevosCursores);

            setPaginaActual(paginaIndex);
        } catch (err) {
            console.error("❌ Error al cargar página:", err.message);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        if (paginas.length === 0) {
            cargarPagina(0); // cargar la primera al inicio
        }
    }, []);

    const fotos = paginas[paginaActual] || [];
    const fotosPorAnio = agruparPorAnio(fotos);

    return (
        <div className="container mx-auto px-4 py-8">
            <h1 className="text-3xl font-bold mb-6">Galería de Fotos</h1>
            {/* Buscar por página y año */}
            <div className="flex flex-col sm:flex-row items-center gap-4 mb-8">
                <div className="flex items-center gap-2">
                    <label className="text-sm font-medium">Ir a página:</label>
                    <input
                        type="number"
                        min={1}
                        max={cursores.length}
                        onKeyDown={(e) => {
                            if (e.key === "Enter") {
                                const n = parseInt(e.target.value) - 1;
                                if (n >= 0 && n < cursores.length) cargarPagina(n);
                            }
                        }}
                        className="border px-2 py-1 rounded w-24"
                        placeholder={`1-${cursores.length}`}
                    />
                </div>

                {/* Selección por año */}
                <div className="flex items-center gap-2">
                    <label className="text-sm font-medium">Ir a año:</label>
                    <select
                        className="border px-2 py-1 rounded w-36"
                        onChange={(e) => {
                            const anio = e.target.value;
                            if (!anio) return;

                            const index = paginas.findIndex((p) =>
                                p?.some((foto) => foto.fecha_toma?.startsWith(anio))
                            );

                            if (index >= 0) {
                                cargarPagina(index);
                            } else {
                                alert(`Aún no se ha cargado ninguna página con el año ${anio}`);
                            }
                        }}
                    >
                        <option value="">Selecciona un año</option>
                        {Array.from(
                            new Set(
                                paginas
                                    .flat()
                                    .map((foto) => foto.fecha_toma?.substring(0, 4))
                                    .filter((y) => y)
                            )
                        )
                            .sort((a, b) => b - a) // orden descendente
                            .map((anio) => (
                                <option key={anio} value={anio}>
                                    {anio}
                                </option>
                            ))}
                    </select>
                </div>

            </div>


            {Object.entries(fotosPorAnio).map(([anio, lista]) => (
                <div key={anio} className="mb-10">
                    <h2 className="text-2xl font-semibold mb-4">{anio}</h2>
                    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
                        {lista.map((foto, i) => (
                            <div key={i} className="cursor-pointer" onClick={() => setSelectedImage(foto.url)}>
                                <img src={foto.url} alt={foto.titulo} className="w-full h-auto rounded shadow" />
                            </div>
                        ))}
                    </div>
                </div>
            ))}

            {/* Paginación */}
            <div className="flex justify-center mt-8 gap-2">
                <button
                    onClick={() => cargarPagina(paginaActual - 1)}
                    disabled={paginaActual === 0}
                    className="px-4 py-2 bg-gray-300 rounded disabled:opacity-50"
                >
                    ← Anterior
                </button>

                {cursores.map((_, i) => (
                    <button
                        key={i}
                        onClick={() => cargarPagina(i)}
                        className={`px-4 py-2 rounded ${i === paginaActual ? "bg-blue-600 text-white" : "bg-gray-200"
                            }`}
                    >
                        {i + 1}
                    </button>
                ))}

                <button
                    onClick={() => cargarPagina(paginaActual + 1)}
                    disabled={!cursores[paginaActual + 1]}
                    className="px-4 py-2 bg-gray-300 rounded disabled:opacity-50"
                >
                    Siguiente →
                </button>
            </div>

            {/* Modal */}
            {selectedImage && (
                <div
                    className="fixed inset-0 bg-black bg-opacity-80 flex items-center justify-center z-50"
                    onClick={() => setSelectedImage(null)}
                >
                    <img src={selectedImage} alt="ampliada" className="max-w-4xl max-h-[90vh] rounded shadow-xl" />
                </div>
            )}
        </div>
    );
};

export default GaleriaFotos;
