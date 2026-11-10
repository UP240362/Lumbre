// Convierte un PDF en capítulos, sacando su texto.
// Un PDF no guarda "párrafos": guarda renglones sueltos colocados en cada
// página. Aquí se reconstruyen los párrafos con una regla sencilla y luego
// se reutiliza el convertidor de texto plano para detectar capítulos.
//
// Límite importante: si el PDF es un escaneo (fotos de las páginas), no
// tiene texto que sacar y se avisa con un error.

import { extractText } from "unpdf";
import { pareceTitulo, textoACapitulos } from "./textoPlano";
import type { Capitulo } from "./tipos";

export class PdfSinTexto extends Error {
  constructor() {
    super("El PDF no contiene texto (parece un escaneo)");
  }
}

const FIN_DE_FRASE = /[.!?…:»”"]$/;

// Junta los renglones de una página en párrafos. Un renglón cierra el
// párrafo cuando termina en punto (u otro signo de cierre) y además es
// claramente más corto que los renglones normales de la página.
function parrafosDePagina(pagina: string): string[] {
  const renglones = pagina
    .split("\n")
    .map((r) => r.replace(/\s+/g, " ").trim())
    .filter((r) => r && !/^\d{1,4}$/.test(r)); // fuera números de página
  if (renglones.length === 0) return [];

  const largoNormal = Math.max(...renglones.map((r) => r.length));
  const parrafos: string[] = [];
  let actual = "";

  for (const renglon of renglones) {
    if (pareceTitulo(renglon)) {
      if (actual) parrafos.push(actual);
      parrafos.push(renglon);
      actual = "";
      continue;
    }
    // "pala-" + "bra" → "palabra"
    actual = actual.endsWith("-")
      ? actual.slice(0, -1) + renglon
      : actual
        ? `${actual} ${renglon}`
        : renglon;

    if (FIN_DE_FRASE.test(renglon) && renglon.length < largoNormal * 0.8) {
      parrafos.push(actual);
      actual = "";
    }
  }
  if (actual) parrafos.push(actual);
  return parrafos;
}

export async function pdfACapitulos(datos: Uint8Array): Promise<Capitulo[]> {
  // text: un texto por cada página del PDF.
  const { text: paginas } = await extractText(datos, { mergePages: false });

  const parrafos: string[] = [];
  for (const pagina of paginas) {
    const nuevos = parrafosDePagina(pagina);
    const anterior = parrafos.at(-1);
    // Si la página anterior terminó a media frase, se continúa aquí.
    if (
      anterior &&
      nuevos.length > 0 &&
      !FIN_DE_FRASE.test(anterior) &&
      !pareceTitulo(anterior) &&
      !pareceTitulo(nuevos[0])
    ) {
      parrafos[parrafos.length - 1] = `${anterior} ${nuevos.shift()}`;
    }
    parrafos.push(...nuevos);
  }

  if (parrafos.join("").length < 200) throw new PdfSinTexto();
  return textoACapitulos(parrafos.join("\n\n"));
}
