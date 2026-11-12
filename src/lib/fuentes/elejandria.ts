// FUENTE: Elejandría (elejandria.com), libros en español de dominio público
// o con licencia libre.
//
// Elejandría no tiene API ni permite a programas usar su buscador, pero sí
// publica un "sitemap": la lista de todas sus páginas. Con esa lista armamos
// un índice propio (título, autor y número de cada libro) y buscamos en él.
// Los títulos del índice vienen de la dirección web, sin acentos; por eso,
// para los pocos resultados que se muestran, se lee la página del libro y
// se toma de ahí el título y el autor bien escritos.

import { cacheLife } from "next/cache";
import { epubACapitulos } from "../lectura/epub";
import { decodificarHtml, simplificar } from "../texto";
import { descargar } from "./descargar";
import { imagenDeArchivo } from "./imagenesEpub";
import type { FuenteLibros, Libro } from "./tipos";

// El archivo ePub del libro. El enlace de la página
// (.../libro/descargar/<titulo>/<autor>/<libro>/<archivo>) lleva a una
// pantalla intermedia; el archivo en sí está en link_descarga_libro.
async function bajarEpub(libro: Libro): Promise<Uint8Array | null> {
  const numeros = libro.urlTexto?.match(/\/(\d+)\/(\d+)$/);
  if (!numeros) throw new Error("Elejandría no ofrece este libro en ePub");
  return descargar(`${BASE}/libro/link_descarga_libro/${numeros[1]}/${numeros[2]}`);
}

const BASE = "https://www.elejandria.com";
const AGENTE = "Lumbre/0.1 (lector de libros de dominio publico)";
const MAX_RESULTADOS = 8;

type Entrada = {
  id: string;
  url: string;
  titulo: string; // sacado de la dirección: "orgullo y prejuicio"
  autor: string; // sacado de la dirección: "jane austen"
};

// Descarga el sitemap y lo convierte en el índice. Se guarda un día.
async function pedirIndice(): Promise<Entrada[]> {
  "use cache";
  cacheLife("days");

  const respuesta = await fetch(`${BASE}/sitemap.xml`, {
    headers: { "User-Agent": AGENTE },
    signal: AbortSignal.timeout(15000),
  });
  if (!respuesta.ok) {
    throw new Error(`Elejandría respondió ${respuesta.status}`);
  }
  const xml = await respuesta.text();

  // Las páginas de libros tienen la forma /libro/<titulo>/<autor>/<numero>
  const patron =
    /<loc>(https:\/\/www\.elejandria\.com\/libro\/([a-z0-9-]+)\/([a-z0-9-]+)\/(\d+))<\/loc>/g;
  const entradas: Entrada[] = [];
  for (const [, url, titulo, autor, id] of xml.matchAll(patron)) {
    entradas.push({
      id,
      url,
      titulo: titulo.replaceAll("-", " "),
      autor: autor.replaceAll("-", " "),
    });
  }
  return entradas;
}

// Lee la página de un libro: título y autor bien escritos, y enlace al ePub.
async function pedirPagina(url: string) {
  "use cache";
  cacheLife("days");

  const respuesta = await fetch(url, {
    headers: { "User-Agent": AGENTE },
    signal: AbortSignal.timeout(12000),
  });
  if (!respuesta.ok) {
    throw new Error(`Elejandría respondió ${respuesta.status}`);
  }
  const html = await respuesta.text();

  const titulo = html
    .match(/<meta property="og:title"\s+content="Libro (.*?) en PDF/)?.[1];
  const autor = html.match(/<a[^>]+\/autor\/[^>]*>\s*de ([^<]+)<\/a>/)?.[1];
  const epub = html.match(
    /href="(https:\/\/www\.elejandria\.com\/libro\/descargar\/[^"]+)"[^>]*>(?:(?!<\/a>)[\s\S])*?Descargar en ePub/,
  )?.[1];

  return {
    titulo: titulo ? decodificarHtml(titulo) : null,
    autor: autor ? decodificarHtml(autor) : null,
    urlEpub: epub ?? null,
  };
}

// "orgullo y prejuicio" → "Orgullo y prejuicio" (por si falla leer la página)
function conMayuscula(texto: string): string {
  return texto.charAt(0).toUpperCase() + texto.slice(1);
}

async function aLibro(entrada: Entrada): Promise<Libro> {
  const pagina = await pedirPagina(entrada.url).catch(() => null);
  return {
    id: entrada.id,
    fuente: "elejandria",
    titulo: pagina?.titulo ?? conMayuscula(entrada.titulo),
    autores: [
      pagina?.autor ??
        entrada.autor.replace(/\b\p{L}/gu, (letra) => letra.toUpperCase()),
    ],
    idiomas: ["es"],
    urlTexto: pagina?.urlEpub ?? null,
  };
}

// Libros de un autor en el índice: se reconocen porque la dirección del
// libro trae su primer nombre y su último apellido ("Juana Inés de la Cruz"
// → "sor-juana-ines-de-la-cruz"). Devuelve número y título aproximado.
export async function librosDeAutor(nombre: string) {
  const palabras = simplificar(nombre)
    .split(/[^a-z0-9]+/)
    .filter((p) => p.length >= 3 && !["del", "las", "los", "von", "van"].includes(p));
  if (palabras.length === 0) return [];
  const claves = [...new Set([palabras[0], palabras.at(-1)!])];

  const indice = await pedirIndice();
  return indice
    .filter((e) => {
      const autor = e.autor.split(" ");
      return claves.every((c) => autor.includes(c));
    })
    .map((e) => ({ id: e.id, titulo: e.titulo }));
}

export const elejandria: FuenteLibros = {
  id: "elejandria",
  nombre: "Elejandría",

  async buscar(consulta) {
    const palabras = simplificar(consulta)
      .split(/[^a-z0-9]+/)
      .filter((p) => p.length >= 2);
    if (palabras.length === 0) return [];

    const indice = await pedirIndice();

    // Un libro coincide si TODAS las palabras buscadas están en su título
    // o autor. Los que coinciden por título van primero.
    const coincidencias = indice
      .map((entrada) => {
        const enTitulo = palabras.filter((p) => entrada.titulo.includes(p));
        const todas = palabras.every(
          (p) => entrada.titulo.includes(p) || entrada.autor.includes(p),
        );
        return { entrada, puntos: todas ? 1 + enTitulo.length : 0 };
      })
      .filter((c) => c.puntos > 0)
      .sort((a, b) => b.puntos - a.puntos)
      .slice(0, MAX_RESULTADOS);

    return Promise.all(coincidencias.map((c) => aLibro(c.entrada)));
  },

  async obtener(id) {
    if (!/^\d+$/.test(id)) return null;
    const indice = await pedirIndice();
    const entrada = indice.find((e) => e.id === id);
    return entrada ? aLibro(entrada) : null;
  },

  // Elejandría entrega el libro como archivo ePub.
  async leer(libro) {
    const datos = await bajarEpub(libro);
    if (!datos) throw new Error("Elejandría no tiene el archivo de este libro");
    return epubACapitulos(datos);
  },

  imagen(libro, ruta) {
    return imagenDeArchivo(`elejandria:${libro.id}`, () => bajarEpub(libro), ruta);
  },
};
