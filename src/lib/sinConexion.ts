"use client";

// LIBROS GUARDADOS EN EL TELÉFONO, para leer sin internet.
//
// Cada vez que abres un libro con internet, su texto completo se guarda en
// IndexedDB (una pequeña base de datos que trae el navegador). Se conservan
// los últimos LIMITE libros que abriste. Lo que leas sin conexión se anota
// aquí como "pendiente" y se sube a tu cuenta cuando vuelve el internet.
// Las ilustraciones se guardan aparte, en el almacén de caché del navegador
// ("lumbre-imagenes"); public/sw.js las entrega cuando no hay internet.

import { urlArchivo, urlImagen, type Imagen, type PaginasComic } from "./lectura/tipos";

export type LibroGuardado = {
  clave: string; // "<fuente>:<id>"
  dueno: string; // id del usuario: un teléfono compartido no mezcla libros
  fuente: string;
  id: string;
  titulo: string;
  autor: string;
  titulos: string[];
  capitulos: string[][]; // párrafos de cada capítulo
  imagenes?: Imagen[][]; // ilustraciones de cada capítulo (libros guardados antes: no hay)
  // Si es un cómic: sus páginas. Entonces "capitulo" es el número de página
  // y "capitulos" y "titulos" van vacíos.
  comic?: PaginasComic;
  capitulo: number; // dónde se quedó
  porcentaje: number;
  pendiente: boolean; // avance hecho sin internet que falta subir
  abiertoEn: number;
};

const BASE = "lumbre";
const ALMACEN = "libros";
const LIMITE = 10;
// Si el libro ya está guardado, se vuelve a descargar solo pasado este tiempo
// (por si la fuente corrigió el texto).
const RENOVAR_MS = 7 * 24 * 60 * 60 * 1000;

export const clave = (fuente: string, id: string) => `${fuente}:${id}`;

// ── Ilustraciones ──
const CACHE_IMAGENES = "lumbre-imagenes";
// Tope por libro: un libro muy ilustrado (el Quijote de Doré tiene cientos
// de grabados) no debe llenar el teléfono. Se guardan las primeras.
const MAX_BYTES_IMAGENES = 25 * 1024 * 1024;

// Libros cuyas ilustraciones ya se revisaron en esta visita (el lector llama
// a guardarEnTelefono en cada capítulo; basta con una vez).
const imagenesRevisadas = new Set<string>();

async function guardarImagenes(fuente: string, id: string, imagenes: Imagen[][] | undefined) {
  if (!imagenes?.length) return;
  await guardarEnCache(
    fuente,
    id,
    imagenes.flat().map((imagen) => urlImagen(fuente, id, imagen.ruta)),
    MAX_BYTES_IMAGENES,
  );
}

// Descarga esas direcciones al almacén del teléfono (en orden, hasta el
// tope de bytes), una sola vez por libro y visita.
async function guardarEnCache(fuente: string, id: string, urls: string[], maximo: number) {
  if (typeof caches === "undefined") return;
  if (imagenesRevisadas.has(clave(fuente, id))) return;
  imagenesRevisadas.add(clave(fuente, id));
  const pendientes = [...new Set(urls)];
  if (!pendientes.length) return;
  const cache = await caches.open(CACHE_IMAGENES);
  let total = 0;

  // Tres descargas a la vez, hasta llenar el tope.
  async function trabajar() {
    while (pendientes.length && total < maximo) {
      const url = pendientes.shift()!;
      const guardada = await cache.match(url);
      if (guardada) {
        total += (await guardada.blob()).size;
        continue;
      }
      const respuesta = await fetch(url).catch(() => null);
      if (!respuesta?.ok) continue;
      total += (await respuesta.clone().blob()).size;
      await cache.put(url, respuesta);
    }
  }
  await Promise.all([trabajar(), trabajar(), trabajar()]);
}

async function borrarImagenes(libros: { fuente: string; id: string }[] | "todas") {
  if (typeof caches === "undefined") return;
  if (libros === "todas") {
    imagenesRevisadas.clear();
    await caches.delete(CACHE_IMAGENES);
    return;
  }
  const cache = await caches.open(CACHE_IMAGENES);
  const prefijos = libros.flatMap((l) => [
    `/api/imagen/${encodeURIComponent(l.fuente)}/${encodeURIComponent(l.id)}?`,
    urlArchivo(l.fuente, l.id),
  ]);
  for (const pedido of await cache.keys()) {
    const { pathname, search } = new URL(pedido.url);
    if (prefijos.some((p) => `${pathname}${search}`.startsWith(p))) await cache.delete(pedido);
  }
}

