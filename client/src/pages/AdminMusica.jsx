import React, { useEffect, useState } from "react";
import { useAuth } from "../context/AuthContext";
import AdminNav from "../components/AdminNav";
import { Music, CheckCircle, AlertCircle, Loader2, RefreshCw, Save, Link } from "lucide-react";

const API = import.meta.env.VITE_BACKEND_URL || "https://iglesia-backend.onrender.com";

export default function AdminMusica() {
  const { getToken } = useAuth();
  const [estado, setEstado] = useState(null);
  const [loading, setLoading] = useState(true);
  const [shareUrl, setShareUrl] = useState("");
  const [guardando, setGuardando] = useState(false);
  const [guardadoOk, setGuardadoOk] = useState(false);
  const [error, setError] = useState(null);

  const hdrs = () => ({ Authorization: `Bearer ${getToken()}` });

  const verificar = async () => {
    setLoading(true);
    try {
      const r = await fetch(`${API}/api/musica/estado`, { headers: hdrs() });
      const data = await r.json();
      setEstado(data);
      if (data.folderId) setShareUrl(data.folderId);
    } catch { setEstado({ configurado: false }); }
    finally { setLoading(false); }
  };

  useEffect(() => { verificar(); }, []);

  const guardar = async () => {
    if (!shareUrl.trim()) return;
    setGuardando(true);
    setError(null);
    setGuardadoOk(false);
    try {
      const r = await fetch(`${API}/api/musica/configurar`, {
        method: "POST",
        headers: { ...hdrs(), "Content-Type": "application/json" },
        body: JSON.stringify({ share_url: shareUrl.trim() }),
      });
      const data = await r.json();
      if (!r.ok) { setError(data.error || "Error al guardar"); return; }
      setGuardadoOk(true);
      await verificar();
    } catch { setError("Error de red al guardar"); }
    finally { setGuardando(false); }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <AdminNav />
      <div className="max-w-2xl mx-auto px-4 py-8 space-y-5">
        <h1 className="text-xl font-bold text-gray-800 flex items-center gap-2">
          <Music size={20} className="text-indigo-500" /> Configuración de Música
        </h1>

        {/* Estado actual */}
        <div className="bg-white rounded-2xl shadow-sm p-6 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="font-semibold text-gray-700">Estado</h2>
            <button onClick={verificar} className="text-gray-400 hover:text-gray-600 transition" title="Actualizar">
              <RefreshCw size={15} />
            </button>
          </div>
          {loading ? (
            <div className="flex items-center gap-2 text-gray-400 text-sm">
              <Loader2 size={16} className="animate-spin" /> Verificando...
            </div>
          ) : estado?.configurado ? (
            <div className="flex items-center gap-2 text-green-600 text-sm font-medium">
              <CheckCircle size={17} /> Carpeta de Google Drive configurada
            </div>
          ) : (
            <div className="flex items-center gap-2 text-amber-600 text-sm font-medium">
              <AlertCircle size={17} /> No configurado — sigue las instrucciones más abajo
            </div>
          )}
        </div>

        {/* Formulario */}
        <div className="bg-white rounded-2xl shadow-sm p-6 space-y-4">
          <h2 className="font-semibold text-gray-700 flex items-center gap-2">
            <Link size={16} className="text-indigo-400" /> Carpeta de Google Drive
          </h2>
          <p className="text-sm text-gray-500">
            Abre <strong>Google Drive</strong> → haz clic derecho sobre la carpeta de música →
            <strong> Compartir</strong> → cambia a <strong>"Cualquier persona con el enlace"</strong>
            (Rol: Lector) → <strong>Copiar enlace</strong> y pégalo aquí.
          </p>
          <input
            type="text"
            value={shareUrl}
            onChange={e => { setShareUrl(e.target.value); setGuardadoOk(false); }}
            placeholder="https://drive.google.com/drive/folders/1BxiMV... o solo el ID"
            className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300"
          />
          {error && <p className="text-red-500 text-xs">{error}</p>}
          {guardadoOk && <p className="text-green-600 text-xs font-medium">✓ Carpeta guardada correctamente</p>}
          <button
            onClick={guardar}
            disabled={guardando || !shareUrl.trim()}
            className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white px-4 py-2.5 rounded-xl text-sm font-medium transition"
          >
            {guardando ? <Loader2 size={15} className="animate-spin" /> : <Save size={15} />}
            {guardando ? "Guardando..." : "Guardar carpeta"}
          </button>
        </div>

        {/* Requisitos */}
        <div className="bg-white rounded-2xl shadow-sm p-6 space-y-3">
          <h2 className="font-semibold text-gray-700">Requisito: GOOGLE_API_KEY en Render</h2>
          <p className="text-sm text-gray-500">
            Agrega esta variable en <strong>Render → tu servicio → Environment</strong>:
          </p>
          <div className="bg-gray-50 rounded-xl px-4 py-3 font-mono text-sm">
            <span className="text-indigo-600">GOOGLE_API_KEY</span>
            <span className="text-gray-400 text-xs"> # API key de Google Cloud Console</span>
          </div>
          <ol className="text-sm text-gray-600 space-y-2 list-decimal list-outside pl-4">
            <li>Ve a <strong>console.cloud.google.com</strong> → selecciona tu proyecto</li>
            <li><strong>APIs y servicios</strong> → <strong>Credenciales</strong> → <strong>+ Crear credencial</strong> → <strong>Clave de API</strong></li>
            <li>Copia la clave generada → pégala en Render como <code className="bg-gray-100 px-1 rounded">GOOGLE_API_KEY</code></li>
            <li>Activa la <strong>Google Drive API</strong>: APIs y servicios → Biblioteca → busca "Google Drive API" → Activar</li>
          </ol>
        </div>

        {/* Estructura */}
        <div className="bg-indigo-50 border border-indigo-100 rounded-2xl p-5 space-y-2">
          <p className="text-sm font-semibold text-indigo-700">Estructura de carpetas recomendada</p>
          <pre className="text-xs text-indigo-600 leading-relaxed font-mono whitespace-pre-wrap">
{`📁 Musica Iglesia/      ← comparte ESTA carpeta
  📁 Adoración/
      🎵 Tu Gracia Me Alcanza.mp3
      🎵 Santo Espíritu.mp3
  📁 Alabanza/
      🎵 Al Rey de Reyes.mp3
  📁 Coros/
      🎵 ...`}
          </pre>
          <p className="text-xs text-indigo-500">
            Cada subcarpeta aparece como categoría en la biblioteca de los miembros.
          </p>
        </div>
      </div>
    </div>
  );
}

