import React, { useMemo } from "react";

/**
 * Renderiza contenido en formato ChordPro.
 *
 * Soporta:
 *   {title:}, {artist:}, {key:}, {capo:}, {tempo:}
 *   {soc}/{eoc} — inicio/fin de coro
 *   {sos}/{eos} — inicio/fin de solo
 *   {sov}/{eov} — inicio/fin de verso
 *   {comment: texto} / {c: texto}
 *   [Acorde] inline con letra
 *
 * Props:
 *   contenido  — string ChordPro
 *   transponer — número de semitonos (+/-)
 */

const NOTAS_STD = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"];
const ENARM = { "Db": "C#", "Eb": "D#", "Fb": "E", "Gb": "F#", "Ab": "G#", "Bb": "A#", "Cb": "B" };

function transponerNota(nota, semitonos) {
  if (!semitonos) return nota;
  const base = ENARM[nota] || nota;
  const idx = NOTAS_STD.indexOf(base);
  if (idx === -1) return nota;
  const nuevo = NOTAS_STD[((idx + semitonos) % 12 + 12) % 12];
  return nuevo;
}

function transponerAcorde(acorde, semitonos) {
  if (!semitonos) return acorde;
  // Match root + optional sharp/flat + suffix
  return acorde.replace(/^([A-G][b#]?)/, (_, root) => transponerNota(root, semitonos));
}

/** Divide una línea con acordes en pares [{acorde, texto}] */
function parsearLineaAcordes(linea) {
  const partes = [];
  const re = /\[([^\]]+)\]/g;
  let lastIdx = 0;
  let match;
  while ((match = re.exec(linea)) !== null) {
    const textoAntes = linea.slice(lastIdx, match.index);
    partes.push({ acorde: match[1], texto: textoAntes });
    lastIdx = match.index + match[0].length;
  }
  const restoTexto = linea.slice(lastIdx);
  if (restoTexto) partes.push({ acorde: null, texto: restoTexto });
  return partes;
}

/** Verifica si una línea contiene acordes */
function tieneAcordes(linea) {
  return /\[[^\]]+\]/.test(linea);
}

export default function ChordProRenderer({ contenido = "", transponer = 0 }) {
  const bloques = useMemo(() => {
    if (!contenido.trim()) return [];

    const lineas = contenido.split("\n");
    const result = [];
    let seccionActual = null; // "coro" | "solo" | "verso" | null

    for (const linea of lineas) {
      const trimmed = linea.trim();

      // Directivas de metadatos (omitir del render — se muestran en encabezado)
      if (/^\{(title|t|artist|st|subtitle|key|capo|tempo|time)[:\s]/i.test(trimmed)) continue;

      // Inicio de sección
      if (/^\{(soc|start_of_chorus)\}/i.test(trimmed)) { seccionActual = "coro"; continue; }
      if (/^\{(eoc|end_of_chorus)\}/i.test(trimmed)) { seccionActual = null; result.push({ tipo: "fin_coro" }); continue; }
      if (/^\{(sos|start_of_solo)\}/i.test(trimmed)) { seccionActual = "solo"; continue; }
      if (/^\{(eos|end_of_solo)\}/i.test(trimmed)) { seccionActual = null; continue; }
      if (/^\{(sov|start_of_verse)\}/i.test(trimmed)) { seccionActual = "verso"; continue; }
      if (/^\{(eov|end_of_verse)\}/i.test(trimmed)) { seccionActual = null; continue; }

      // Comentario / label de sección
      const comentarioMatch = trimmed.match(/^\{(?:comment|c|x_comment):\s*(.+)\}/i);
      if (comentarioMatch) {
        result.push({ tipo: "comentario", texto: comentarioMatch[1] });
        continue;
      }

      // Inicio de coro sin marcador explícito pero con etiqueta "Coro:" en comentario — ya manejado arriba

      // Línea vacía
      if (!trimmed) {
        if (result.length && result[result.length - 1]?.tipo !== "espacio") {
          result.push({ tipo: "espacio" });
        }
        continue;
      }

      // Línea con acordes
      if (tieneAcordes(trimmed)) {
        const partes = parsearLineaAcordes(trimmed).map(p => ({
          ...p,
          acorde: p.acorde ? transponerAcorde(p.acorde, transponer) : null,
        }));
        result.push({ tipo: "linea_acordes", partes, seccion: seccionActual });
        continue;
      }

      // Línea de letra pura
      result.push({ tipo: "linea_letra", texto: trimmed, seccion: seccionActual });
    }

    return result;
  }, [contenido, transponer]);

  if (!bloques.length) {
    return <p className="text-gray-400 text-sm italic">Sin contenido</p>;
  }

  let enCoro = false;

  return (
    <div className="font-sans text-sm leading-relaxed select-text">
      {bloques.map((bloque, i) => {
        if (bloque.tipo === "fin_coro") { enCoro = false; return null; }
        if (bloque.seccion === "coro" && !enCoro) enCoro = true;

        if (bloque.tipo === "espacio") {
          return <div key={i} className="h-3" />;
        }

        if (bloque.tipo === "comentario") {
          return (
            <p key={i} className="text-violet-600 font-semibold text-xs uppercase tracking-wide mt-4 mb-1">
              {bloque.texto}
            </p>
          );
        }

        const esCoroBloque = bloque.seccion === "coro";
        const wrapClass = esCoroBloque
          ? "border-l-2 border-violet-300 pl-3 bg-violet-50/40 rounded-r-sm"
          : "";

        if (bloque.tipo === "linea_acordes") {
          return (
            <div key={i} className={`${wrapClass}`}>
              <div className="flex flex-wrap items-end gap-0 whitespace-pre">
                {bloque.partes.map((parte, j) => (
                  <span key={j} className="inline-flex flex-col items-start">
                    {parte.acorde ? (
                      <span className="text-violet-700 font-bold text-[13px] leading-none mb-0.5 min-w-[0.5rem]">
                        {parte.acorde}
                      </span>
                    ) : (
                      <span className="text-[13px] leading-none mb-0.5 opacity-0 select-none">-</span>
                    )}
                    <span className="text-gray-700 text-sm leading-snug whitespace-pre">{parte.texto || " "}</span>
                  </span>
                ))}
              </div>
            </div>
          );
        }

        if (bloque.tipo === "linea_letra") {
          return (
            <div key={i} className={`${wrapClass}`}>
              <p className="text-gray-700 text-sm leading-snug whitespace-pre-wrap">{bloque.texto}</p>
            </div>
          );
        }

        return null;
      })}
    </div>
  );
}
