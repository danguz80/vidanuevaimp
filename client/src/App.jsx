import React from "react";
import { BrowserRouter as Router, Routes, Route } from "react-router-dom";
import Header from "./components/Header";
import Footer from "./components/Footer";

import Home from "./pages/Home";
import QuienesSomos from "./pages/QuienesSomos";
import Eventos from "./pages/Eventos";
import Horarios from "./pages/Horarios";
import Sermones from "./pages/Sermones";
import Ministerios from "./pages/Ministerios";
import Contacto from "./pages/Contacto";
import Donacion from "./pages/Donacion";
import NotFound from "./pages/NotFound";

import AdminPanel from "./pages/AdminPanel";
import AdminMensajes from "./pages/AdminMensajes";
import AdminVideos from "./pages/AdminVideos"; // ✅ Nuevo import

export default function App() {
  return (
    <Router>
      <div className="min-h-screen flex flex-col">
        <Header />
        <main className="flex-grow">
          <Routes>
            <Route path="/" element={<Home />} />
            <Route path="/quienes-somos" element={<QuienesSomos />} />
            <Route path="/eventos" element={<Eventos />} />
            <Route path="/horarios" element={<Horarios />} />
            <Route path="/sermones" element={<Sermones />} />
            <Route path="/ministerios" element={<Ministerios />} />
            <Route path="/contacto" element={<Contacto />} />
            <Route path="/donacion" element={<Donacion />} />
            <Route path="/admin" element={<AdminPanel />} />
            <Route path="/admin/mensajes" element={<AdminMensajes />} />
            <Route path="/admin/videos" element={<AdminVideos />} /> {/* ✅ Nueva ruta para videos */}
            <Route path="*" element={<NotFound />} />
          </Routes>
        </main>
        <Footer />
      </div>
    </Router>
  );
}
