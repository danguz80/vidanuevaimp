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
  const [fotosPorAnio, setFotosPorAnio] = useState({});

  useEffect(() => {
    const cargar = async () => {
      try {
        const res = await axios.get(`${import.meta.env.VITE_BACKEND_URL}/api/galeria`);
        const agrupadas = agruparPorAnio(res.data);
        const ordenadas = Object.keys(agrupadas)
          .sort((a, b) => a - b)
          .reduce((acc, anio) => {
            acc[anio] = agrupadas[anio];
            return acc;
          }, {});
        setFotosPorAnio(ordenadas);
      } catch (err) {
        console.error("❌ Error al cargar fotos:", err.message);
      }
    };
    cargar();
  }, []);

  return (
    <div className="container mx-auto px-4 py-8">
      <h1 className="text-3xl font-bold mb-6">Galería por año</h1>
      {Object.entries(fotosPorAnio).map(([anio, fotos]) => (
        <div key={anio} className="mb-12">
          <h2 className="text-2xl font-semibold mb-4">{anio}</h2>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
            {fotos.map((foto, i) => (
              <div key={i} className="shadow rounded overflow-hidden">
                <img src={foto.url} alt={foto.titulo} className="w-full object-cover" />
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
};

export default GaleriaFotos;
