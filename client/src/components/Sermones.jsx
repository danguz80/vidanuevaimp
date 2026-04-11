import React, { useEffect, useState } from "react";

const backendUrl = import.meta.env.VITE_BACKEND_URL;

export default function Sermones() {
  const [videos, setVideos] = useState([]);
  const [playing, setPlaying] = useState({});

  useEffect(() => {
    const fetchVideos = async () => {
      try {
        const res = await fetch(`${backendUrl}/api/sermones`);
        const data = await res.json();
        setVideos(data);
      } catch (error) {
        console.error("Error al cargar videos:", error);
      }
    };

    fetchVideos();
  }, []);

  return (
    <section className="py-16 px-4 bg-white text-center">
      <h2 className="text-3xl font-bold mb-4 text-gray-800">Últimos Sermones</h2>
      <p className="text-gray-600 mb-8">
        Palabra de Dios para edificar tu vida y fortalecer tu fe
      </p>

      <div className="grid md:grid-cols-3 gap-6 max-w-6xl mx-auto">
        {videos.map((video) => {
          const embedUrl = `https://www.youtube.com/embed/${video.videoId}?start=${video.start || 0}&autoplay=1`;
          const watchUrl = `https://www.youtube.com/watch?v=${video.videoId}&t=${video.start || 0}`;
          const thumb = video.thumbnail || `https://i.ytimg.com/vi/${video.videoId}/hqdefault.jpg`;
          const isPlaying = playing[video.videoId];

          return (
            <div key={video.videoId} className="bg-gray-100 rounded shadow p-4 flex flex-col">
              {isPlaying ? (
                <iframe
                  className="w-full aspect-video rounded"
                  src={embedUrl}
                  title={video.title}
                  allow="autoplay; encrypted-media"
                  allowFullScreen
                />
              ) : (
                <button
                  onClick={() => setPlaying(p => ({ ...p, [video.videoId]: true }))}
                  className="relative w-full aspect-video rounded overflow-hidden group focus:outline-none"
                  aria-label={`Reproducir ${video.title}`}
                >
                  <img
                    src={thumb}
                    alt={video.title}
                    className="w-full h-full object-cover"
                  />
                  {/* Overlay oscuro al hover */}
                  <div className="absolute inset-0 bg-black/20 group-hover:bg-black/30 transition" />
                  {/* Botón play estilo YouTube */}
                  <div className="absolute inset-0 flex items-center justify-center">
                    <div className="bg-red-600 group-hover:bg-red-700 transition rounded-2xl px-5 py-3.5 shadow-lg">
                      <svg viewBox="0 0 24 24" fill="white" className="w-8 h-8 ml-1">
                        <path d="M8 5v14l11-7z" />
                      </svg>
                    </div>
                  </div>
                </button>
              )}

              <p className="mt-3 text-gray-700 font-semibold text-sm">{video.title}</p>

              <a
                href={watchUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="mt-1 text-xs text-red-600 hover:underline"
              >
                Ver en YouTube ↗
              </a>
            </div>
          );
        })}
      </div>

      <div className="mt-8">
        <a
          href="https://www.youtube.com/@iglesiamisionpentecosteste2582"
          target="_blank"
          rel="noopener noreferrer"
          className="inline-block bg-blue-600 text-white px-6 py-2 rounded hover:bg-blue-700 transition"
        >
          Ver más en YouTube
        </a>
      </div>
    </section>
  );
}
