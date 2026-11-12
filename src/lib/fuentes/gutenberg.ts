// FUENTE: Project Gutenberg, usando su catálogo oficial en formato OPDS
// (un formato XML pensado para aplicaciones de lectura).
//
// Nota: el plan era usar Gutendex, que es una API no oficial sobre este mismo
// catálogo, pero tarda entre 50 y 100 segundos en contestar. El catálogo
// oficial responde en menos de un segundo y usa los mismos números de libro.

import { cacheLife } from "next/cache";
import { htmlACapitulos } from "../lectura/html";
import { medidasImagen } from "../lectura/medidas";
import { textoACapitulos } from "../lectura/textoPlano";
import { tipoDeImagen } from "../lectura/tipos";
import { comoTexto, descargar } from "./descargar";
import type { FuenteLibros, Libro } from "./tipos";

const BASE = "https://www.gutenberg.org";
const AGENTE = "Lumbre/0.1 (lector de libros de dominio publico)";

// Gutenberg escribe el idioma en inglés al final del título: "Niebla (Spanish)".
const IDIOMAS: Record<string, string> = {
  Spanish: "es",
  English: "en",
  French: "fr",
  German: "de",
  Italian: "it",
  Portuguese: "pt",
  Catalan: "ca",
  Latin: "la",
  Dutch: "nl",
  Tagalog: "tl",
  Finnish: "fi",
  Greek: "el",
  Chinese: "zh",
};

// Convierte &amp; y similares en sus letras reales.
function decodificar(texto: string): string {
  return texto
    .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n)))
    .replace(/&#x([0-9a-f]+);/gi, (_, n) => String.fromCodePoint(parseInt(n, 16)))
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&amp;/g, "&")
    .replace(/\s+/g, " ")
    .trim();
}

// "Niebla (Nivola) (Spanish)" → título "Niebla (Nivola)", idiomas ["es"]
function separarIdiomas(tituloCrudo: string) {
  let titulo = tituloCrudo;
  const idiomas: string[] = [];
  for (;;) {
    const final = titulo.match(/\s*\(([A-Za-z]+)\)$/);
    if (!final || !IDIOMAS[final[1]]) break;
    idiomas.unshift(IDIOMAS[final[1]]);
    titulo = titulo.slice(0, final.index).trim();
  }
  // Si no dice idioma, el libro está en inglés.
  return { titulo, idiomas: idiomas.length ? idiomas : ["en"] };
}

// "Cervantes Saavedra, Miguel de" → "Miguel de Cervantes Saavedra"
function ordenarNombre(nombre: string): string {
  const [apellido, ...resto] = nombre.split(",").map((p) => p.trim());
  return resto.length ? `${resto.join(" ")} ${apellido}` : apellido;
}

function urlTexto(id: string): string {
  return `${BASE}/cache/epub/${id}/pg${id}-images.html`;
}

// Las ilustraciones están junto a la página del libro ("images/p007.jpg").
// Solo se aceptan rutas sencillas dentro de esa carpeta.
function rutaImagen(src: string): string | null {
  const ruta = src.split("#")[0];
  if (!/^[\w-][\w\-./]*$/.test(ruta) || ruta.includes("..") || !tipoDeImagen(ruta)) return null;
  return ruta;
}

// Ancho y alto de una ilustración, pidiendo solo sus primeros 64 KB.
// Se guarda para siempre: la imagen de un libro no cambia.
async function medidasDe(id: string, ruta: string) {
  "use cache";
  cacheLife("max");
  const respuesta = await fetch(`${BASE}/cache/epub/${id}/${ruta}`, {
    headers: { "User-Agent": AGENTE, Range: "bytes=0-65535" },
    signal: AbortSignal.timeout(8000),
  });
  if (respuesta.status === 404) return null;
  if (!respuesta.ok) throw new Error(`Gutenberg respondió ${respuesta.status}`);
  return medidasImagen(new Uint8Array(await respuesta.arrayBuffer()));
}

// Lee la lista de resultados de una búsqueda.
function leerResultados(xml: string): Libro[] {
  const libros: Libro[] = [];

  for (const [, entrada] of xml.matchAll(/<entry>([\s\S]*?)<\/entry>/g)) {
    // Solo nos interesan las entradas que son libros (tienen número).
    const id = entrada.match(/<id>[^<]*\/ebooks\/(\d+)\.opds<\/id>/)?.[1];
    if (!id) continue;

    const { titulo, idiomas } = separarIdiomas(
      decodificar(entrada.match(/<title>([\s\S]*?)<\/title>/)?.[1] ?? ""),
    );
    const contenido = decodificar(
      entrada.match(/<content[^>]*>([\s\S]*?)<\/content>/)?.[1] ?? "",
    );
    // Cuando no hay autor, Gutenberg pone "1234 downloads" en su lugar.
    const autores = /^\d+ downloads$/.test(contenido)
      ? []
      : contenido.split(/,\s+|\s+and\s+/).filter(Boolean);

    libros.push({
      id,
      fuente: "gutenberg",
      titulo,
      autores,
      idiomas,
      urlTexto: urlTexto(id),
    });
  }

  return libros;
}

// Pide una búsqueda al catálogo. "use cache" guarda la respuesta unas horas:
// si alguien repite la misma búsqueda, no se vuelve a molestar a Gutenberg.
async function pedirBusqueda(consulta: string): Promise<Libro[]> {
  "use cache";
  cacheLife("hours");

  const url = `${BASE}/ebooks/search.opds/?query=${encodeURIComponent(consulta)}`;
  const respuesta = await fetch(url, {
    headers: { "User-Agent": AGENTE },
    signal: AbortSignal.timeout(12000),
  });
  if (!respuesta.ok) {
    throw new Error(`Gutenberg respondió ${respuesta.status}`);
  }
  return leerResultados(await respuesta.text());
}

