// Convierte un archivo ePub en capítulos.
// Un ePub es un ZIP con páginas HTML adentro, más un archivo (.opf) que dice
// en qué orden se leen. Aquí se abre el ZIP, se sigue ese orden y cada página
// se pasa por el mismo convertidor de HTML que usa Gutenberg.
// Las ilustraciones se quedan dentro del ZIP: se anota su ruta y su tamaño,
// y /api/imagen las saca de ahí cuando el lector las pide.

import { strFromU8, unzipSync } from "fflate";
import { htmlACapitulos } from "./html";
import { medidasImagen } from "./medidas";
import { tipoDeImagen, type Capitulo, type Imagen } from "./tipos";

// Une la carpeta del .opf con la ruta de una página ("OPS/" + "cap1.xhtml").
export function resolver(carpeta: string, ruta: string): string {
  const partes = `${carpeta}${decodeURIComponent(ruta.split("#")[0])}`.split("/");
  const salida: string[] = [];
  for (const parte of partes) {
    if (parte === "..") salida.pop();
    else if (parte && parte !== ".") salida.push(parte);
  }
  return salida.join("/");
}

export const carpetaDe = (ruta: string) =>
  ruta.includes("/") ? ruta.slice(0, ruta.lastIndexOf("/") + 1) : "";

function atributo(etiqueta: string, nombre: string): string | undefined {
  return etiqueta.match(new RegExp(`\\b${nombre}="([^"]*)"`))?.[1];
}

// Las páginas del ePub en orden de lectura (rutas dentro del ZIP).
export function ordenDeLectura(archivos: Record<string, Uint8Array>): string[] {
  const leer = (ruta: string) => (archivos[ruta] ? strFromU8(archivos[ruta]) : null);

  // 1. container.xml dice dónde está el .opf
  const contenedor = leer("META-INF/container.xml");
  const rutaOpf = contenedor?.match(/full-path="([^"]+)"/)?.[1];
  const opf = rutaOpf ? leer(rutaOpf) : null;
  if (!rutaOpf || !opf) throw new Error("ePub sin índice de contenido");
  const carpeta = carpetaDe(rutaOpf);

  // 2. El "manifest" lista los archivos; el "spine" da el orden de lectura.
  const paginas = new Map<string, string>();
  for (const [etiqueta] of opf.matchAll(/<item\b[^>]*>/g)) {
    const id = atributo(etiqueta, "id");
    const href = atributo(etiqueta, "href");
    if (id && href) paginas.set(id, resolver(carpeta, href));
  }
  return [...opf.matchAll(/<itemref\b[^>]*>/g)]
    .map(([etiqueta]) => atributo(etiqueta, "idref"))
    .flatMap((id) => (id && paginas.has(id) ? [paginas.get(id)!] : []));
}

export function epubACapitulos(datos: Uint8Array): Capitulo[] {
  const archivos = unzipSync(datos);
  const leer = (ruta: string) =>
    archivos[ruta] ? strFromU8(archivos[ruta]) : null;
  const orden = ordenDeLectura(archivos);

  // 3. Cada página se convierte y se van juntando los capítulos.
  const capitulos: Capitulo[] = [];
  // Láminas que aparecieron antes del primer capítulo con texto.
  let sueltas: Imagen[] = [];

  for (const ruta of orden) {
    const html = leer(ruta);
    if (!html) continue;

    // Una <img> de esta página → su archivo dentro del ZIP, si existe.
    const imagen = (src: string) => {
      if (/^[a-z]+:/i.test(src)) return null; // de internet: no se usa
      let dentro: string;
      try {
        dentro = resolver(carpetaDe(ruta), src);
      } catch {
        return null;
      }
      const bytes = archivos[dentro];
      if (!bytes || !tipoDeImagen(dentro)) return null;
      return { ruta: dentro, ...medidasImagen(bytes) };
    };

    for (const capitulo of htmlACapitulos(html, { imagen })) {
      const largo = capitulo.parrafos.join("").length;
      const anterior = capitulos.at(-1);
      const imagenes = capitulo.imagenes ?? [];

      if (capitulo.titulo && capitulo.parrafos.length > 0) {
        capitulos.push(capitulo);
      } else if (largo < 300) {
        // Páginas sueltas sin título y casi vacías (portada, créditos): el
        // texto se descarta, pero sus ilustraciones se quedan donde iban.
        if (anterior) {
          (anterior.imagenes ??= []).push(
            ...imagenes.map((i) => ({ ...i, antes: anterior.parrafos.length, pie: undefined })),
          );
        } else {
          sueltas.push(...imagenes.map((i) => ({ ...i, antes: 0, pie: undefined })));
        }
        continue;
      } else if (anterior) {
        // Texto sin título: es la continuación del capítulo anterior.
        const corrimiento = anterior.parrafos.length;
        anterior.parrafos.push(...capitulo.parrafos);
        if (imagenes.length) {
          (anterior.imagenes ??= []).push(
            ...imagenes.map((i) => ({
              ...i,
              antes: i.antes + corrimiento,
              pie: i.pie === undefined ? undefined : i.pie + corrimiento,
            })),
          );
        }
        continue;
      } else {
        capitulos.push(capitulo);
      }

      // Las láminas que esperaban van al inicio del primer capítulo.
      if (sueltas.length) {
        const primero = capitulos.at(-1)!;
        primero.imagenes = [...sueltas, ...(primero.imagenes ?? [])];
        sueltas = [];
      }
    }
  }
  return capitulos;
}

// Saca un solo archivo de imagen del ePub (sin descomprimir lo demás).
export function imagenDeEpub(
  datos: Uint8Array,
  ruta: string,
): { datos: Uint8Array; tipo: string } | null {
  const tipo = tipoDeImagen(ruta);
  if (!tipo) return null;
  const archivos = unzipSync(datos, { filter: (archivo) => archivo.name === ruta });
  const bytes = archivos[ruta];
  return bytes ? { datos: bytes, tipo } : null;
}
