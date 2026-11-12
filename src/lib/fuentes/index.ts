// Puerta de entrada a las fuentes de libros. El resto de la aplicación
// usa SOLO estas funciones, nunca una fuente directamente.
//
// Para añadir una fuente nueva (Standard Ebooks, Open Library, Wikisource):
//   1. Crear su archivo en esta carpeta, cumpliendo FuenteLibros (tipos.ts).
//   2. Agregar su nombre a IdFuente y NOMBRES_FUENTE (tipos.ts).
//   3. Agregarla a la lista FUENTES de aquí abajo.

import { repartir } from "../lectura/repartir";
import type { Capitulo, Imagen } from "../lectura/tipos";
import { simplificar } from "../texto";
import { archive } from "./archive";
import { biblioteca } from "./biblioteca";
import { elejandria } from "./elejandria";
import { gutenberg } from "./gutenberg";
import { propio } from "./propio";
import type { FuenteLibros, IdFuente, Libro } from "./tipos";

export type { IdFuente, Libro } from "./tipos";

// El orden importa: así se ordenan los resultados cuando hay empate.
const FUENTES: Record<IdFuente, FuenteLibros> = {
  biblioteca,
  gutenberg,
  elejandria,
  archive,
  propio,
};

export function esFuente(valor: unknown): valor is IdFuente {
  return typeof valor === "string" && Object.hasOwn(FUENTES, valor);
}

// Busca en todas las fuentes a la vez y junta los resultados, con los
// libros en español primero. Si una fuente falla se usan las demás;
// si fallan todas, se avisa con un error.
export async function buscarLibros(consulta: string): Promise<Libro[]> {
  const fuentes = Object.values(FUENTES);
  const resultados = await Promise.allSettled(
    fuentes.map((fuente) => fuente.buscar(consulta)),
  );

  const exitosos = resultados.filter((r) => r.status === "fulfilled");
  if (exitosos.length === 0) {
    throw new Error("Ninguna fuente de libros respondió");
  }

  // Se toman por turnos (el 1.º de cada fuente, luego el 2.º…) para que
  // ninguna fuente acapare los primeros lugares.
  const listas = exitosos.map((r) => r.value);
  const mezclados: Libro[] = [];
  const masLarga = Math.max(...listas.map((l) => l.length));
  for (let i = 0; i < masLarga; i++) {
    for (const lista of listas) {
      if (lista[i]) mezclados.push(lista[i]);
    }
  }

  // Orden final: primero los que traen lo buscado en el título o el autor
  // (algunas fuentes devuelven también coincidencias lejanas), y dentro de
  // cada grupo, primero los que están en español.
  const palabras = simplificar(consulta).split(/\s+/).filter(Boolean);
  const puntos = (libro: Libro) => {
    const texto = simplificar(`${libro.titulo} ${libro.autores.join(" ")}`);
    const coincide = palabras.every((p) => texto.includes(p)) ? 2 : 0;
    return coincide + (libro.idiomas.includes("es") ? 1 : 0);
  };
  // sort conserva el orden original entre libros con los mismos puntos.
  return mezclados.sort((a, b) => puntos(b) - puntos(a));
}

export async function obtenerLibro(
  fuente: IdFuente,
  id: string,
): Promise<Libro | null> {
  return FUENTES[fuente].obtener(id);
}

// ── Texto de los libros ─────────────────────────────────────────────
// Descargar y preparar un libro tarda uno o dos segundos, y al leer se pide
// un capítulo a la vez. Para no repetir ese trabajo en cada capítulo, los
// últimos libros abiertos se guardan en la memoria del servidor.
// (No se guardan en disco ni en la base de datos: al reiniciar se borran.)

const LIBROS_EN_MEMORIA = 6;
const memoria = new Map<string, Promise<Capitulo[]>>();

// ── Ilustraciones ───────────────────────────────────────────────────

export function imagenDeLibro(
  libro: Libro,
  ruta: string,
): Promise<{ datos: Uint8Array; tipo: string } | null> {
  return FUENTES[libro.fuente].imagen?.(libro, ruta) ?? Promise.resolve(null);
}

// Llena el ancho y alto de las ilustraciones que no lo traían (así el
// lector les aparta su lugar y el texto no brinca al cargarlas). Si una
// tarda o falla, se queda sin medidas: se verá igual, solo sin apartar lugar.
export async function completarMedidas(libro: Libro, imagenes: Imagen[]): Promise<Imagen[]> {
  const medir = FUENTES[libro.fuente].medidas;
  if (!medir) return imagenes;
  return Promise.all(
    imagenes.map(async (imagen) => {
      if (imagen.ancho && imagen.alto) return imagen;
      const medidas = await medir(libro, imagen.ruta).catch(() => null);
      return medidas ? { ...imagen, ...medidas } : imagen;
    }),
  );
}

// Saca un libro de la memoria (por ejemplo, cuando el usuario lo elimina).
export function olvidarLibro(libro: { fuente: string; id: string }) {
  memoria.delete(`${libro.fuente}:${libro.id}`);
}

export function leerLibro(libro: Libro): Promise<Capitulo[]> {
  const clave = `${libro.fuente}:${libro.id}`;

  const guardado = memoria.get(clave);
  if (guardado) {
    // Se vuelve a insertar para marcarlo como el usado más recientemente.
    memoria.delete(clave);
    memoria.set(clave, guardado);
    return guardado;
  }

  const lectura = FUENTES[libro.fuente].leer(libro).then(repartir);
  memoria.set(clave, lectura);
  // Si la descarga falla, no se guarda el error: se reintenta la próxima vez.
  lectura.catch(() => memoria.delete(clave));

  // Si ya hay demasiados, se saca el que lleva más tiempo sin usarse.
  if (memoria.size > LIBROS_EN_MEMORIA) {
    const masViejo = memoria.keys().next().value;
    if (masViejo !== undefined) memoria.delete(masViejo);
  }
  return lectura;
}
