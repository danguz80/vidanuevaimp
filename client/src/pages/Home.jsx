import React from "react";
import HeroSection from "../components/HeroSection";
import QuienesSomos from "../components/QuienesSomos";
import Eventos from "../components/Eventos";
import Horarios from "../components/Horarios";
import Sermones from "../components/Sermones";
import DonacionSection from "../components/DonacionSection";
import Contacto from "../components/Contacto";

export default function Home() {
  return (
    <>
      <HeroSection />
      <QuienesSomos />
      <Eventos />
      <Horarios />
      <Sermones />
      <DonacionSection />
      <Contacto />
    </>
  );
}
