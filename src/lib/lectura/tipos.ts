// Forma del texto de un libro una vez preparado para leerse:
// una lista de capítulos, cada uno con su título y sus párrafos.

// Una ilustración del libro. Va APARTE de los párrafos para no cambiar su
// numeración (los subrayados y la voz cuentan "párrafo número N").
export type Imagen = {
  antes: number; // va justo antes de este párrafo (= parrafos.length: al final)
  ruta: string; // dónde está dentro de su fuente (lo entiende /api/imagen)
  alt: string; // descripción para lectores de pantalla ("" si no hay)
  // Número del párrafo que es su pie de foto (va justo después). El pie
  // sigue siendo un párrafo normal: se puede subrayar y se lee en voz alta.
  pie?: number;
  ancho?: number; // tamaño real en píxeles, si se conoce
  alto?: number;
};

export type Capitulo = {
  titulo: string;
  parrafos: string[]; // un párrafo puede traer saltos de línea (versos)
  imagenes?: Imagen[];
};

// Las páginas de un libro que se lee como cómic (ver lectura/comic.ts):
// - "imagenes": cada página es una imagen dentro del archivo (CBZ o ePub);
// - "pdf": las páginas de un PDF, que el navegador dibuja una por una.
export type PaginasComic =
  | { tipo: "imagenes"; rutas: string[] }
  | { tipo: "pdf"; total: number };

export const totalPaginas = (p: PaginasComic) => (p.tipo === "pdf" ? p.total : p.rutas.length);

// Dirección del archivo completo de un libro propio (para los PDF).
export function urlArchivo(fuente: string, id: string): string {
  return `/api/archivo/${encodeURIComponent(fuente)}/${encodeURIComponent(id)}`;
}

// Formatos de imagen que se muestran. SVG no: puede traer código.
export const EXTENSIONES_IMAGEN: Record<string, string> = {
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  png: "image/png",
  gif: "image/gif",
  webp: "image/webp",
};

export function tipoDeImagen(ruta: string): string | null {
  const extension = ruta.split("?")[0].split(".").pop()?.toLowerCase() ?? "";
  return EXTENSIONES_IMAGEN[extension] ?? null;
}

// Dirección con la que el navegador pide una imagen del libro.
export function urlImagen(fuente: string, id: string, ruta: string): string {
  return `/api/imagen/${encodeURIComponent(fuente)}/${encodeURIComponent(id)}?r=${encodeURIComponent(ruta)}`;
}
