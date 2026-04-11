import React, { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import AdminNav from "../components/AdminNav";
import { Music2, Plus, Pencil, Trash2, X, Save, Loader2, Eye, EyeOff, Search, Upload, ArrowLeft, CheckSquare, Square } from "lucide-react";
import ChordProRenderer from "../components/ChordProRenderer";

const API = import.meta.env.VITE_BACKEND_URL;

const FORM_VACIO = { titulo: "", artista: "", tono: "", tags: "", contenido: "" };

/** Extrae texto de un PDF usando pdfjs-dist (carga dinámica para no penalizar el bundle) */
async function extraerTextoPDF(file) {
  const { default: pdfjsLib } = await import("pdfjs-dist");
  pdfjsLib.GlobalWorkerOptions.workerSrc = new URL(
    "pdfjs-dist/build/pdf.worker.min.mjs",
    import.meta.url
  ).href;
  const arrayBuffer = await file.arrayBuffer();
  const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
  let texto = "";
  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i);
    const content = await page.getTextContent();
    texto += content.items.map(item => item.str).join(" ") + "\n";
  }
  return texto.trim();
}

/** Detecta si una línea es "texto plano" (no es acorde ni directiva) */
function esLineaPlana(linea) {
  const l = linea.trim();
  if (!l) return false;
  if (l.startsWith("{")) return false;       // directiva ChordPro
  if (/\[[A-G][^\]]*\]/.test(l)) return false; // contiene acorde
  if (l.length > 70) return false;             // probablemente letra larga
  return true;
}

/**
 * Extrae artista del contenido del archivo.
 * - Ignora la línea 1 (es el título en el archivo).
 * - Busca la PRIMERA línea plana a partir de la línea 2.
 * - También intenta directivas {artist:} / {composer:}.
 */
function parsearMetadatos(contenido) {
  const get = (key) => {
    const m = contenido.match(new RegExp(`\\{(?:${key}):\\s*([^}]+)\\}`, "i"));
    return m ? m[1].trim() : "";
  };
  const tono = get("key");
  const artista = get("artist|composer|a") || (() => {
    const lineas = contenido.split("\n");
    // Saltamos la línea 0 (es el título del archivo)
    for (let i = 1; i < Math.min(lineas.length, 6); i++) {
      if (esLineaPlana(lineas[i])) return lineas[i].trim();
    }
    return "";
  })();
  return { artista, tono };
}

