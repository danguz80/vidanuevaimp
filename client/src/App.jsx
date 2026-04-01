import React from "react";
import { BrowserRouter as Router, Routes, Route } from "react-router-dom";
import { GoogleOAuthProvider } from "@react-oauth/google";
import { AuthProvider } from "./context/AuthContext";
import { MemberAuthProvider } from "./context/MemberAuthContext";
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
import AdminMiembros from "./pages/AdminMiembros";
import AdminCalendario from "./pages/AdminCalendario";
import ForgotPassword from "./pages/ForgotPassword";
import ResetPassword from "./pages/ResetPassword";
import PerfilMiembro from "./pages/PerfilMiembro";

import SoundCloudPage from "./pages/SoundCloudPage";

import GaleriaFotos from "./pages/GaleriaFotos";
import ProgresoFondos from "./pages/ProgresoFondos";
import LoginMiembro from "./pages/LoginMiembro";
import MiPortal from "./pages/MiPortal";
import DirectorioMiembros from "./pages/DirectorioMiembros";
import PerfilPublicoMiembro from "./pages/PerfilPublicoMiembro";
import BibliotecaMusica from "./pages/BibliotecaMusica";
import AdminMusica from "./pages/AdminMusica";

export default function App() {
  return (
    <GoogleOAuthProvider clientId={import.meta.env.VITE_GOOGLE_CLIENT_ID}>
    <Router>
      <AuthProvider>
        <MemberAuthProvider>
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
              <Route path="/admin/miembros" element={<ProtectedRoute><AdminMiembros /></ProtectedRoute>} />
              <Route path="/admin/miembros/:id" element={<ProtectedRoute><PerfilMiembro /></ProtectedRoute>} />
              <Route path="/admin/calendario" element={<ProtectedRoute><AdminCalendario /></ProtectedRoute>} />
              <Route path="/admin/musica" element={<ProtectedRoute><AdminMusica /></ProtectedRoute>} />

              {/* Portal de miembros */}
              <Route path="/portal/login" element={<LoginMiembro />} />
              <Route path="/portal" element={<MiPortal />} />
              <Route path="/portal/directorio" element={<DirectorioMiembros />} />
              <Route path="/portal/miembros/:id" element={<PerfilPublicoMiembro />} />
              <Route path="/portal/musica" element={<BibliotecaMusica />} />
              
              <Route path="*" element={<NotFound />} />
            </Routes>
          </main>
          <Footer />
        </div>
        </MemberAuthProvider>
      </AuthProvider>
    </Router>
    </GoogleOAuthProvider>
  );
}
