import React from "react";
import { Link } from "react-router-dom";

export default function HeroSection() {
  return (
    <section
      className="relative bg-cover bg-center bg-no-repeat py-24 px-4 text-center text-white"
      style={{
        backgroundImage: "url('/hero-bg2.jpeg')",
      }}
    >
      <div className="absolute inset-0 bg-white bg-opacity-30"></div>

      <div className="relative max-w-4xl mx-auto flex flex-col items-center space-y-6 z-10">
        <h1 className="text-3xl md:text-5xl font-extrabold leading-tight opacity-0 animate-fade-up animate-delay-1 shadow-text">
          Bienvenido a <span className="text-blue-300">Templo Vida Nueva</span>
        </h1>


        <p className="text-lg md:text-xl max-w-2xl drop-shadow-sm opacity-0 animate-fade-up animate-delay-2 shadow-text">
          “Pero recibiréis poder, cuando haya venido sobre vosotros el Espíritu Santo...”<br />
          <span className="italic">Hechos 1:8</span>
        </p>

        <Link
          to="/quienes-somos"
          className="inline-block bg-blue-600 text-white px-8 py-3 rounded-full text-lg font-semibold shadow-md hover:bg-blue-700 transition duration-300 transform hover:scale-105 opacity-0 animate-fade-up animate-delay-3"
        >
          Conoce más de nosotros
        </Link>
      </div>

    </section>
  );
}
