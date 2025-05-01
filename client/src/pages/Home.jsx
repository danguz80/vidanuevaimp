import React from "react";
import HeroSection from "../components/HeroSection";
import QuienesSomos from "../components/QuienesSomos";
import Eventos from "../components/Eventos";
import Horarios from "../components/Horarios";
import Sermones from "../components/Sermones";
import Donacion from "../components/Donacion";
import Contacto from "../components/Contacto";

export default function Home() {
  return (
    <>
      <HeroSection />
      <QuienesSomos />
      <Eventos />
      <Horarios />
      <Sermones />
      <Donacion />
      <Contacto />
    </>
  );
}
