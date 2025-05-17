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
  const [fotos, setFotos] = useState([]);
  const [nextCursor, setNextCursor] = useState(null);
  const [selectedImage, setSelectedImage] = useState(null);
  const [loading, setLoading] = useState(false);

  const cargarFotos = async () => {
    setLoading(true);
    try {
      const res = await axios.get(`${import.meta.env.VITE_BACKEND_URL}/api/galeria`, {
        params: { cursor: nextCursor }
      });
      setFotos((prev) => [...prev, ...res.data.fotos]);
      setNextCursor(res.data.nextCursor);
    } catch (err) {
      console.error("❌ Error al cargar fotos:", err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    cargarFotos();
  }, []);

  const fotosPorAnio = agruparPorAnio(fotos);

  return (
    <div className="container mx-auto px-4 py-8">
      <h1 className="text-3xl font-bold mb-6">Galería de Fotos</h1>

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

      {nextCursor && (
        <div className="text-center mt-6">
          <button
            onClick={cargarFotos}
            className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700 transition"
            disabled={loading}
          >
            {loading ? "Cargando..." : "Cargar más"}
          </button>
        </div>
      )}

      {/* Modal para imagen ampliada */}
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
