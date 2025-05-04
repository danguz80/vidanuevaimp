import React, { useEffect, useState, useCallback, useRef } from "react";
import useEmblaCarousel from "embla-carousel-react";
import Autoplay from "embla-carousel-autoplay";

export default function HeroSection() {
  const [slides, setSlides] = useState([]);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const backendUrl = import.meta.env.VITE_BACKEND_URL;
  const autoplayRef = useRef(null);

  const [emblaRef, emblaApi] = useEmblaCarousel({ loop: true }, [
    Autoplay({ delay: 5000 }), // Valor inicial genérico, luego se actualiza.
  ]);

  const onSelect = useCallback(() => {
    if (!emblaApi || !slides.length) return;

    const currentSlide = slides[emblaApi.selectedScrollSnap()];
    const duration = (currentSlide.slide_duration || 5) * 1000;

    if (autoplayRef.current) {
      autoplayRef.current.stop();
      autoplayRef.current.options.delay = duration;
      autoplayRef.current.play();
    }

    setSelectedIndex(emblaApi.selectedScrollSnap());
  }, [emblaApi, slides]);

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

    autoplayRef.current = emblaApi.plugins().autoplay;
    emblaApi.on("select", onSelect);

    if (slides.length) onSelect(); // Inicializa la duración del primer slide correctamente.
  }, [emblaApi, onSelect, slides]);

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
                    className={`font-bold mb-4 drop-shadow-xl ${slide.font_size_title || "text-4xl"} ${isActive ? slide.title_effect : ""}`}
                    style={{ color: slide.color_title || "#ffffff" }}
                  >
                    {slide.title}
                  </h2>

                  <p
                    className={`drop-shadow-lg ${slide.font_size_subtitle || "text-xl"} ${isActive ? slide.subtitle_effect : ""}`}
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
