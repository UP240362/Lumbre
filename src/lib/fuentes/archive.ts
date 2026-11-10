// FUENTE: Internet Archive (archive.org), usando su API de búsqueda.
//
// OJO: en Internet Archive cualquiera puede subir archivos, y hay muchos
// libros con derechos de autor subidos sin permiso. Lumbre es solo para
// dominio público, así que aquí se aplica un filtro estricto:
//   - solo libros escaneados por bibliotecas (no subidos por particulares),
//   - publicados hasta 1929 (dominio público en EE. UU.),
//   - que no sean de préstamo, y que tengan texto disponible.

import { cacheLife } from "next/cache";
import { textoACapitulos } from "../lectura/textoPlano";
import { ordenarNombre } from "../texto";
import { comoTexto, descargar } from "./descargar";
import type { FuenteLibros, Libro } from "./tipos";

const BASE = "https://archive.org";
const AGENTE = "Lumbre/0.1 (lector de libros de dominio publico)";

const ANIO_MAXIMO = 1929;
const COLECCIONES_DE_BIBLIOTECAS = [
  "americana",
  "toronto",
  "europeanlibraries",
  "googlebooks",
];
const COLECCIONES_DE_PRESTAMO = ["inlibrary", "printdisabled"];

const FILTRO_DOMINIO_PUBLICO = [
  "mediatype:texts",
  "format:(DjVuTXT)",
  "language:(spa OR Spanish)",
  `year:[1400 TO ${ANIO_MAXIMO}]`,
  `collection:(${COLECCIONES_DE_BIBLIOTECAS.join(" OR ")})`,
  `-collection:(${COLECCIONES_DE_PRESTAMO.join(" OR ")})`,
].join(" AND ");

// La API a veces da un solo valor y a veces una lista.
function comoLista(valor: unknown): string[] {
  if (Array.isArray(valor)) return valor.filter((v) => typeof v === "string");
  return typeof valor === "string" ? [valor] : [];
}

function limpiarTitulo(titulo: string): string {
  return titulo.replace(/\s+/g, " ").replace(/[\s.:;,/]+$/, "").trim();
}

async function pedirBusqueda(consulta: string): Promise<Libro[]> {
  "use cache";
  cacheLife("hours");

  // Se quitan los símbolos que tienen significado especial en la búsqueda.
  const palabras = consulta.replace(/[^\p{L}\p{N}\s]/gu, " ").trim();
  if (!palabras) return [];

  const parametros = new URLSearchParams({
    q: `(title:(${palabras}) OR creator:(${palabras})) AND ${FILTRO_DOMINIO_PUBLICO}`,
    rows: "10",
    output: "json",
  });
  for (const campo of ["identifier", "title", "creator"]) {
    parametros.append("fl[]", campo);
  }
  parametros.append("sort[]", "downloads desc");

  const respuesta = await fetch(`${BASE}/advancedsearch.php?${parametros}`, {
    headers: { "User-Agent": AGENTE },
    signal: AbortSignal.timeout(12000),
  });
  if (!respuesta.ok) {
    throw new Error(`Internet Archive respondió ${respuesta.status}`);
  }

  const datos = await respuesta.json();
  const documentos: Record<string, unknown>[] = datos?.response?.docs ?? [];

  return documentos.flatMap((doc) => {
    const id = typeof doc.identifier === "string" ? doc.identifier : "";
    const titulo = comoLista(doc.title)[0];
    if (!id || !titulo) return [];
    return [
      {
        id,
        fuente: "archive" as const,
        titulo: limpiarTitulo(titulo),
        autores: comoLista(doc.creator).slice(0, 2).map(ordenarNombre),
        idiomas: ["es"],
        urlTexto: null,
      },
    ];
  });
}

async function pedirLibro(id: string): Promise<Libro | null> {
  "use cache";
  cacheLife("days");

  const respuesta = await fetch(`${BASE}/metadata/${id}`, {
    headers: { "User-Agent": AGENTE },
    signal: AbortSignal.timeout(12000),
  });
  if (!respuesta.ok) {
    throw new Error(`Internet Archive respondió ${respuesta.status}`);
  }

  const datos = await respuesta.json();
  const meta: Record<string, unknown> | undefined = datos?.metadata;
  if (!meta) return null;

  // Se repite el filtro de dominio público: así nadie puede abrir un libro
  // con derechos escribiendo su identificador a mano en la dirección.
  const colecciones = comoLista(meta.collection);
  const anio = Number(String(meta.year ?? meta.date ?? "").slice(0, 4));
  const esDeBiblioteca = colecciones.some((c) =>
    COLECCIONES_DE_BIBLIOTECAS.includes(c),
  );
  const esDePrestamo = colecciones.some((c) =>
    COLECCIONES_DE_PRESTAMO.includes(c),
  );
  if (!esDeBiblioteca || esDePrestamo || !(anio > 0 && anio <= ANIO_MAXIMO)) {
    return null;
  }

  // Busca el archivo de texto plano entre los archivos del libro.
  const archivos: { name?: string; format?: string }[] = datos?.files ?? [];
  const texto = archivos.find((a) => a.format === "DjVuTXT" && a.name);
  const titulo = comoLista(meta.title)[0];
  if (!texto?.name || !titulo) return null;

  return {
    id,
    fuente: "archive",
    titulo: limpiarTitulo(titulo),
    autores: comoLista(meta.creator).slice(0, 2).map(ordenarNombre),
    idiomas: ["es"],
    urlTexto: `${BASE}/download/${id}/${encodeURIComponent(texto.name)}`,
  };
}

export const archive: FuenteLibros = {
  id: "archive",
  nombre: "Internet Archive",

  async buscar(consulta) {
    const limpia = consulta.trim();
    return limpia ? pedirBusqueda(limpia) : [];
  },

  async obtener(id) {
    if (!/^[\w.-]{1,100}$/.test(id)) return null;
    return pedirLibro(id);
  },

  // Internet Archive entrega texto plano sacado del escaneo (OCR).
  async leer(libro) {
    const datos = libro.urlTexto ? await descargar(libro.urlTexto) : null;
    if (!datos) throw new Error("Internet Archive no tiene el texto de este libro");
    return textoACapitulos(comoTexto(datos));
  },
};
