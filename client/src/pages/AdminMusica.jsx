import React, { useEffect, useState } from "react";
import { useAuth } from "../context/AuthContext";
import AdminNav from "../components/AdminNav";
import { Music, CheckCircle, AlertCircle, ExternalLink, Loader2, RefreshCw } from "lucide-react";

const API = import.meta.env.VITE_BACKEND_URL || "https://iglesia-backend.onrender.com";
const BACKEND_URL = API;

export default function AdminMusica() {
  const { getToken } = useAuth();
  const [estado, setEstado] = useState(null);
  const [loading, setLoading] = useState(true);
  const [conectando, setConectando] = useState(false);

  const hdrs = () => ({ Authorization: `Bearer ${getToken()}` });

  const verificar = async () => {
    setLoading(true);
    try {
      const r = await fetch(`${API}/api/musica/estado`, { headers: hdrs() });
      setEstado(await r.json());
    } catch { setEstado({ configurado: false }); }
    finally { setLoading(false); }
  };

  useEffect(() => { verificar(); }, []);

  const conectarOneDrive = async () => {
    setConectando(true);
    try {
      const r = await fetch(`${API}/api/musica/auth-url`, { headers: hdrs() });
      const { url } = await r.json();
      window.open(url, "_blank", "width=600,height=700,noopener");
    } catch { alert("Error al generar URL. Verifica las variables de entorno en Render."); }
    finally { setConectando(false); }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <AdminNav />
      <div className="max-w-2xl mx-auto px-4 py-8 space-y-5">
        <h1 className="text-xl font-bold text-gray-800 flex items-center gap-2">
          <Music size={20} className="text-indigo-500" /> Configuración de Música
        </h1>

        {/* Estado de conexión */}
        <div className="bg-white rounded-2xl shadow-sm p-6 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="font-semibold text-gray-700">Conexión con OneDrive</h2>
            <button onClick={verificar} className="text-gray-400 hover:text-gray-600 transition" title="Verificar">
              <RefreshCw size={15} />
            </button>
          </div>

          {loading ? (
            <div className="flex items-center gap-2 text-gray-400 text-sm">
              <Loader2 size={16} className="animate-spin" /> Verificando...
            </div>
          ) : estado?.configurado ? (
            <div className="flex items-center gap-2 text-green-600 text-sm font-medium">
              <CheckCircle size={17} /> OneDrive conectado correctamente
            </div>
          ) : (
            <div className="flex items-center gap-2 text-amber-600 text-sm font-medium">
              <AlertCircle size={17} /> No configurado — sigue los pasos más abajo
            </div>
          )}

          <button
            onClick={conectarOneDrive}
            disabled={conectando}
            className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white px-4 py-2.5 rounded-xl text-sm font-medium transition"
          >
            {conectando ? <Loader2 size={15} className="animate-spin" /> : <ExternalLink size={15} />}
            {estado?.configurado ? "Reconectar OneDrive" : "Conectar OneDrive"}
          </button>

          <p className="text-xs text-gray-400">
            Al hacer clic se abrirá una ventana de Microsoft para autenticarte. Después de que diga
            "conectado correctamente", cierra la ventana y haz clic en el ícono de recarga ↑.
          </p>
        </div>

        {/* Variables de entorno */}
        <div className="bg-white rounded-2xl shadow-sm p-6 space-y-3">
          <h2 className="font-semibold text-gray-700">Variables de entorno en Render</h2>
          <p className="text-xs text-gray-500">Agrégalas en Render → tu servicio → <em>Environment</em> → <em>Environment Variables</em></p>
          <div className="bg-gray-50 rounded-xl p-4 space-y-1.5 font-mono text-sm">
            {[
              ["ONEDRIVE_CLIENT_ID",     "ID de aplicación de Azure (GUID)"],
              ["ONEDRIVE_CLIENT_SECRET", "Secreto de cliente de Azure"],
              ["ONEDRIVE_TENANT_ID",     "ID de directorio (inquilino) de Azure"],
              ["ONEDRIVE_FOLDER",        "Nombre exacto de la carpeta raíz (ej: Musica Iglesia)"],
              ["BACKEND_URL",            `${BACKEND_URL}`],
            ].map(([key, hint]) => (
              <div key={key}>
                <span className="text-indigo-600">{key}</span>
                <span className="text-gray-400 text-xs"> # {hint}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Guía Azure paso a paso */}
        <div className="bg-white rounded-2xl shadow-sm p-6 space-y-3">
          <h2 className="font-semibold text-gray-700">Pasos en Azure Portal — guía completa</h2>
          <ol className="text-sm text-gray-600 space-y-3 list-decimal list-outside pl-4">
            <li>
              Ir a <strong>portal.azure.com</strong> → en el menú lateral busca
              <strong> Microsoft Entra ID</strong> (antes llamado Azure Active Directory)
            </li>
            <li>
              Clic en <strong>Registros de aplicaciones</strong> → <strong>+ Nuevo registro</strong>
            </li>
            <li>
              <strong>Nombre:</strong> <code className="bg-gray-100 px-1 rounded">Música Iglesia</code><br />
              <strong>Tipos de cuenta compatibles:</strong> "Solo las cuentas de este directorio organizativo"<br />
              <strong>URI de redirección:</strong> Web →{" "}
              <code className="bg-gray-100 px-1 rounded text-xs break-all">{API}/api/musica/auth/callback</code>
            </li>
            <li>
              Clic en <strong>Registrar</strong> → copia el <strong>Id. de aplicación (cliente)</strong>{" "}
              → es tu <code className="bg-gray-100 px-1 rounded">ONEDRIVE_CLIENT_ID</code>.<br />
              También copia el <strong>Id. de directorio (inquilino)</strong>{" "}
              → es tu <code className="bg-gray-100 px-1 rounded">ONEDRIVE_TENANT_ID</code>
            </li>
            <li>
              En la barra lateral de la app → <strong>Certificados y secretos</strong>{" "}
              → <strong>+ Nuevo secreto de cliente</strong> → pon descripción "prod", expiración 24 meses→ clic <strong>Agregar</strong>.<br />
              Copia el <strong>Valor</strong> (solo se ve ahora) → es tu <code className="bg-gray-100 px-1 rounded">ONEDRIVE_CLIENT_SECRET</code>
            </li>
            <li>
              <strong>Permisos de API</strong> → <strong>+ Agregar un permiso</strong>{" "}
              → Microsoft Graph → <strong>Permisos delegados</strong>{" "}
              → busca <code className="bg-gray-100 px-1 rounded">Files.Read.All</code> → agregar.<br />
              Luego busca <code className="bg-gray-100 px-1 rounded">offline_access</code> → agregar.
            </li>
            <li>
              Clic en <strong>Conceder consentimiento de administrador</strong> (botón azul) → confirmar
            </li>
            <li>
              Agrega las 5 variables en Render (paso anterior) → haz <strong>Deploy</strong> o reinicia el servidor
            </li>
            <li>
              Vuelve aquí y haz clic en <strong>"Conectar OneDrive"</strong> → inicia sesión con la cuenta
              Microsoft que tiene la carpeta de música
            </li>
            <li>
              En tu OneDrive, crea una carpeta con el nombre exacto que pusiste en{" "}
              <code className="bg-gray-100 px-1 rounded">ONEDRIVE_FOLDER</code> y dentro crea subcarpetas
              por categoría (Adoración, Alabanza, etc.) con los archivos de audio
            </li>
          </ol>
        </div>

        {/* Estructura de carpetas */}
        <div className="bg-indigo-50 border border-indigo-100 rounded-2xl p-5 space-y-2">
          <p className="text-sm font-semibold text-indigo-700">Estructura de carpetas recomendada</p>
          <pre className="text-xs text-indigo-600 leading-relaxed font-mono whitespace-pre-wrap">
{`📁 Musica Iglesia/          ← ONEDRIVE_FOLDER
  📁 Adoración/
      🎵 Tu Gracia Me Alcanza.mp3
      🎵 Santo Espíritu.mp3
  📁 Alabanza/
      🎵 Al Rey de Reyes.mp3
  📁 Coros/
      🎵 ...`}
          </pre>
          <p className="text-xs text-indigo-500">
            Cada subcarpeta aparece como una categoría en la biblioteca de los músicos.
          </p>
        </div>
      </div>
    </div>
  );
}
