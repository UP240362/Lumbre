// Convierte texto plano en capítulos. Se usa para Internet Archive, cuyo
// texto sale de escanear libros en papel (OCR): viene cortado en renglones,
// con números de página sueltos y sin capítulos marcados.

import type { Capitulo } from "./tipos";

// Un renglón corto que empieza así se toma como inicio de capítulo.
const PARECE_TITULO =
  /^(cap[ií]tulo|parte|libro|acto|escena|jornada|canto|pr[oó]logo|ep[ií]logo|introducci[oó]n|dedicatoria|advertencia)\b/i;
const NUMERO_ROMANO = /^[IVXLCDM]{1,7}\.?$/;

export function pareceTitulo(renglon: string): boolean {
  return (
    renglon.length <= 90 &&
    (PARECE_TITULO.test(renglon) || NUMERO_ROMANO.test(renglon))
  );
}

export function textoACapitulos(texto: string): Capitulo[] {
  const parrafos = texto
    .replace(/\r\n?/g, "\n")
    .replace(/\f/g, "\n\n")
    // Una línea en blanco (o más) separa párrafos.
    .split(/\n[ \t]*\n+/)
    .map((bloque) =>
      bloque
        // "pala-\nbra" → "palabra": une palabras cortadas al final del renglón.
        .replace(/(\p{L})[-¬]\n\s*(\p{Ll})/gu, "$1$2")
        // Los renglones de un mismo párrafo se unen con un espacio.
        .replace(/\s*\n\s*/g, " ")
        .replace(/[ \t]+/g, " ")
        .trim(),
    )
    // Fuera lo vacío y los números de página sueltos.
    .filter((p) => p && !/^[\d\s.·—–-]+$/.test(p));

  const capitulos: Capitulo[] = [];
  let actual: Capitulo = { titulo: "", parrafos: [] };

  for (const parrafo of parrafos) {
    const esTitulo = pareceTitulo(parrafo);

    if (!esTitulo) {
      actual.parrafos.push(parrafo);
    } else if (actual.parrafos.length > 0) {
      capitulos.push(actual);
      actual = { titulo: parrafo, parrafos: [] };
    } else {
      actual.titulo = actual.titulo ? `${actual.titulo}. ${parrafo}` : parrafo;
    }
  }
  capitulos.push(actual);

  return capitulos.filter((c) => c.parrafos.length > 0);
}
