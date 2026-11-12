// Ilustraciones y páginas de libros que vienen en un archivo ZIP (ePub de
// Elejandría, Mis libros y Biblioteca Lumbre; cómics CBZ). Las imágenes
// están dentro del archivo del libro, así que hay que tenerlo a la mano
// para sacarlas. Un capítulo (o un cómic) pide varias seguidas: los últimos
// archivos se guardan un rato en memoria para no descargarlos por imagen.

import { imagenDeEpub } from "../lectura/epub";

const MAXIMO_BYTES = 150 * 1024 * 1024; // entre todos los archivos guardados
const DURACION_MS = 10 * 60 * 1000;

type Guardado = { datos: Promise<Uint8Array>; tamano: number; hasta: number };
const memoria = new Map<string, Guardado>();

function limpiar() {
  const ahora = Date.now();
  for (const [clave, g] of memoria) if (g.hasta < ahora) memoria.delete(clave);
  // Si se pasa del tope, salen primero los más antiguos.
  let total = [...memoria.values()].reduce((s, g) => s + g.tamano, 0);
  for (const [clave, g] of memoria) {
    if (total <= MAXIMO_BYTES) break;
    memoria.delete(clave);
    total -= g.tamano;
  }
}

// El archivo completo del libro, de la memoria o recién descargado.
export function archivoEnMemoria(
  clave: string, // "<fuente>:<id>"
  cargar: () => Promise<Uint8Array | null>,
): Promise<Uint8Array> {
  limpiar();
  let guardado = memoria.get(clave);
  if (!guardado) {
    const datos = cargar().then((d) => {
      if (!d) throw new Error("El libro ya no está disponible");
      return d;
    });
    const nuevo: Guardado = { datos, tamano: 0, hasta: 0 };
    guardado = nuevo;
    memoria.set(clave, nuevo);
    datos.then(
      (d) => (nuevo.tamano = d.byteLength),
      () => memoria.delete(clave),
    );
  }
  // Se vuelve a insertar para marcarlo como el usado más recientemente.
  guardado.hasta = Date.now() + DURACION_MS;
  memoria.delete(clave);
  memoria.set(clave, guardado);
  return guardado.datos;
}

export async function imagenDeArchivo(
  clave: string,
  cargar: () => Promise<Uint8Array | null>,
  ruta: string,
): Promise<{ datos: Uint8Array; tipo: string } | null> {
  try {
    return imagenDeEpub(await archivoEnMemoria(clave, cargar), ruta);
  } catch {
    return null; // no es un ZIP, o la imagen no existe
  }
}
