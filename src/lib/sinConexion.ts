"use client";

// LIBROS GUARDADOS EN EL TELÉFONO, para leer sin internet.
//
// Cada vez que abres un libro con internet, su texto completo se guarda en
// IndexedDB (una pequeña base de datos que trae el navegador). Se conservan
// los últimos LIMITE libros que abriste. Lo que leas sin conexión se anota
// aquí como "pendiente" y se sube a tu cuenta cuando vuelve el internet.

export type LibroGuardado = {
  clave: string; // "<fuente>:<id>"
  dueno: string; // id del usuario: un teléfono compartido no mezcla libros
  fuente: string;
  id: string;
  titulo: string;
  autor: string;
  titulos: string[];
  capitulos: string[][]; // párrafos de cada capítulo
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
    todos.length = 0;
  }

  const k = clave(datos.fuente, datos.id);
  const previo = todos.find((l) => l.clave === k);
  const ahora = Date.now();

  if (previo && ahora - previo.abiertoEn < RENOVAR_MS && previo.capitulos.length) {
    // Ya está guardado: solo se anota que se abrió y dónde va. Si había un
    // avance pendiente, se respeta (lo sube el sincronizador).
    await poner({
      ...previo,
      abiertoEn: ahora,
      ...(previo.pendiente ? {} : { capitulo: datos.capitulo, porcentaje: datos.porcentaje }),
    });
  } else {
    const ruta = `/api/libro/${encodeURIComponent(datos.fuente)}/${encodeURIComponent(datos.id)}`;
    const respuesta = await fetch(ruta);
    if (!respuesta.ok) return;
    const libro = (await respuesta.json()) as {
      titulo: string;
      autor: string;
      titulos: string[];
      capitulos: string[][];
    };
    await poner({
      clave: k,
      dueno: datos.dueno,
      fuente: datos.fuente,
      id: datos.id,
      titulo: libro.titulo,
      autor: libro.autor,
      titulos: libro.titulos,
      capitulos: libro.capitulos,
      capitulo: previo?.pendiente ? previo.capitulo : datos.capitulo,
      porcentaje: previo?.pendiente ? previo.porcentaje : datos.porcentaje,
      pendiente: previo?.pendiente ?? false,
      abiertoEn: ahora,
    });
  }

  // Solo se quedan los últimos LIMITE libros abiertos.
  const sobrantes = (await listarLibros()).slice(LIMITE);
  if (sobrantes.length) {
    await usar("readwrite", (a) => {
      for (const l of sobrantes) a.delete(l.clave);
    });
  }
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
