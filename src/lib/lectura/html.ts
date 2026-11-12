// Convierte una página HTML (de Gutenberg o de dentro de un ePub) en capítulos.
// Idea: los encabezados (<h1>…<h6>) marcan dónde empieza cada capítulo, y
// todo lo demás se reduce a párrafos de texto sin etiquetas.
// Las ilustraciones (<img>) se anotan aparte, con el párrafo que les sigue,
// si quien llama sabe de dónde sacarlas (opción "imagen").

import { decodificarHtml } from "../texto";
import { quitarVacios } from "./repartir";
import type { Capitulo, Imagen } from "./tipos";

// Etiquetas que separan bloques de texto.
const BLOQUES =
  "p|div|li|ul|ol|blockquote|pre|tr|table|section|article|header|footer|hr|dl|dt|dd|figure|figcaption|center";

// Marcas internas (caracteres que nunca aparecen en un libro).
const ENCABEZADO = "\u0001";
const SALTO = "\u0002";
const IMAGEN = "\u0003"; // seguida del número de imagen
// Va pegada al inicio de un pie de ilustración. No separa bloques: así los
// párrafos quedan exactamente igual que sin ilustraciones.
const PIE = "\u0004";

export type OpcionesHtml = {
  // Recibe el "src" de una <img> y dice cómo pedirla, o null si no se puede.
  imagen?: (src: string) => { ruta: string; ancho?: number; alto?: number } | null;
};

function atributo(etiqueta: string, nombre: string): string {
  const valor = etiqueta.match(
    new RegExp(`\\s${nombre}\\s*=\\s*(?:"([^"]*)"|'([^']*)'|([^\\s>]+))`, "i"),
  );
  return decodificarHtml(valor?.[1] ?? valor?.[2] ?? valor?.[3] ?? "").trim();
}

// Muchos libros ponen de "alt" el nombre del archivo ("p003.jpg (307K)"):
// eso no describe nada y no se lee en voz alta.
function altUtil(alt: string): string {
  return /\.(jpe?g|png|gif|webp|svg)\b|\(\d+\s*K\)|^(image|imagen|illustration|ilustraci[oó]n|figure|figura|img)?[\s_-]*\d*$/i.test(alt)
    ? ""
    : alt;
}

const marcarPie = (pie: string) => `${PIE}${pie}`;

export function htmlACapitulos(html: string, opciones: OpcionesHtml = {}): Capitulo[] {
  const limpio = html
    .replace(/<!--[\s\S]*?-->/g, "")
    .replace(/<(script|style|head|svg)\b[\s\S]*?<\/\1>/gi, "");
  const cuerpo = limpio.match(/<body[^>]*>([\s\S]*)<\/body>/i)?.[1] ?? limpio;

  const imagenes: Omit<Imagen, "antes" | "pie">[] = [];
  const numero = (texto: string) => (/^\d+$/.test(texto) ? Number(texto) : undefined);

  const texto = cuerpo
    // Los saltos de línea del archivo no significan nada en HTML.
    .replace(/\s+/g, " ")
    // Una imagen dentro de un título no es una ilustración del texto.
    .replace(/<h([1-6])\b[^>]*>[\s\S]*?<\/h\1>/gi, (h) => h.replace(/<img\b[^>]*>/gi, ""))
    // Pies de ilustración: se les pone la marca delante.
    .replace(/<figcaption\b[^>]*>/gi, marcarPie)
    .replace(/<(p|div|span)\b[^>]*\bclass\s*=\s*["'][^"']*caption[^"']*["'][^>]*>/gi, marcarPie)
    // Imágenes → bloque propio con su número (o se quitan).
    .replace(/<img\b[^>]*>/gi, (etiqueta) => {
      const src = atributo(etiqueta, "src");
      const alt = atributo(etiqueta, "alt");
      // Letra capital dibujada ("T", "\"C"): se quita, como siempre se ha
      // hecho, para no cambiar el texto (ni la numeración) de los párrafos.
      if (/^\P{L}*\p{L}$/u.test(alt) || /drop|initial|capital/i.test(atributo(etiqueta, "class"))) {
        return "";
      }
      // Íconos de "ver en tamaño completo" de Gutenberg.
      if (!src || /enlarge/i.test(src) || /^full\s*size$/i.test(alt)) return "";
      const encontrada = opciones.imagen?.(src);
      if (!encontrada) return "";

      imagenes.push({
        alt: altUtil(alt),
        ancho: numero(atributo(etiqueta, "width")),
        alto: numero(atributo(etiqueta, "height")),
        ...encontrada,
      });
      return `\n\n${IMAGEN}${imagenes.length - 1}\n\n`;
    })
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
    const recortado = bloque.trim();

    if (recortado.startsWith(IMAGEN)) {
      const imagen = imagenes[Number(recortado.slice(1))];
      if (imagen) {
        (actual.imagenes ??= []).push({ ...imagen, antes: actual.parrafos.length });
      }
      continue;
    }

    const esEncabezado = bloque.startsWith(ENCABEZADO);
    const conMarca = decodificarHtml(esEncabezado ? bloque.slice(2) : bloque)
      .replace(new RegExp(`\\s*${SALTO}\\s*`, "g"), "\n")
      .trim();
    const contenido = conMarca.replaceAll(PIE, "").trim();
    if (!contenido) continue;

    if (!esEncabezado) {
      // Es pie si va justo después de una ilustración; si no, es texto normal.
      const ultima = actual.imagenes?.at(-1);
      if (conMarca.startsWith(PIE) && ultima?.antes === actual.parrafos.length && ultima.pie === undefined) {
        ultima.pie = actual.parrafos.length;
      }
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

  // Los capítulos sin texto se quitan; sus imágenes pasan al siguiente.
  return quitarVacios(capitulos);
}