function abrir(): Promise<IDBDatabase> {
  return new Promise((resolver, fallar) => {
    const pedido = indexedDB.open(BASE, 1);
    pedido.onupgradeneeded = () => {
      pedido.result.createObjectStore(ALMACEN, { keyPath: "clave" });
    };
    pedido.onsuccess = () => resolver(pedido.result);
    pedido.onerror = () => fallar(pedido.error);
  });
}

// Corre una operación sobre el almacén y espera a que termine.
async function usar<T>(
  modo: IDBTransactionMode,
  operacion: (almacen: IDBObjectStore) => IDBRequest<T> | void,
): Promise<T | undefined> {
  const db = await abrir();
  try {
    return await new Promise<T | undefined>((resolver, fallar) => {
      const tx = db.transaction(ALMACEN, modo);
      const pedido = operacion(tx.objectStore(ALMACEN));
      tx.oncomplete = () => resolver(pedido ? pedido.result : undefined);
      tx.onerror = () => fallar(tx.error);
      tx.onabort = () => fallar(tx.error);
    });
  } finally {
    db.close();
  }
}

export async function listarLibros(): Promise<LibroGuardado[]> {
  const todos = (await usar<LibroGuardado[]>("readonly", (a) => a.getAll())) ?? [];
  return todos.sort((a, b) => b.abiertoEn - a.abiertoEn);
}

export function obtenerGuardado(
  clave: string,
): Promise<LibroGuardado | undefined> {
  return usar<LibroGuardado>("readonly", (a) => a.get(clave));
}

function poner(libro: LibroGuardado) {
  return usar("readwrite", (a) => {
    a.put(libro);
  });
}

// Cómics: se guardan las páginas (hasta este tope) o el PDF completo.
const MAX_BYTES_COMIC = 80 * 1024 * 1024;

// Lo llama el lector de cómics al abrirlo con internet.
export async function guardarComicEnTelefono(datos: {
  dueno: string;
  fuente: string;
  id: string;
  titulo: string;
  autor: string;
  paginas: PaginasComic;
  pagina: number;
  porcentaje: number;
}) {
  if (typeof indexedDB === "undefined") return;
  const todos = await listarLibros();
  if (todos.some((l) => l.dueno !== datos.dueno)) {
    await usar("readwrite", (a) => {
      a.clear();
    });
    await borrarImagenes("todas").catch(() => {});
    todos.length = 0;
  }

  const previo = todos.find((l) => l.clave === clave(datos.fuente, datos.id));
  await poner({
    clave: clave(datos.fuente, datos.id),
    dueno: datos.dueno,
    fuente: datos.fuente,
    id: datos.id,
    titulo: datos.titulo,
    autor: datos.autor,
    titulos: [],
    capitulos: [],
    comic: datos.paginas,
    // Si había un avance hecho sin internet, se respeta.
    capitulo: previo?.pendiente ? previo.capitulo : datos.pagina,
    porcentaje: previo?.pendiente ? previo.porcentaje : datos.porcentaje,
    pendiente: previo?.pendiente ?? false,
    abiertoEn: Date.now(),
  });
  await recortar();

  const urls =
    datos.paginas.tipo === "pdf"
      ? [urlArchivo(datos.fuente, datos.id)]
      : datos.paginas.rutas.map((ruta) => urlImagen(datos.fuente, datos.id, ruta));
  await guardarEnCache(datos.fuente, datos.id, urls, MAX_BYTES_COMIC).catch(() => {});
}

// Solo se quedan los últimos LIMITE libros abiertos.
async function recortar() {
  const sobrantes = (await listarLibros()).slice(LIMITE);
  if (sobrantes.length) {
    await usar("readwrite", (a) => {
      for (const l of sobrantes) a.delete(l.clave);
    });
    await borrarImagenes(sobrantes).catch(() => {});
  }
}

