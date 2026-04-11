import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useMemberAuth } from "../context/MemberAuthContext";
import { ArrowLeft, Music2, Search, ChevronUp, ChevronDown, X, Loader2 } from "lucide-react";
import ChordProRenderer from "../components/ChordProRenderer";

const API = import.meta.env.VITE_BACKEND_URL;

export default function CancionesCifrado() {
  const navigate = useNavigate();
  const { miembro, getToken } = useMemberAuth();

  const [canciones, setCanciones] = useState([]);
  const [loading, setLoading] = useState(true);
  const [busqueda, setBusqueda] = useState("");

  // Canción abierta
  const [seleccionada, setSeleccionada] = useState(null); // { id, titulo, artista, tono, contenido }
  const [loadingCancion, setLoadingCancion] = useState(false);

  // Transposición
  const [semitonos, setSemitonos] = useState(0);

  const hdrs = () => ({ Authorization: `Bearer ${getToken()}` });

  useEffect(() => {
    if (!miembro) { navigate("/portal/login"); return; }
    fetch(`${API}/api/chordpro`, { headers: hdrs() })
      .then(r => r.json())
      .then(data => { setCanciones(Array.isArray(data) ? data : []); })
      .finally(() => setLoading(false));
  }, [miembro]);

  const abrirCancion = async (c) => {
    setSemitonos(0);
    setLoadingCancion(true);
    try {
      const r = await fetch(`${API}/api/chordpro/${c.id}`, { headers: hdrs() });
      const data = await r.json();
      setSeleccionada(data);
    } finally {
      setLoadingCancion(false);
    }
  };

  const cerrar = () => { setSeleccionada(null); setSemitonos(0); };

  const cancionesFiltradas = canciones.filter(c =>
    c.titulo.toLowerCase().includes(busqueda.toLowerCase()) ||
    (c.artista || "").toLowerCase().includes(busqueda.toLowerCase()) ||
    (c.tags || "").toLowerCase().includes(busqueda.toLowerCase())
  );

  // ──── Vista de canción individual ────
  if (seleccionada || loadingCancion) {
    return (
      <div className="fixed inset-0 bg-white z-50 flex flex-col">
        {/* Barra superior */}
        <div className="flex-shrink-0 bg-white border-b border-gray-200 px-4 py-3 flex items-center gap-3 shadow-sm">
          <button
            onClick={cerrar}
            className="p-2 rounded-xl text-gray-500 hover:bg-gray-100 transition flex-shrink-0"
          >
            <ArrowLeft size={22} />
          </button>
          <div className="flex-1 min-w-0">
            <p className="font-bold text-gray-800 truncate">{seleccionada?.titulo || ""}</p>
            {seleccionada?.artista && (
              <p className="text-xs text-gray-500 truncate">{seleccionada.artista}</p>
            )}
          </div>
          {/* Control de transposición */}
          <div className="flex items-center gap-1 bg-gray-100 rounded-xl px-2 py-1.5 flex-shrink-0">
            <button
              onClick={() => setSemitonos(s => s - 1)}
              className="p-2 rounded-lg hover:bg-white transition text-gray-600"
              title="Bajar un semitono"
            >
              <ChevronDown size={18} />
            </button>
            <span className="text-sm font-bold text-violet-700 w-12 text-center select-none">
              {semitonos === 0 ? "Original" : semitonos > 0 ? `+${semitonos}` : semitonos}
            </span>
            <button
              onClick={() => setSemitonos(s => s + 1)}
              className="p-2 rounded-lg hover:bg-white transition text-gray-600"
              title="Subir un semitono"
            >
              <ChevronUp size={18} />
            </button>
            {semitonos !== 0 && (
              <button
                onClick={() => setSemitonos(0)}
                className="p-1.5 rounded-lg hover:bg-white transition text-gray-400"
                title="Restablecer tono original"
              >
                <X size={14} />
              </button>
            )}
          </div>
        </div>

        {/* Contenido scrolleable */}
        <div className="flex-1 overflow-y-auto px-5 py-5">
          {loadingCancion ? (
            <div className="flex items-center justify-center gap-2 h-full text-gray-400">
              <Loader2 size={24} className="animate-spin" /> Cargando...
            </div>
          ) : (
            <>
              {seleccionada.tono && (
                <div className="mb-5">
                  <span className="inline-block bg-violet-100 text-violet-700 text-sm font-semibold px-3 py-1 rounded-full">
                    Tono original: {seleccionada.tono}
                    {semitonos !== 0 && (
                      <span className="ml-1 text-violet-500">
                        → {transposeKey(seleccionada.tono, semitonos)}
                      </span>
                    )}
                  </span>
                </div>
              )}
              <ChordProRenderer contenido={seleccionada.contenido} transponer={semitonos} escala="grande" />
            </>
          )}
        </div>
      </div>
    );
  }

  // ──── Lista de canciones ────
  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="sticky top-0 z-30 bg-white border-b border-gray-200 px-4 py-3 flex items-center gap-3 shadow-sm">
        <button
          onClick={() => navigate("/portal")}
          className="p-1.5 rounded-lg text-gray-500 hover:bg-gray-100 transition"
        >
          <ArrowLeft size={20} />
        </button>
        <h1 className="font-bold text-gray-800 flex items-center gap-2 flex-1">
          <Music2 size={18} className="text-violet-500" /> Canciones
        </h1>
      </div>

      <div className="max-w-2xl mx-auto px-4 py-5 space-y-4">
        {/* Buscador */}
        <div className="relative">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            value={busqueda}
            onChange={e => setBusqueda(e.target.value)}
            placeholder="Buscar por título, artista o etiqueta..."
            className="w-full pl-9 pr-4 py-2.5 border border-gray-200 rounded-xl text-sm bg-white focus:outline-none focus:ring-2 focus:ring-violet-300"
          />
        </div>

        {/* Lista */}
        <div className="bg-white rounded-2xl shadow-sm divide-y divide-gray-100">
          {loading ? (
            <div className="flex items-center justify-center gap-2 py-12 text-gray-400 text-sm">
              <Loader2 size={18} className="animate-spin" /> Cargando canciones...
            </div>
          ) : cancionesFiltradas.length === 0 ? (
            <div className="py-12 text-center text-gray-400 text-sm">
              {busqueda ? "Sin resultados para esa búsqueda" : "Aún no hay canciones disponibles"}
            </div>
          ) : (
            cancionesFiltradas.map(c => (
              <button
                key={c.id}
                onClick={() => abrirCancion(c)}
                className="w-full text-left px-5 py-4 hover:bg-violet-50 transition"
              >
                <p className="font-semibold text-gray-800">{c.titulo}</p>
                <p className="text-sm text-gray-500 flex flex-wrap gap-x-2 mt-0.5">
                  {c.artista && <span>{c.artista}</span>}
                  {c.tono && (
                    <span className="text-violet-600 font-medium">Tono: {c.tono}</span>
                  )}
                  {c.tags && <span className="text-gray-400 text-xs">{c.tags}</span>}
                </p>
              </button>
            ))
          )}
        </div>
      </div>
    </div>
  );
}

// Transpone la nota raíz de un tono para mostrar en la UI
const NOTAS = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"];
const ENARM = { Db: "C#", Eb: "D#", Gb: "F#", Ab: "G#", Bb: "A#" };
function transposeKey(tono, semitonos) {
  const root = tono.match(/^([A-G][b#]?)/)?.[1];
  if (!root) return tono;
  const base = ENARM[root] || root;
  const idx = NOTAS.indexOf(base);
  if (idx === -1) return tono;
  const nuevo = NOTAS[((idx + semitonos) % 12 + 12) % 12];
  return tono.replace(/^[A-G][b#]?/, nuevo);
}
