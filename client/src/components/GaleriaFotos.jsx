import { useEffect, useState } from 'react';
import axios from 'axios';

export default function GaleriaFotos() {
    const [fotos, setFotos] = useState([]);
    const [pagina, setPagina] = useState(1);
    const [totalPaginas, setTotalPaginas] = useState(1);
    const [años, setAños] = useState([]);
    const [añoSeleccionado, setAñoSeleccionado] = useState('');
    const [error, setError] = useState('');

    useEffect(() => {
        const fetchIndex = async () => {
            try {
                const { data } = await axios.get("https://iglesia-backend.onrender.com/api/galeria/index");
                setTotalPaginas(data.totalPaginas || 1);
                setAños(data.anios || []);
            } catch (err) {
                console.error("❌ Error al obtener índice:", err);
                setError("No se pudo cargar el índice de fotos.");
            }
        };
        fetchIndex();
    }, []);

    useEffect(() => {
        const fetchFotos = async () => {
            try {
                const params = { pagina };
                if (añoSeleccionado) params.anio = añoSeleccionado;

                const { data } = await axios.get("https://iglesia-backend.onrender.com/api/galeria", { params });

                if (Array.isArray(data.fotos)) {
                    setFotos(data.fotos);
                    setError('');
                } else {
                    console.warn("⚠️ La respuesta no contiene un array de fotos:", data);
                    setFotos([]);
                    setError("No se encontraron fotos para esta página.");
                }
            } catch (err) {
                console.error("❌ Error al obtener fotos:", err);
                setFotos([]);
                setError("No se pudo cargar la galería de fotos.");
            }
        };
        fetchFotos();
    }, [pagina, añoSeleccionado]);
    console.log("🧪 Año extraído:", foto.context?.custom?.fecha_toma?.substring(0, 4));

    const agrupadas = fotos.reduce((acc, foto) => {
        const anio = foto.context?.custom?.fecha_toma?.substring(0, 4) || 'Sin fecha';
        if (!acc[anio]) acc[anio] = [];
        acc[anio].push(foto);
        return acc;
    }, {});

    const formatearAnio = (a) => {
        if (a === 'sin_fecha') return 'Sin fecha';
        return a;
    };

    return (
        <div className="p-4">
            <div className="mb-4 flex items-center gap-4">
                <label>Año:</label>
                <select
                    value={añoSeleccionado}
                    onChange={(e) => {
                        setPagina(1);
                        setAñoSeleccionado(e.target.value);
                    }}
                    className="border p-1 rounded"
                >
                    <option value="">Todos</option>
                    {años.map((a) => (
                        <option key={a} value={a}>{a}</option>
                    ))}
                </select>

                <label>Página:</label>
                <input
                    type="number"
                    min="1"
                    max={totalPaginas}
                    value={pagina}
                    onChange={(e) => setPagina(Number(e.target.value))}
                    className="border p-1 rounded w-16"
                />
                <span className="text-sm text-gray-600">de {totalPaginas}</span>

            </div>

            <div className="mb-4 flex gap-2">
                <button
                    disabled={pagina === 1}
                    onClick={() => setPagina(pagina - 1)}
                    className="bg-gray-200 px-3 py-1 rounded disabled:opacity-50"
                >Anterior</button>
                <button
                    disabled={pagina === totalPaginas}
                    onClick={() => setPagina(pagina + 1)}
                    className="bg-gray-200 px-3 py-1 rounded disabled:opacity-50"
                >Siguiente</button>
            </div>

            {error && (
                <div className="text-red-600 font-semibold mb-4">
                    {error}
                </div>
            )}

            {Object.entries(agrupadas).sort((a, b) => b[0] - a[0]).map(([anio, imagenes]) => (
                <div key={anio} className="mb-6">
                    <h2 className="text-xl font-bold mb-2">{formatearAnio(anio)}</h2>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                        {imagenes.map((foto, i) => (
                            <img
                                key={i}
                                src={foto.url}
                                alt={foto.titulo}
                                className="w-full h-auto rounded shadow hover:scale-105 transition-transform"
                            />
                        ))}
                    </div>
                </div>
            ))}
        </div>
    );
}