// Lo llama el lector al abrir un libro con internet.
export async function guardarEnTelefono(datos: {
  dueno: string;
  fuente: string;
  id: string;
  capitulo: number;
  porcentaje: number;
}) {
  if (typeof indexedDB === "undefined") return;
  const todos = await listarLibros();

  // Si otra cuenta usó este teléfono, sus libros se borran primero.
  if (todos.some((l) => l.dueno !== datos.dueno)) {
    await usar("readwrite", (a) => {
      a.clear();
    });
    await borrarImagenes("todas").catch(() => {});
    todos.length = 0;
  }

  const k = clave(datos.fuente, datos.id);
  const previo = todos.find((l) => l.clave === k);
  const ahora = Date.now();
  let imagenes: Imagen[][] | undefined;

  if (
    previo &&
    ahora - previo.abiertoEn < RENOVAR_MS &&
    previo.capitulos.length &&
    // Los guardados antes de que hubiera ilustraciones se bajan otra vez.
    previo.imagenes !== undefined
  ) {
    // Ya está guardado: solo se anota que se abrió y dónde va. Si había un
    // avance pendiente, se respeta (lo sube el sincronizador).
    await poner({
      ...previo,
      abiertoEn: ahora,
      ...(previo.pendiente ? {} : { capitulo: datos.capitulo, porcentaje: datos.porcentaje }),
    });
    imagenes = previo.imagenes;
  } else {
    const ruta = `/api/libro/${encodeURIComponent(datos.fuente)}/${encodeURIComponent(datos.id)}`;
    const respuesta = await fetch(ruta);
    if (!respuesta.ok) return;
    const libro = (await respuesta.json()) as {
      titulo: string;
      autor: string;
      titulos: string[];
      capitulos: string[][];
      imagenes?: Imagen[][];
    };
    imagenes = libro.imagenes ?? [];
    await poner({
      clave: k,
      dueno: datos.dueno,
      fuente: datos.fuente,
      id: datos.id,
      titulo: libro.titulo,
      autor: libro.autor,
      titulos: libro.titulos,
      capitulos: libro.capitulos,
      imagenes,
      capitulo: previo?.pendiente ? previo.capitulo : datos.capitulo,
      porcentaje: previo?.pendiente ? previo.porcentaje : datos.porcentaje,
      pendiente: previo?.pendiente ?? false,
      abiertoEn: ahora,
    });
  }

  await recortar();

  // Al final, sin prisa: las ilustraciones (las que falten).
  await guardarImagenes(datos.fuente, datos.id, imagenes).catch(() => {});
}

// Anota dónde va la lectura de un libro guardado.
export async function anotarAvance(
  fuente: string,
  id: string,
  capitulo: number,
  porcentaje: number,
  pendiente: boolean,
) {
  if (typeof indexedDB === "undefined") return;
  const libro = await obtenerGuardado(clave(fuente, id));
  if (!libro) return;
  await poner({ ...libro, capitulo, porcentaje, pendiente });
}

// Sube a la cuenta los avances hechos sin internet. "enviar" es la acción
// del servidor que guarda el avance; si falla, el avance sigue pendiente.
export async function subirPendientes(
  enviar: (
    fuente: string,
    id: string,
    capitulo: number,
    porcentaje: number,
  ) => Promise<{ ok: boolean }>,
) {
  if (typeof indexedDB === "undefined") return;
  const pendientes = (await listarLibros()).filter((l) => l.pendiente);
  for (const l of pendientes) {
    const { ok } = await enviar(l.fuente, l.id, l.capitulo, l.porcentaje).catch(
      () => ({ ok: false }),
    );
    if (!ok) return; // sin internet o sin sesión: se intenta luego
    const actual = await obtenerGuardado(l.clave);
    // Solo se marca como subido si no se siguió leyendo mientras tanto.
    if (actual && actual.capitulo === l.capitulo && actual.porcentaje === l.porcentaje) {
      await poner({ ...actual, pendiente: false });
    }
  }
}

// Al cerrar sesión: borra los libros guardados y la copia de la página
// sin conexión, para que nadie más los vea en este teléfono.
export async function borrarTodoSinConexion() {
  // El tiempo de lectura que no se alcanzó a mandar también es de esta cuenta.
  try {
    localStorage.removeItem("lumbre-tiempo-pendiente");
  } catch {}
  try {
    if (typeof indexedDB !== "undefined") {
      await usar("readwrite", (a) => {
        a.clear();
      });
    }
  } catch {}
  try {
    for (const nombre of await caches.keys()) {
      if (nombre.startsWith("lumbre-")) await caches.delete(nombre);
    }
  } catch {}
}
