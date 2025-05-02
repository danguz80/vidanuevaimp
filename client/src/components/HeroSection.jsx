import React, { useEffect, useState } from "react";
import useEmblaCarousel from "embla-carousel-react";
import Autoplay from "embla-carousel-autoplay";

export default function HeroSection() {
  const [slides, setSlides] = useState([]);
  const backendUrl = import.meta.env.VITE_BACKEND_URL;

  const [emblaRef] = useEmblaCarousel(
    { loop: true },
    [Autoplay({ delay: 5000 })]
  );

  useEffect(() => {
    const fetchSlides = async () => {
      const res = await fetch(`${backendUrl}/api/hero`);
      const data = await res.json();
      setSlides(data.filter((s) => s.active));
    };
    fetchSlides();
  }, [backendUrl]);

  return (
    <section className="overflow-hidden relative">
      <div className="embla" ref={emblaRef}>
        <div className="embla__container flex">
          {slides.map((slide) => (
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

              {/* Capa de superposición oscura o clara */}
              <div className="absolute inset-0 bg-black/30 z-0" />

              {/* Texto con efectos de entrada configurables */}
              <div className="relative text-white text-center p-6 max-w-3xl z-10">
                <h2
                  className={`text-4xl md:text-5xl font-bold mb-4 drop-shadow-xl ${
                    slide.title_effect || "animate-fade-right"
                  }`}
                >
                  {slide.title}
                </h2>
                <p
                  className={`text-lg md:text-xl drop-shadow-lg ${
                    slide.subtitle_effect || "animate-fade-left"
                  }`}
                >
                  {slide.subtitle}
                </p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
