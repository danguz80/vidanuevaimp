import React from "react";
import { BrowserRouter as Router, Routes, Route } from "react-router-dom";
import { AuthProvider } from "./context/AuthContext";
import Header from "./components/Header";
import Footer from "./components/Footer";
import ProtectedRoute from "./components/ProtectedRoute";

import Home from "./pages/Home";
import Login from "./pages/Login";
import AdminHero from "./pages/AdminHero"; // ✅ nueva importación
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
import AdminVideos from "./pages/AdminVideos";
import AdminFondos from "./pages/AdminFondos";
import ForgotPassword from "./pages/ForgotPassword";
import ResetPassword from "./pages/ResetPassword";

import SoundCloudPage from "./pages/SoundCloudPage";

import GaleriaFotos from "./pages/GaleriaFotos";
import ProgresoFondos from "./pages/ProgresoFondos";

export default function App() {
  return (
    <Router>
      <AuthProvider>
        <div className="min-h-screen flex flex-col">
          <Header />
          <main className="flex-grow">
            <Routes>
              <Route path="/" element={<Home />} />
              <Route path="/login" element={<Login />} />
              <Route path="/forgot-password" element={<ForgotPassword />} />
              <Route path="/reset-password" element={<ResetPassword />} />
              <Route path="/quienes-somos" element={<QuienesSomos />} />
              <Route path="/eventos" element={<Eventos />} />
              <Route path="/horarios" element={<Horarios />} />
              <Route path="/sermones" element={<Sermones />} />
              <Route path="/ministerios" element={<Ministerios />} />
              <Route path="/contacto" element={<Contacto />} />
              <Route path="/donacion" element={<Donacion />} />
              <Route path="/fondos" element={<ProgresoFondos />} />
              <Route path="/soundcloud" element={<SoundCloudPage />} />
              <Route path="/galeria" element={<GaleriaFotos />} />
              
              {/* Rutas protegidas */}
              <Route path="/admin" element={<ProtectedRoute><AdminPanel /></ProtectedRoute>} />
              <Route path="/admin/hero" element={<ProtectedRoute><AdminHero /></ProtectedRoute>} />
              <Route path="/admin/mensajes" element={<ProtectedRoute><AdminMensajes /></ProtectedRoute>} />
              <Route path="/admin/videos" element={<ProtectedRoute><AdminVideos /></ProtectedRoute>} />
              <Route path="/admin/fondos" element={<ProtectedRoute><AdminFondos /></ProtectedRoute>} />
              
              <Route path="*" element={<NotFound />} />
            </Routes>
          </main>
          <Footer />
        </div>
      </AuthProvider>
    </Router>
  );
}
