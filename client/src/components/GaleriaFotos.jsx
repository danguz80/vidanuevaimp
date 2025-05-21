import { useEffect, useState } from 'react';
import axios from 'axios';

export default function GaleriaFotos() {
    const [fotos, setFotos] = useState([]);
    const [pagina, setPagina] = useState(1);
    const [totalPaginas, setTotalPaginas] = useState(1);
    const [años, setAños] = useState([]);
    const [añoSeleccionado, setAñoSeleccionado] = useState('');

    useEffect(() => {
        const fetchIndex = async () => {
            const { data } = await axios.get('/api/galeria/index');
            setTotalPaginas(data.totalPaginas);
            setAños(data.anios); // ✅ corregido
        };
        fetchIndex();
    }, []);

    useEffect(() => {
        const fetchFotos = async () => {
            const params = { pagina };
            if (añoSeleccionado) params.anio = añoSeleccionado; // ✅ debe ser `anio` (sin tilde)
            const { data } = await axios.get('/api/galeria', { params });
            const fotosCargadas = Array.isArray(data.fotos) ? data.fotos : data?.fotos ?? data;
            setFotos(Array.isArray(fotosCargadas) ? fotosCargadas : []);
            console.log("📸 data.fotos:", data.fotos);
        };
        fetchFotos();
    }, [pagina, añoSeleccionado]);

    const agruparPorAnio = (Array.isArray(fotos) ? fotos : []).reduce((acc, foto) => {
        const anio = foto.fecha_toma?.substring(0, 4) || 'Sin fecha'; // ✅ corregido
        if (!acc[anio]) acc[anio] = [];
        acc[anio].push(foto);
        return acc;
    }, {});

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

            {Object.entries(agruparPorAnio).sort((a, b) => b[0] - a[0]).map(([anio, imagenes]) => (
                <div key={anio} className="mb-6">
                    <h2 className="text-xl font-bold mb-2">{anio}</h2>
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
