// Convierte un archivo ePub en capítulos.
// Un ePub es un ZIP con páginas HTML adentro, más un archivo (.opf) que dice
// en qué orden se leen. Aquí se abre el ZIP, se sigue ese orden y cada página
// se pasa por el mismo convertidor de HTML que usa Gutenberg.

import { strFromU8, unzipSync } from "fflate";
import { htmlACapitulos } from "./html";
import type { Capitulo } from "./tipos";

// Une la carpeta del .opf con la ruta de una página ("OPS/" + "cap1.xhtml").
function resolver(carpeta: string, ruta: string): string {
  const partes = `${carpeta}${decodeURIComponent(ruta.split("#")[0])}`.split("/");
  const salida: string[] = [];
  for (const parte of partes) {
    if (parte === "..") salida.pop();
    else if (parte && parte !== ".") salida.push(parte);
  }
  return salida.join("/");
}

function atributo(etiqueta: string, nombre: string): string | undefined {
  return etiqueta.match(new RegExp(`\\b${nombre}="([^"]*)"`))?.[1];
}

export function epubACapitulos(datos: Uint8Array): Capitulo[] {
  const archivos = unzipSync(datos);
  const leer = (ruta: string) =>
    archivos[ruta] ? strFromU8(archivos[ruta]) : null;

  // 1. container.xml dice dónde está el .opf
  const contenedor = leer("META-INF/container.xml");
  const rutaOpf = contenedor?.match(/full-path="([^"]+)"/)?.[1];
  const opf = rutaOpf ? leer(rutaOpf) : null;
  if (!rutaOpf || !opf) throw new Error("ePub sin índice de contenido");
  const carpeta = rutaOpf.includes("/")
    ? rutaOpf.slice(0, rutaOpf.lastIndexOf("/") + 1)
    : "";

  // 2. El "manifest" lista los archivos; el "spine" da el orden de lectura.
  const paginas = new Map<string, string>();
  for (const [etiqueta] of opf.matchAll(/<item\b[^>]*>/g)) {
    const id = atributo(etiqueta, "id");
    const href = atributo(etiqueta, "href");
    if (id && href) paginas.set(id, resolver(carpeta, href));
  }
  const orden = [...opf.matchAll(/<itemref\b[^>]*>/g)]
    .map(([etiqueta]) => atributo(etiqueta, "idref"))
    .flatMap((id) => (id && paginas.has(id) ? [paginas.get(id)!] : []));

  // 3. Cada página se convierte y se van juntando los capítulos.
  const capitulos: Capitulo[] = [];
  for (const ruta of orden) {
    const html = leer(ruta);
    if (!html) continue;

    for (const capitulo of htmlACapitulos(html)) {
      const largo = capitulo.parrafos.join("").length;
      const anterior = capitulos.at(-1);

      if (capitulo.titulo) {
        capitulos.push(capitulo);
      } else if (largo < 300) {
        // Páginas sueltas sin título y casi vacías (portada, créditos): fuera.
        continue;
      } else if (anterior) {
        // Texto sin título: es la continuación del capítulo anterior.
        anterior.parrafos.push(...capitulo.parrafos);
      } else {
        capitulos.push(capitulo);
      }
    }
  }
  return capitulos;
}
