import React, { useEffect, useState, useCallback } from "react";
import useEmblaCarousel from "embla-carousel-react";
import Autoplay from "embla-carousel-autoplay";

export default function HeroSection() {
  const [slides, setSlides] = useState([]);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const backendUrl = import.meta.env.VITE_BACKEND_URL;

  const [emblaRef, emblaApi] = useEmblaCarousel({ loop: true }, [
    Autoplay({ delay: 5000 }),
  ]);

  const onSelect = useCallback(() => {
    if (!emblaApi) return;
    setSelectedIndex(emblaApi.selectedScrollSnap());
  }, [emblaApi]);

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
                <div className="relative text-white text-center p-6 max-w-3xl z-10">
                  <h2
                    className={`text-4xl md:text-5xl font-bold mb-4 drop-shadow-xl ${
                      isActive ? slide.title_effect : ""
                    }`}
                  >
                    {slide.title}
                  </h2>
                  <p
                    className={`text-lg md:text-xl drop-shadow-lg ${
                      isActive ? slide.subtitle_effect : ""
                    }`}
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
