// CÓMICS (y cualquier libro que se lee página por página, como imágenes).
// Formatos:
//   - CBZ: un ZIP con una imagen por página; el orden es el de los nombres
//     ("001.jpg", "002.jpg"…).
//   - ePub de imágenes (cómics y manga de "diseño fijo"): cada página del
//     ePub trae una imagen.
//   - PDF: el navegador dibuja cada página (VisorComic.tsx). Así se leen
//     los PDF escaneados, que no tienen texto que sacar.

import { strFromU8, unzipSync } from "fflate";
import { extractText, getDocumentProxy } from "unpdf";
import { carpetaDe, ordenDeLectura, resolver } from "./epub";
import { tipoDeImagen, type PaginasComic } from "./tipos";

const empiezaCon = (datos: Uint8Array, firma: string) =>
  [...firma].every((letra, i) => datos[i] === letra.charCodeAt(0));

// Orden "natural": "pag2" antes que "pag10".
const natural = new Intl.Collator("es", { numeric: true, sensitivity: "base" });

// Imágenes de un CBZ, en orden. Se leen solo los nombres, sin descomprimir.
function paginasDeCbz(datos: Uint8Array): string[] {
  const nombres: string[] = [];
  unzipSync(datos, {
    filter: (archivo) => {
      const partes = archivo.name.split("/");
      // Fuera carpetas ocultas o de macOS ("__MACOSX/", "._foto.jpg").
      const oculto = partes.some((p) => p.startsWith(".") || p === "__MACOSX");
      if (!oculto && tipoDeImagen(archivo.name) && archivo.originalSize > 0) nombres.push(archivo.name);
      return false;
    },
  });
  return nombres.sort(natural.compare);
}

// Imágenes de un ePub, en el orden de sus páginas. Los ePub de cómic
// suelen poner la imagen con <img> o dentro de un <svg> con <image>.
function paginasDeEpub(datos: Uint8Array): string[] {
  const archivos = unzipSync(datos);
  const vistas = new Set<string>();
  const rutas: string[] = [];
  for (const pagina of ordenDeLectura(archivos)) {
    const html = archivos[pagina] ? strFromU8(archivos[pagina]) : "";
    const fuentes = [
      ...html.matchAll(/<img\b[^>]*?\bsrc\s*=\s*["']([^"']+)["']/gi),
      ...html.matchAll(/<image\b[^>]*?\b(?:xlink:)?href\s*=\s*["']([^"']+)["']/gi),
    ].map((m) => m[1]);
    for (const src of fuentes) {
      if (/^[a-z]+:/i.test(src)) continue;
      let ruta: string;
      try {
        ruta = resolver(carpetaDe(pagina), src);
      } catch {
        continue;
      }
      if (!archivos[ruta] || !tipoDeImagen(ruta) || vistas.has(ruta)) continue;
      vistas.add(ruta);
      rutas.push(ruta);
    }
  }
  return rutas;
}

export async function paginasDeArchivo(datos: Uint8Array): Promise<PaginasComic> {
  if (empiezaCon(datos, "%PDF")) {
    const pdf = await getDocumentProxy(new Uint8Array(datos));
    return { tipo: "pdf", total: pdf.numPages };
  }
  if (empiezaCon(datos, "PK")) {
    const esEpub = (() => {
      let si = false;
      unzipSync(datos, {
        filter: (a) => {
          if (a.name === "META-INF/container.xml") si = true;
          return false;
        },
      });
      return si;
    })();
    return { tipo: "imagenes", rutas: esEpub ? paginasDeEpub(datos) : paginasDeCbz(datos) };
  }
  return { tipo: "imagenes", rutas: [] };
}

// ¿El PDF es un escaneo? (casi nada de texto por página)
export async function pdfEsEscaneo(datos: Uint8Array): Promise<boolean> {
  const { text, totalPages } = await extractText(new Uint8Array(datos), { mergePages: true });
  return text.replace(/\s+/g, "").length < 80 * Math.max(1, totalPages);
}
