import React, { useMemo } from "react";

const NOTAS_STD = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"];
const ENARM = { "Db": "C#", "Eb": "D#", "Fb": "E", "Gb": "F#", "Ab": "G#", "Bb": "A#", "Cb": "B" };

function transponerNota(nota, semitonos) {
  if (!semitonos) return nota;
  const base = ENARM[nota] || nota;
  const idx = NOTAS_STD.indexOf(base);
  if (idx === -1) return nota;
  return NOTAS_STD[((idx + semitonos) % 12 + 12) % 12];
}

function transponerAcorde(acorde, semitonos) {
  if (!semitonos) return acorde;
  return acorde.replace(/^([A-G][b#]?)/, (_, root) => transponerNota(root, semitonos));
}

/**
 * Valida si el contenido de un bracket es un acorde musical real.
 * Ejemplos válidos: A, Bm, C#7, Dm7, E/G#, F#maj7, Gsus4, Bb, N.C.
 * No válidos: Coro, Verso, Final, Pre-Coro, Titulo, Intro, etc.
 */
const ACORDE_MUSICAL_RE = /^[A-G][b#]?(?:m(?:aj)?(?:7|9|11|13)?|min|dim(?:7)?|aug|sus[24]?|add\d+|maj\d+|\d+)?(?:\/[A-G][b#]?)?$/;

function esAcordeMusical(str) {
  const s = str.trim();
  return ACORDE_MUSICAL_RE.test(s) || /^[Nn]\.?[Cc]\.?$/.test(s);
}

/**
 * Parsea una línea con acordes.
 * Cada [Acorde] va sobre el texto que le SIGUE.
 * [A]Ale[D]lu[A]ya → [{A,"Ale"},{D,"lu"},{A,"ya"}]
 */
function parsearLineaAcordes(linea) {
  const re = /\[([^\]]+)\]/g;
  const matches = [];
  let m;
  while ((m = re.exec(linea)) !== null) {
    matches.push({ acorde: m[1], start: m.index, end: m.index + m[0].length });
  }
  if (!matches.length) return [{ acorde: null, texto: linea }];

  const partes = [];
  if (matches[0].start > 0) {
    partes.push({ acorde: null, texto: linea.slice(0, matches[0].start) });
  }
  for (let i = 0; i < matches.length; i++) {
    const textEnd = i + 1 < matches.length ? matches[i + 1].start : linea.length;
    partes.push({ acorde: matches[i].acorde, texto: linea.slice(matches[i].end, textEnd) });
  }
  return partes;
}

function tieneAcordes(linea) {
  return /\[[^\]]+\]/.test(linea);
}

/**
 * Detecta si una línea entre corchetes es una etiqueta de sección y NO un acorde musical.
 * Soporta: [Coro], [Verso], [Pre-Coro], [Final], [Titulo], [Intro], etc.
 * Un bracket con contenido que no es acorde musical → etiqueta.
 */
const PATRON_SECCION = /^(coro|verso|puente|intro|outro|bridge|chorus|verse|pre-?coro|pre-?chorus|estrofa|interludio|interlude|refrain|tag|final|fin|bis|solo|titulo|title|chorus|refran|refrán)\b/i;

function detectarEtiqueta(partes) {
  // Una sola parte, todo dentro de corchetes, sin texto fuera → posible etiqueta
  if (partes.length === 1 && partes[0].acorde !== null && !(partes[0].texto || "").trim()) {
    if (!esAcordeMusical(partes[0].acorde)) {
      return partes[0].acorde.trim();
    }
  }
  return null;
}

export default function ChordProRenderer({ contenido = "", transponer = 0, escala = "normal" }) {
  const grande = escala === "grande";
  const bloques = useMemo(() => {
    if (!contenido.trim()) return [];
    const lineas = contenido.split("\n");
    const result = [];
    let seccionActual = null;

    for (const linea of lineas) {
      const trimmed = linea.trim();

      // Directivas de metadatos — ignorar
      if (/^\{(title|t|artist|st|subtitle|key|capo|tempo|time)[:\s]/i.test(trimmed)) continue;

      // Marcadores de sección
      if (/^\{(soc|start_of_chorus)\}/i.test(trimmed)) { seccionActual = "coro"; continue; }
      if (/^\{(eoc|end_of_chorus)\}/i.test(trimmed)) { seccionActual = null; result.push({ tipo: "fin_coro" }); continue; }
      if (/^\{(sos|start_of_solo)\}/i.test(trimmed)) { seccionActual = "solo"; continue; }
      if (/^\{(eos|end_of_solo)\}/i.test(trimmed)) { seccionActual = null; continue; }
      if (/^\{(sov|start_of_verse)\}/i.test(trimmed)) { seccionActual = "verso"; continue; }
      if (/^\{(eov|end_of_verse)\}/i.test(trimmed)) { seccionActual = null; continue; }

      // Comentario / etiqueta explícita
      const comentarioMatch = trimmed.match(/^\{(?:comment|c|x_comment):\s*(.+)\}/i);
      if (comentarioMatch) {
        result.push({ tipo: "etiqueta", texto: comentarioMatch[1] });
        continue;
      }

      // Línea vacía
      if (!trimmed) {
        if (result.length && result[result.length - 1]?.tipo !== "espacio") {
          result.push({ tipo: "espacio" });
        }
        continue;
      }

      // Línea de texto plano que es una etiqueta de sección (p.ej. "Coro:", "Verso 1")
      const textoSinPuntuacion = trimmed.replace(/[:\.\-]/g, "").trim();
      if (!tieneAcordes(trimmed) && PATRON_SECCION.test(textoSinPuntuacion)) {
        result.push({ tipo: "etiqueta", texto: trimmed });
        continue;
      }

      // Línea con acordes
      if (tieneAcordes(trimmed)) {
        const partesRaw = parsearLineaAcordes(trimmed);

        // ¿Es en realidad una etiqueta escrita con acorde? p.ej. [C]oro
        const etiqueta = detectarEtiqueta(partesRaw);
        if (etiqueta) {
          result.push({ tipo: "etiqueta", texto: etiqueta });
          continue;
        }

        // Línea musical real — transponemos solo los acordes
        const partes = partesRaw.map(p => ({
          ...p,
          acorde: p.acorde ? transponerAcorde(p.acorde, transponer) : null,
        }));
        result.push({ tipo: "linea_acordes", partes, seccion: seccionActual });
        continue;
      }

      // Letra pura
      result.push({ tipo: "linea_letra", texto: trimmed, seccion: seccionActual });
    }

    return result;
  }, [contenido, transponer]);

  if (!bloques.length) {
    return <p className="text-gray-400 text-sm italic">Sin contenido</p>;
  }

  return (
    <div className={`font-sans leading-relaxed select-text ${grande ? "text-lg" : "text-sm"}`}>
      {bloques.map((bloque, i) => {
        if (bloque.tipo === "fin_coro") return null;

        if (bloque.tipo === "espacio") {
          return <div key={i} className="h-3" />;
        }

        // Etiqueta de sección — color ámbar, claramente distinto de los acordes
        if (bloque.tipo === "etiqueta") {
          return (
            <p key={i} className={`text-amber-600 font-bold uppercase tracking-widest mt-4 mb-1 ${
              grande ? "text-base" : "text-xs"
            }`}>
              {bloque.texto}
            </p>
          );
        }

        const esCoro = bloque.seccion === "coro";
        const wrapClass = esCoro
          ? "border-l-2 border-violet-300 pl-3 bg-violet-50/40 rounded-r-sm"
          : "";

        if (bloque.tipo === "linea_acordes") {
          const hayAcordes = bloque.partes.some(p => p.acorde);
          return (
            <div key={i} className={`${wrapClass} my-0.5`}>
              <div className="flex flex-wrap items-end" style={{ lineHeight: 1 }}>
                {bloque.partes.map((parte, j) => (
                  <span key={j} className="inline-flex flex-col items-start">
                    <span
                      className={`block font-bold leading-tight mb-[3px] whitespace-pre ${
                        grande ? "text-[20px]" : "text-[13px]"
                      } ${
                        parte.acorde ? "text-violet-700" : "opacity-0 select-none pointer-events-none"
                      }`}
                    >
                      {parte.acorde || (hayAcordes ? "\u00a0" : "")}
                    </span>
                    <span className={`block text-gray-700 leading-snug whitespace-pre ${
                      grande ? "text-xl" : "text-sm"
                    }`}>
                      {parte.texto || (parte.acorde ? "\u00a0" : "")}
                    </span>
                  </span>
                ))}
              </div>
            </div>
          );
        }

        if (bloque.tipo === "linea_letra") {
          return (
            <div key={i} className={`${wrapClass}`}>
              <p className={`text-gray-700 leading-snug whitespace-pre-wrap ${
                grande ? "text-xl" : "text-sm"
              }`}>{bloque.texto}</p>
            </div>
          );
        }

        return null;
      })}
    </div>
  );
}

