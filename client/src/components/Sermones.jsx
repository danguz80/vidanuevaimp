import React, { useEffect, useState } from "react";

const backendUrl = import.meta.env.VITE_BACKEND_URL;

export default function Sermones() {
  const [videos, setVideos] = useState([]);

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
          const url = `https://www.youtube.com/embed/${video.videoId}?start=${video.start || 0}`;

          return (
            <div key={video.videoId} className="bg-gray-100 rounded shadow p-4">
              <iframe
                className="w-full aspect-video rounded"
                src={url}
                title={video.title}
                allowFullScreen
              />
              <p className="mt-4 text-gray-700 font-semibold">{video.title}</p>
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
