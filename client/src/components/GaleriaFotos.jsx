import { useEffect, useState } from 'react';
import axios from 'axios';

const API = "https://iglesia-backend.onrender.com";

export default function GaleriaFotos() {
    const [albums, setAlbums] = useState([]);
    const [cargando, setCargando] = useState(true);
    const [error, setError] = useState('');

    useEffect(() => {
        const fetchAlbums = async () => {
            setCargando(true);
            try {
                const { data } = await axios.get(`${API}/api/galeria/albums`);
                setAlbums(data);
            } catch (err) {
                console.error('❌ Error al obtener álbumes:', err);
                setError('No se pudo cargar la galería.');
            } finally {
                setCargando(false);
            }
        };
        fetchAlbums();
    }, []);

    if (cargando) {
        return <div className="py-16 text-center text-gray-400">Cargando galería…</div>;
    }

    if (error) {
        return <div className="py-16 text-center text-red-500">{error}</div>;
    }

    if (albums.length === 0) {
        return <div className="py-16 text-center text-gray-400">No hay álbumes disponibles.</div>;
    }

    return (
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-6 p-4">
            {albums.map((a) => (
                <a
                    key={a.id}
                    href={a.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="block bg-white rounded-xl shadow-md hover:shadow-xl transition-shadow overflow-hidden border border-gray-100"
                >
                    {a.thumbnail ? (
                        <img
                            src={a.thumbnail}
                            alt={a.nombre}
                            className="w-full h-36 object-cover"
                            loading="lazy"
                        />
                    ) : (
                        <div className="bg-gradient-to-br from-blue-500 to-indigo-600 h-36 flex items-center justify-center">
                            <svg className="w-16 h-16 text-white opacity-80" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                            </svg>
                        </div>
                    )}
                    <div className="p-4 flex items-center justify-between">
                        <span className="font-semibold text-gray-800">{a.nombre}</span>
                        <span className="text-blue-600 text-sm font-medium">Ver fotos →</span>
                    </div>
                </a>
            ))}
        </div>
    );
}
