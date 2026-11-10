// Convierte una página HTML (de Gutenberg o de dentro de un ePub) en capítulos.
// Idea: los encabezados (<h1>…<h6>) marcan dónde empieza cada capítulo, y
// todo lo demás se reduce a párrafos de texto sin etiquetas.

import { decodificarHtml } from "../texto";
import type { Capitulo } from "./tipos";

// Etiquetas que separan bloques de texto.
const BLOQUES =
  "p|div|li|ul|ol|blockquote|pre|tr|table|section|article|header|footer|hr|dl|dt|dd|figure|figcaption|center";

// Marcas internas (caracteres que nunca aparecen en un libro).
const ENCABEZADO = "\u0001";
const SALTO = "\u0002";

export function htmlACapitulos(html: string): Capitulo[] {
  const limpio = html
    .replace(/<!--[\s\S]*?-->/g, "")
    .replace(/<(script|style|head|svg)\b[\s\S]*?<\/\1>/gi, "");
  const cuerpo = limpio.match(/<body[^>]*>([\s\S]*)<\/body>/i)?.[1] ?? limpio;

  const texto = cuerpo
    // Los saltos de línea del archivo no significan nada en HTML.
    .replace(/\s+/g, " ")
    // Encabezado → bloque propio que empieza con la marca y su nivel (1-6).
    .replace(
      /<h([1-6])\b[^>]*>([\s\S]*?)<\/h\1>/gi,
      (_, nivel, contenido) =>
        `\n\n${ENCABEZADO}${nivel}${contenido.replace(/<br\s*\/?>/gi, " ")}\n\n`,
    )
    // <br> (salto dentro de un párrafo, p. ej. versos) → marca de salto.
    .replace(/<br\s*\/?>/gi, SALTO)
    // Cualquier etiqueta de bloque → separación entre párrafos.
    .replace(new RegExp(`</?(?:${BLOQUES})\\b[^>]*>`, "gi"), "\n\n")
    // El resto de etiquetas (cursivas, enlaces…) simplemente se quitan.
    .replace(/<[^>]+>/g, "");

  const capitulos: Capitulo[] = [];
  let actual: Capitulo = { titulo: "", parrafos: [] };
  let nivelActual = 0;

  for (const bloque of texto.split("\n\n")) {
    const esEncabezado = bloque.startsWith(ENCABEZADO);
    const contenido = decodificarHtml(esEncabezado ? bloque.slice(2) : bloque)
      .replace(new RegExp(`\\s*${SALTO}\\s*`, "g"), "\n")
      .trim();
    if (!contenido) continue;

    if (!esEncabezado) {
      actual.parrafos.push(contenido);
      continue;
    }

    const nivel = Number(bloque[1]);
    if (actual.parrafos.length > 0) {
      // El capítulo anterior ya tenía texto: se cierra y empieza otro.
      capitulos.push(actual);
      actual = { titulo: contenido, parrafos: [] };
    } else if (actual.titulo && nivel > nivelActual) {
      // Dos encabezados seguidos y el segundo es menor: es un subtítulo.
      actual.titulo = `${actual.titulo}. ${contenido}`;
    } else {
      actual.titulo = contenido;
    }
    nivelActual = nivel;
  }
  capitulos.push(actual);

  return capitulos.filter((c) => c.parrafos.length > 0);
}
