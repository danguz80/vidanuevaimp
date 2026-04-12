import { useEffect, useState, useCallback } from 'react';
import axios from 'axios';

const API = "https://iglesia-backend.onrender.com";

export default function GaleriaFotos() {
    const [albums, setAlbums] = useState([]);
    const [albumActivo, setAlbumActivo] = useState(null);
    const [fotos, setFotos] = useState([]);
    const [cargandoAlbums, setCargandoAlbums] = useState(true);
    const [cargandoFotos, setCargandoFotos] = useState(false);
    const [error, setError] = useState('');
    const [imagenSeleccionada, setImagenSeleccionada] = useState(null);
    const [mostrarModal, setMostrarModal] = useState(false);

    // Cargar lista de álbumes disponibles
    useEffect(() => {
        const fetchAlbums = async () => {
            setCargandoAlbums(true);
            try {
                const { data } = await axios.get(`${API}/api/galeria/albums`);
                setAlbums(data);
                if (data.length > 0) setAlbumActivo(data[0].album_id);
            } catch (err) {
                console.error("❌ Error al obtener álbumes:", err);
                setError("No se pudo cargar la galería.");
            } finally {
                setCargandoAlbums(false);
            }
        };
        fetchAlbums();
    }, []);

    // Cargar fotos del álbum activo
    useEffect(() => {
        if (!albumActivo) return;
        const fetchFotos = async () => {
            setCargandoFotos(true);
            setError('');
            setFotos([]);
            try {
                const { data } = await axios.get(`${API}/api/galeria/album/${albumActivo}`);
                setFotos(data.fotos || []);
            } catch (err) {
                console.error("❌ Error al obtener fotos:", err);
                setError("No se pudieron cargar las fotos de este álbum.");
            } finally {
                setCargandoFotos(false);
            }
        };
        fetchFotos();
    }, [albumActivo]);

    // Navegación con teclado en el modal
    const handleKeyDown = useCallback(
        (e) => {
            if (!mostrarModal || !imagenSeleccionada) return;
            const index = fotos.findIndex((f) => f.url === imagenSeleccionada.url);
            if (e.key === 'Escape') {
                setMostrarModal(false);
            } else if (e.key === 'ArrowRight' && index < fotos.length - 1) {
                setImagenSeleccionada(fotos[index + 1]);
            } else if (e.key === 'ArrowLeft' && index > 0) {
                setImagenSeleccionada(fotos[index - 1]);
            }
        },
        [mostrarModal, imagenSeleccionada, fotos]
    );

    useEffect(() => {
        document.addEventListener("keydown", handleKeyDown);
        return () => document.removeEventListener("keydown", handleKeyDown);
    }, [handleKeyDown]);

    if (cargandoAlbums) {
        return <div className="p-8 text-center text-gray-500">Cargando galería…</div>;
    }

    if (albums.length === 0) {
        return <div className="p-8 text-center text-gray-400">No hay álbumes disponibles.</div>;
    }

    return (
        <div className="p-4 relative">
            {/* Pestañas de álbumes */}
            <div className="flex flex-wrap gap-2 mb-6 border-b pb-3">
                {albums.map((a) => (
                    <button
                        key={a.album_id}
                        onClick={() => setAlbumActivo(a.album_id)}
                        className={`px-4 py-1.5 rounded-full text-sm font-medium transition-colors ${
                            albumActivo === a.album_id
                                ? 'bg-blue-600 text-white'
                                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                        }`}
                    >
                        {a.nombre}
                    </button>
                ))}
            </div>

            {error && <div className="text-red-600 font-semibold mb-4">{error}</div>}

            {cargandoFotos ? (
                <div className="py-16 text-center text-gray-400">Cargando fotos…</div>
            ) : fotos.length === 0 ? (
                <div className="py-16 text-center text-gray-400">Este álbum no tiene fotos.</div>
            ) : (
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2">
                    {fotos.map((foto, i) => (
                        <img
                            key={i}
                            src={foto.thumb || foto.url}
                            alt={foto.titulo || `Foto ${i + 1}`}
                            className="w-full aspect-square object-cover rounded shadow hover:scale-105 transition-transform cursor-pointer"
                            loading="lazy"
                            onClick={() => {
                                setImagenSeleccionada(foto);
                                setMostrarModal(true);
                            }}
                        />
                    ))}
                </div>
            )}

            {/* Modal lightbox */}
            {mostrarModal && imagenSeleccionada && (
                <div
                    className="fixed inset-0 bg-black bg-opacity-90 flex items-center justify-center z-50"
                    onClick={() => setMostrarModal(false)}
                >
                    {/* Flecha anterior */}
                    {fotos.findIndex((f) => f.url === imagenSeleccionada.url) > 0 && (
                        <button
                            className="absolute left-4 top-1/2 -translate-y-1/2 text-white text-4xl bg-black bg-opacity-40 px-3 py-1 rounded hover:bg-opacity-70"
                            onClick={(e) => {
                                e.stopPropagation();
                                const idx = fotos.findIndex((f) => f.url === imagenSeleccionada.url);
                                setImagenSeleccionada(fotos[idx - 1]);
                            }}
                        >‹</button>
                    )}

                    <img
                        src={imagenSeleccionada.url}
                        alt={imagenSeleccionada.titulo}
                        className="max-w-[90vw] max-h-[90vh] rounded shadow-lg"
                        onClick={(e) => e.stopPropagation()}
                    />

                    {/* Flecha siguiente */}
                    {fotos.findIndex((f) => f.url === imagenSeleccionada.url) < fotos.length - 1 && (
                        <button
                            className="absolute right-4 top-1/2 -translate-y-1/2 text-white text-4xl bg-black bg-opacity-40 px-3 py-1 rounded hover:bg-opacity-70"
                            onClick={(e) => {
                                e.stopPropagation();
                                const idx = fotos.findIndex((f) => f.url === imagenSeleccionada.url);
                                setImagenSeleccionada(fotos[idx + 1]);
                            }}
                        >›</button>
                    )}

                    {/* Título */}
                    {imagenSeleccionada.titulo && (
                        <p className="absolute bottom-4 left-1/2 -translate-x-1/2 text-white text-sm bg-black bg-opacity-50 px-3 py-1 rounded">
                            {imagenSeleccionada.titulo}
                        </p>
                    )}
                </div>
            )}
        </div>
    );
}

