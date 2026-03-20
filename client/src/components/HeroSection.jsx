import React, { useEffect, useState, useCallback } from "react";
import useEmblaCarousel from "embla-carousel-react";
import Autoplay from "embla-carousel-autoplay";

export default function HeroSection() {
  const [slides, setSlides] = useState([]);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [liveStream, setLiveStream] = useState(null);
  const [isCheckingLive, setIsCheckingLive] = useState(true);
  const backendUrl = import.meta.env.VITE_BACKEND_URL;

  const [emblaRef, emblaApi] = useEmblaCarousel({ loop: true }, [
    Autoplay({ delay: 10000 }), // <-- tiempo fijo (10000ms = 10s)
  ]);

  const onSelect = useCallback(() => {
    if (!emblaApi) return;
    setSelectedIndex(emblaApi.selectedScrollSnap());
  }, [emblaApi]);

  // Verificar estado de transmisión en vivo
  useEffect(() => {
    const checkLiveStatus = async () => {
      try {
        const res = await fetch(`${backendUrl}/api/youtube/live-status`);
        const data = await res.json();
        setLiveStream(data.isLive ? data : null);
      } catch (error) {
        console.error("Error al verificar transmisión en vivo:", error);
        setLiveStream(null);
      } finally {
        setIsCheckingLive(false);
      }
    };

    checkLiveStatus();

    // Verificar cada 2 minutos si hay transmisión en vivo
    const interval = setInterval(checkLiveStatus, 2 * 60 * 1000);
    return () => clearInterval(interval);
  }, [backendUrl]);

  useEffect(() => {
    const fetchSlides = async () => {
      const res = await fetch(`${backendUrl}/api/hero`);
      const data = await res.json();
      setSlides(data.filter((s) => s.active));
    };
    fetchSlides();
  }, [backendUrl]);

  useEffect(() => {
    if (!emblaApi) return;
    emblaApi.on("select", onSelect);
  }, [emblaApi, onSelect]);

  // Si hay transmisión en vivo, mostrar el video
  if (liveStream && liveStream.isLive) {
    return (
      <section className="relative bg-black">
        <div className="relative w-full h-[80vh] flex items-center justify-center">
          {/* Iframe de YouTube */}
          <div className="absolute inset-0">
            <iframe
              src={`https://www.youtube.com/embed/${liveStream.videoId}?autoplay=1&mute=0`}
              title="Transmisión en Vivo"
              className="w-full h-full"
              frameBorder="0"
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
              allowFullScreen
            />
          </div>
          
          {/* Badge de EN VIVO */}
          <div className="absolute top-4 left-4 z-20 bg-red-600 text-white px-4 py-2 rounded-full font-bold flex items-center gap-2 animate-pulse">
            <span className="w-3 h-3 bg-white rounded-full animate-ping"></span>
            EN VIVO
          </div>
        </div>
      </section>
    );
  }

  // Si no hay transmisión, mostrar el carrusel de slides
  return (
    <section className="overflow-hidden relative">
      <div className="embla" ref={emblaRef}>
        <div className="embla__container flex">
          {slides.map((slide, index) => {
            const isActive = index === selectedIndex;
            return (
              <div
                key={slide.id}
                className="embla__slide min-w-full relative h-[80vh] flex items-center justify-center bg-black"
              >
                <img
                  src={slide.image_url}
                  alt={slide.title}
                  className="absolute w-full h-full object-cover transition-opacity duration-1000"
                  style={{
                    opacity: slide.opacity ?? 0.8,
                    filter: slide.filter_effect || "none",
                  }}
                />

                {/* Capa oscura opcional */}
                <div className="absolute inset-0 bg-black/30 z-0" />

                {/* Texto animado solo en el slide activo */}
                <div
                  className={`relative text-white text-center p-6 max-w-3xl z-10 ${slide.text_position || ""}`}
                >
                  <h2
                    className={`font-bold mb-4 drop-shadow-xl ${
                      slide.font_size_title || "text-4xl"
                    } ${isActive ? slide.title_effect : ""}`}
                    style={{ color: slide.color_title || "#ffffff" }}
                  >
                    {slide.title}
                  </h2>

                  <p
                    className={`drop-shadow-lg ${
                      slide.font_size_subtitle || "text-xl"
                    } ${isActive ? slide.subtitle_effect : ""}`}
                    style={{ color: slide.color_subtitle || "#ffffff" }}
                  >
                    {slide.subtitle}
                  </p>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