async function pedirLibro(id: string): Promise<Libro | null> {
  "use cache";
  cacheLife("days");

  const respuesta = await fetch(`${BASE}/ebooks/${id}.opds`, {
    headers: { "User-Agent": AGENTE },
    signal: AbortSignal.timeout(12000),
  });
  if (respuesta.status === 404) return null;
  if (!respuesta.ok) {
    throw new Error(`Gutenberg respondió ${respuesta.status}`);
  }

  const xml = await respuesta.text();
  const entrada = xml.match(/<entry>([\s\S]*?)<\/entry>/)?.[1];
  if (!entrada) return null;

  const titulo = decodificar(
    entrada.match(/<title>([\s\S]*?)<\/title>/)?.[1] ?? "",
  );
  const autores = [...entrada.matchAll(/<author>\s*<name>([\s\S]*?)<\/name>/g)]
    .map(([, nombre]) => ordenarNombre(decodificar(nombre)));
  const idiomas = [...entrada.matchAll(/<p>Language: ([A-Za-z]+)<\/p>/g)]
    .map(([, idioma]) => IDIOMAS[idioma])
    .filter(Boolean);

  return {
    id,
    fuente: "gutenberg",
    titulo,
    autores,
    idiomas: idiomas.length ? idiomas : ["en"],
    urlTexto: urlTexto(id),
  };
}

// Libros de un autor, del más descargado al menos (así los ordena
// Gutenberg). "idAutor" es su número de autor en Gutenberg.
export async function librosDeAutor(idAutor: string): Promise<Libro[]> {
  "use cache";
  cacheLife("days");

  if (!/^\d+$/.test(idAutor)) return [];
  const respuesta = await fetch(`${BASE}/ebooks/author/${idAutor}.opds`, {
    headers: { "User-Agent": AGENTE },
    signal: AbortSignal.timeout(12000),
  });
  if (!respuesta.ok) return [];
  return leerResultados(await respuesta.text());
}

export const gutenberg: FuenteLibros = {
  id: "gutenberg",
  nombre: "Project Gutenberg",

  // Busca por título o autor. Hace dos búsquedas a la vez: una solo en
  // español ("l.es" es el filtro de idioma de Gutenberg) y otra general,
  // y pone primero los resultados en español.
  async buscar(consulta) {
    const limpia = consulta.trim();
    if (!limpia) return [];

    const [enEspanol, general] = await Promise.allSettled([
      pedirBusqueda(`l.es ${limpia}`),
      pedirBusqueda(limpia),
    ]);
    // Si las dos fallaron, avisamos del error; si solo una, usamos la otra.
    if (enEspanol.status === "rejected" && general.status === "rejected") {
      throw general.reason;
    }

    const vistos = new Set<string>();
    const libros: Libro[] = [];
    for (const resultado of [enEspanol, general]) {
      if (resultado.status !== "fulfilled") continue;
      for (const libro of resultado.value) {
        if (vistos.has(libro.id)) continue;
        vistos.add(libro.id);
        libros.push(libro);
      }
    }
    return libros;
  },

  async obtener(id) {
    if (!/^\d+$/.test(id)) return null;
    return pedirLibro(id);
  },

  // Gutenberg ofrece cada libro como página HTML. Antes y después del libro
  // pone avisos legales propios ("pg-header" y "pg-footer"), que se quitan.
  async leer(libro) {
    const html = await descargar(urlTexto(libro.id));
    if (html) {
      const sinAvisos = comoTexto(html)
        .replace(
          /<(section|header|footer|div)\b[^>]*\bid="pg-(?:header|footer)"[\s\S]*?<\/\1>/gi,
          "",
        )
        // Marcas del número de página del libro en papel, como "[Pg 3]".
        .replace(/<span\b[^>]*class="[^"]*pagenum[^"]*"[^>]*>[\s\S]*?<\/span>/gi, "")
        .replace(/\[Pg\s*\d+\]/g, "");
      return htmlACapitulos(sinAvisos, {
        imagen: (src) => {
          const ruta = rutaImagen(src);
          return ruta ? { ruta } : null;
        },
      });
    }

    // Algunos libros antiguos solo existen como texto plano.
    const plano = await descargar(`${BASE}/ebooks/${libro.id}.txt.utf-8`);
    if (!plano) throw new Error("Gutenberg no tiene el texto de este libro");
    const texto = comoTexto(plano);
    const inicio = texto.match(/\*\*\* ?START OF[^\n]*\n/);
    const fin = texto.search(/\*\*\* ?END OF/);
    return textoACapitulos(
      texto.slice(
        inicio ? (inicio.index ?? 0) + inicio[0].length : 0,
        fin > 0 ? fin : undefined,
      ),
    );
  },

  async imagen(libro, ruta) {
    const valida = rutaImagen(ruta);
    const tipo = valida && tipoDeImagen(valida);
    if (!valida || !tipo || !/^\d+$/.test(libro.id)) return null;
    const datos = await descargar(`${BASE}/cache/epub/${libro.id}/${valida}`);
    return datos ? { datos, tipo } : null;
  },

  async medidas(libro, ruta) {
    const valida = rutaImagen(ruta);
    if (!valida || !/^\d+$/.test(libro.id)) return null;
    return medidasDe(libro.id, valida);
  },
};