export default function AdminChordPro() {
  const navigate = useNavigate();
  const { getToken } = useAuth();
  const [canciones, setCanciones] = useState([]);
  const [loading, setLoading] = useState(true);
  const [busqueda, setBusqueda] = useState("");

  // Modal crear/editar
  const [modal, setModal] = useState(null); // null | "nuevo" | { ...cancion }
  const [form, setForm] = useState(FORM_VACIO);
  const [guardando, setGuardando] = useState(false);
  const [errorForm, setErrorForm] = useState(null);

  // Vista previa en modal
  const [preview, setPreview] = useState(false);

  // Importar archivos
  const inputRef = useRef(null);
  const [importando, setImportando] = useState(false);
  const [importError, setImportError] = useState(null);

  // Selección para borrado en lote
  const [seleccionados, setSeleccionados] = useState(new Set());
  const [borrandoLote, setBorrandoLote] = useState(false);

  // Confirmar borrado individual
  const [borrandoId, setBorrandoId] = useState(null);

  const hdrs = () => ({ Authorization: `Bearer ${getToken()}`, "Content-Type": "application/json" });

  const cargar = async () => {
    setLoading(true);
    try {
      const r = await fetch(`${API}/api/chordpro`, { headers: hdrs() });
      setCanciones(await r.json());
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { cargar(); }, []);

  const abrirNuevo = () => {
    setForm(FORM_VACIO);
    setErrorForm(null);
    setPreview(false);
    setModal("nuevo");
  };

  const abrirEditar = async (cancion) => {
    setPreview(false);
    setErrorForm(null);
    // Cargar contenido completo
    const r = await fetch(`${API}/api/chordpro/${cancion.id}`, { headers: hdrs() });
    const data = await r.json();
    setForm({ titulo: data.titulo, artista: data.artista || "", tono: data.tono || "", tags: data.tags || "", contenido: data.contenido });
    setModal(data);
  };

  const cerrarModal = () => { setModal(null); setErrorForm(null); };

  const guardar = async () => {
    if (!form.titulo.trim()) { setErrorForm("El título es obligatorio"); return; }
    if (!form.contenido.trim()) { setErrorForm("El contenido ChordPro no puede estar vacío"); return; }
    setGuardando(true);
    setErrorForm(null);
    try {
      const esEdicion = modal && modal !== "nuevo";
      const url = esEdicion ? `${API}/api/chordpro/${modal.id}` : `${API}/api/chordpro`;
      const r = await fetch(url, {
        method: esEdicion ? "PUT" : "POST",
        headers: hdrs(),
        body: JSON.stringify(form),
      });
      const data = await r.json();
      if (!r.ok) { setErrorForm(data.error || "Error al guardar"); return; }
      await cargar();
      cerrarModal();
    } catch {
      setErrorForm("Error de red");
    } finally {
      setGuardando(false);
    }
  };

  const borrar = async (id) => {
    await fetch(`${API}/api/chordpro/${id}`, { method: "DELETE", headers: hdrs() });
    setBorrandoId(null);
    await cargar();
  };

  const borrarSeleccionados = async () => {
    const ids = Array.from(seleccionados);
    await fetch(`${API}/api/chordpro`, {
      method: "DELETE",
      headers: hdrs(),
      body: JSON.stringify({ ids }),
    });
    setSeleccionados(new Set());
    setBorrandoLote(false);
    await cargar();
  };

  const toggleSeleccion = (id) => {
    setSeleccionados(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const toggleTodos = () => {
    if (seleccionados.size === cancionesFiltradas.length) {
      setSeleccionados(new Set());
    } else {
      setSeleccionados(new Set(cancionesFiltradas.map(c => c.id)));
    }
  };

  /** Importar uno o varios archivos .txt / .cho / .pdf */
  const importarArchivos = async (files) => {
    if (!files?.length) return;
    setImportando(true);
    setImportError(null);
    let importados = 0;
    const errores = [];
    for (const file of Array.from(files)) {
      try {
        let contenido = "";
        const ext = file.name.split(".").pop().toLowerCase();
        if (ext === "pdf") {
          contenido = await extraerTextoPDF(file);
        } else {
          // .txt y .cho: texto plano
          contenido = await file.text();
        }
        if (!contenido.trim()) { errores.push(`${file.name}: archivo vacío`); continue; }
        // Título siempre desde el nombre del archivo
        const titulo = file.name.replace(/\.[^.]+$/, "");
        const meta = parsearMetadatos(contenido);
        const r = await fetch(`${API}/api/chordpro`, {
          method: "POST",
          headers: hdrs(),
          body: JSON.stringify({ titulo, artista: meta.artista, tono: meta.tono, tags: ext === "cho" ? "cho" : "", contenido }),
        });
        if (!r.ok) { const d = await r.json(); errores.push(`${file.name}: ${d.error}`); continue; }
        importados++;
      } catch (e) {
        errores.push(`${file.name}: ${e.message}`);
      }
    }
    await cargar();
    setImportando(false);
    if (errores.length) setImportError(`Importados: ${importados}. Errores: ${errores.join(" | ")}`);
    else if (importados > 0) setImportError(`✓ ${importados} canción${importados > 1 ? "es" : ""} importada${importados > 1 ? "s" : ""} correctamente`);
    if (inputRef.current) inputRef.current.value = "";
  };

  const cancionesFiltradas = canciones.filter(c =>
    c.titulo.toLowerCase().includes(busqueda.toLowerCase()) ||
    (c.artista || "").toLowerCase().includes(busqueda.toLowerCase()) ||
    (c.tags || "").toLowerCase().includes(busqueda.toLowerCase())
  );

  const todosSeleccionados = cancionesFiltradas.length > 0 && seleccionados.size === cancionesFiltradas.length;

  return (
    <div className="min-h-screen bg-gray-50">
      <AdminNav />

      <div className="max-w-4xl mx-auto px-4 py-8 space-y-5">
        {/* Encabezado */}
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <button
              onClick={() => navigate("/admin/musica")}
              className="p-1.5 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-200 transition"
              title="Volver a Música"
            >
              <ArrowLeft size={18} />
            </button>
            <h1 className="text-xl font-bold text-gray-800 flex items-center gap-2">
              <Music2 size={20} className="text-violet-500" />
              Canciones (ChordPro)
            </h1>
          </div>
          <div className="flex items-center gap-2">
            {/* Importar */}
            <input
              ref={inputRef}
              type="file"
              accept=".txt,.cho,.pdf"
              multiple
              className="hidden"
              onChange={e => importarArchivos(e.target.files)}
            />
            <button
              onClick={() => { setImportError(null); inputRef.current?.click(); }}
              disabled={importando}
              className="flex items-center gap-2 bg-gray-100 hover:bg-gray-200 disabled:opacity-50 text-gray-700 px-4 py-2 rounded-xl text-sm font-semibold transition"
              title="Importar .txt, .cho o .pdf"
            >
              {importando ? <Loader2 size={15} className="animate-spin" /> : <Upload size={15} />}
              {importando ? "Importando..." : "Importar"}
            </button>
            <button
              onClick={abrirNuevo}
              className="flex items-center gap-2 bg-violet-600 hover:bg-violet-700 text-white px-4 py-2 rounded-xl text-sm font-semibold transition"
            >
              <Plus size={16} /> Nueva canción
            </button>
          </div>
        </div>

        {/* Mensaje de importación */}
        {importError && (
          <div className={`flex items-start justify-between gap-3 rounded-xl px-4 py-3 text-sm ${importError.startsWith("✓") ? "bg-green-50 text-green-700" : "bg-amber-50 text-amber-700"}`}>
            <span>{importError}</span>
            <button onClick={() => setImportError(null)} className="flex-shrink-0 opacity-60 hover:opacity-100">
              <X size={15} />
            </button>
          </div>
        )}

        {/* Buscador + barra de selecci\u00f3n */}
        <div className="flex items-center gap-3">
          <div className="relative flex-1">
            <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              value={busqueda}
              onChange={e => setBusqueda(e.target.value)}
              placeholder="Buscar por t\u00edtulo, artista o etiqueta..."
              className="w-full pl-9 pr-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-violet-300"
            />
          </div>
          {seleccionados.size > 0 && (
            <button
              onClick={() => setBorrandoLote(true)}
              className="flex items-center gap-2 bg-red-600 hover:bg-red-700 text-white px-4 py-2.5 rounded-xl text-sm font-semibold transition flex-shrink-0"
            >
              <Trash2 size={15} /> Borrar {seleccionados.size}
            </button>
          )}
        </div>

        {/* Lista */}
        <div className="bg-white rounded-2xl shadow-sm divide-y divide-gray-100">
          {/* Fila de cabecera con "seleccionar todas" */}
          {!loading && cancionesFiltradas.length > 0 && (
            <div className="flex items-center gap-3 px-5 py-3 bg-gray-50 rounded-t-2xl">
              <button onClick={toggleTodos} className="flex items-center gap-2 text-sm text-gray-500 hover:text-gray-700 transition">
                {todosSeleccionados
                  ? <CheckSquare size={17} className="text-violet-600" />
                  : <Square size={17} />}
                <span>{todosSeleccionados ? "Deseleccionar todas" : "Seleccionar todas"}</span>
              </button>
              {seleccionados.size > 0 && (
                <span className="text-xs text-violet-600 font-medium">{seleccionados.size} seleccionada{seleccionados.size > 1 ? "s" : ""}</span>
              )}
            </div>
          )}

          {loading ? (
            <div className="flex items-center justify-center gap-2 py-12 text-gray-400 text-sm">
              <Loader2 size={18} className="animate-spin" /> Cargando...
            </div>
          ) : cancionesFiltradas.length === 0 ? (
            <div className="py-12 text-center text-gray-400 text-sm">
              {busqueda ? "Sin resultados" : "A\u00fan no hay canciones \u2014 agrega la primera"}
            </div>
          ) : (
            cancionesFiltradas.map(c => {
              const selec = seleccionados.has(c.id);
              return (
                <div
                  key={c.id}
                  className={`flex items-center gap-3 px-5 py-4 transition ${selec ? "bg-violet-50" : ""}`}
                >
                  <button onClick={() => toggleSeleccion(c.id)} className="flex-shrink-0 text-gray-300 hover:text-violet-500 transition">
                    {selec ? <CheckSquare size={18} className="text-violet-600" /> : <Square size={18} />}
                  </button>
                  <div className="min-w-0 flex-1">
                    <p className="font-semibold text-gray-800 truncate">{c.titulo}</p>
                    <p className="text-sm text-gray-500 truncate">
                      {c.artista && <span>{c.artista}</span>}
                      {c.artista && c.tono && <span className="mx-1 text-gray-300">\u00b7</span>}
                      {c.tono && <span className="text-violet-600 font-medium">Tono: {c.tono}</span>}
                      {c.tags && <span className="ml-2 text-xs text-gray-400">{c.tags}</span>}
                    </p>
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    <button
                      onClick={() => abrirEditar(c)}
                      className="p-2 rounded-lg text-gray-400 hover:text-violet-600 hover:bg-violet-50 transition"
                      title="Editar"
                    >
                      <Pencil size={16} />
                    </button>
                    <button
                      onClick={() => setBorrandoId(c.id)}
                      className="p-2 rounded-lg text-gray-400 hover:text-red-500 hover:bg-red-50 transition"
                      title="Eliminar"
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* Modal crear/editar */}
      {modal !== null && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-start justify-center p-4 overflow-y-auto">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-3xl my-8">
            {/* Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
              <h2 className="font-bold text-gray-800">
                {modal === "nuevo" ? "Nueva canción" : "Editar canción"}
              </h2>
              <button onClick={cerrarModal} className="text-gray-400 hover:text-gray-600">
                <X size={20} />
              </button>
            </div>

            <div className="p-6 space-y-4">
              {/* Campos de metadatos */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Título *</label>
                  <input
                    type="text"
                    value={form.titulo}
                    onChange={e => setForm(f => ({ ...f, titulo: e.target.value }))}
                    placeholder="Nombre de la canción"
                    className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-violet-300"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Artista</label>
                  <input
                    type="text"
                    value={form.artista}
                    onChange={e => setForm(f => ({ ...f, artista: e.target.value }))}
                    placeholder="Ej: Hillsong, Marcos Witt..."
                    className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-violet-300"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Tono</label>
                  <input
                    type="text"
                    value={form.tono}
                    onChange={e => setForm(f => ({ ...f, tono: e.target.value }))}
                    placeholder="Ej: G, Am, Bb..."
                    className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-violet-300"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Etiquetas</label>
                  <input
                    type="text"
                    value={form.tags}
                    onChange={e => setForm(f => ({ ...f, tags: e.target.value }))}
                    placeholder="Ej: adoracion, alabanza, coro"
                    className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-violet-300"
                  />
                </div>
              </div>

              {/* Contenido ChordPro */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Contenido ChordPro *</label>
                  <button
                    onClick={() => setPreview(v => !v)}
                    className="flex items-center gap-1.5 text-xs text-violet-600 hover:text-violet-800 font-medium transition"
                  >
                    {preview ? <EyeOff size={13} /> : <Eye size={13} />}
                    {preview ? "Editar" : "Vista previa"}
                  </button>
                </div>
                {preview ? (
                  <div className="border border-gray-200 rounded-xl p-4 min-h-[240px] bg-white overflow-auto">
                    <ChordProRenderer contenido={form.contenido} />
                  </div>
                ) : (
                  <textarea
                    value={form.contenido}
                    onChange={e => setForm(f => ({ ...f, contenido: e.target.value }))}
                    rows={14}
                    placeholder={`{title: Nombre de la canción}\n{key: G}\n\n[G]Letra de la [C]canción aquí\n[Am]con acordes [G]inline`}
                    className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-violet-300 resize-y"
                    spellCheck={false}
                  />
                )}
              </div>

              {errorForm && <p className="text-red-500 text-sm">{errorForm}</p>}

              <div className="flex justify-end gap-3 pt-2">
                <button onClick={cerrarModal} className="px-4 py-2 rounded-xl text-sm text-gray-600 hover:bg-gray-100 transition">
                  Cancelar
                </button>
                <button
                  onClick={guardar}
                  disabled={guardando}
                  className="flex items-center gap-2 bg-violet-600 hover:bg-violet-700 disabled:opacity-50 text-white px-5 py-2 rounded-xl text-sm font-semibold transition"
                >
                  {guardando ? <Loader2 size={15} className="animate-spin" /> : <Save size={15} />}
                  {guardando ? "Guardando..." : "Guardar"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Confirmar borrado individual */}
      {borrandoId && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-xl p-6 max-w-sm w-full space-y-4">
            <h3 className="font-bold text-gray-800">¿Eliminar canción?</h3>
            <p className="text-sm text-gray-500">Esta acción no se puede deshacer.</p>
            <div className="flex justify-end gap-3">
              <button onClick={() => setBorrandoId(null)} className="px-4 py-2 rounded-xl text-sm text-gray-600 hover:bg-gray-100 transition">
                Cancelar
              </button>
              <button
                onClick={() => borrar(borrandoId)}
                className="px-4 py-2 rounded-xl text-sm bg-red-600 hover:bg-red-700 text-white font-semibold transition"
              >
                Eliminar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Confirmar borrado en lote */}
      {borrandoLote && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-xl p-6 max-w-sm w-full space-y-4">
            <h3 className="font-bold text-gray-800">¿Eliminar {seleccionados.size} canción{seleccionados.size > 1 ? "es" : ""}?</h3>
            <p className="text-sm text-gray-500">Esta acción no se puede deshacer.</p>
            <div className="flex justify-end gap-3">
              <button onClick={() => setBorrandoLote(false)} className="px-4 py-2 rounded-xl text-sm text-gray-600 hover:bg-gray-100 transition">
                Cancelar
              </button>
              <button
                onClick={borrarSeleccionados}
                className="px-4 py-2 rounded-xl text-sm bg-red-600 hover:bg-red-700 text-white font-semibold transition"
              >
                Eliminar todas
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
