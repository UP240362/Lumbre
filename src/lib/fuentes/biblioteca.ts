// FUENTE: "Biblioteca Lumbre", los libros que el dueño del sitio deja en una
// carpeta de su laptop (C:\Lumbre\libros). Todos los usuarios los pueden
// buscar y leer.
//
// ⚠️ Solo deben ir aquí libros de DOMINIO PÚBLICO o con licencia libre:
// todo lo que esté en la carpeta se comparte con cualquiera.
//
// Cómo se arma el catálogo (se revisa la carpeta cada minuto, sin reiniciar):
//   - Formatos: PDF (con texto, no escaneados), ePub y TXT. Se vale usar
//     subcarpetas.
//   - Título y autor: de los datos internos del ePub; si no hay, del nombre
//     del archivo con la forma "Autor - Título.pdf".
//   - Para corregir datos se puede poner un catalogo.json en la carpeta:
//       { "Cervantes - Quijote.pdf": { "titulo": "Don Quijote",
//         "autor": "Miguel de Cervantes", "idioma": "es" } }
//
// Seguridad: la carpeta se lee en modo solo lectura (en Docker) y a cada
// libro se le da un código. Nadie puede pedir un archivo por su ruta, así
// que no hay forma de leer otros archivos de la laptop.

import { createHash } from "node:crypto";
import { readdir, readFile, realpath, stat } from "node:fs/promises";
import path from "node:path";
import { strFromU8, unzipSync } from "fflate";
import { archivoACapitulos } from "../lectura/detectar";
import { decodificarHtml, simplificar } from "../texto";
import type { FuenteLibros, Libro } from "./tipos";

// Dónde está la carpeta. En Docker es /app/biblioteca (ver docker-compose).
const RAIZ =
  process.env.LUMBRE_BIBLIOTECA ||
  (process.platform === "win32" ? "C:\\Lumbre\\libros" : "/app/biblioteca");

const FORMATOS: Record<string, string> = {
  ".pdf": "application/pdf",
  ".epub": "application/epub+zip",
  ".txt": "text/plain; charset=utf-8",
};
const MAX_ARCHIVOS = 5000;
const MAX_TAMANO = 60 * 1024 * 1024; // 60 MB
const MAX_PROFUNDIDAD = 4; // subcarpetas
const REVISAR_CADA_MS = 60_000;
const ES_ID = /^[0-9a-f]{16}$/;

type Entrada = {
  id: string;
  relativa: string; // ruta dentro de la carpeta, con "/"
  tamano: number;
  modificado: number;
  titulo: string;
  autores: string[];
  idiomas: string[];
};

type Indice = { hecho: number; libros: Map<string, Entrada> };

let indice: Indice | null = null;
let enCurso: Promise<Indice> | null = null;

const idDe = (relativa: string) =>
  createHash("sha256").update(relativa).digest("hex").slice(0, 16);

// ── Datos de cada libro ─────────────────────────────────────────────

type Datos = { titulo?: string; autor?: string; idioma?: string };

// Lee título, autor e idioma del índice (.opf) de un ePub, sin abrir
// el resto del archivo.
function datosDeEpub(bytes: Uint8Array): Datos {
  try {
    const archivos = unzipSync(bytes, {
      filter: (f) => f.name === "META-INF/container.xml" || f.name.endsWith(".opf"),
    });
    const contenedor = archivos["META-INF/container.xml"];
    const rutaOpf = contenedor && strFromU8(contenedor).match(/full-path="([^"]+)"/)?.[1];
    const opf = rutaOpf && archivos[rutaOpf] ? strFromU8(archivos[rutaOpf]) : "";
    const campo = (nombre: string) => {
      const valor = opf.match(new RegExp(`<dc:${nombre}\\b[^>]*>([\\s\\S]*?)</dc:${nombre}>`))?.[1];
      return valor ? decodificarHtml(valor.replace(/<[^>]+>/g, "")) || undefined : undefined;
    };
    return { titulo: campo("title"), autor: campo("creator"), idioma: campo("language") };
  } catch {
    return {};
  }
}

// "Miguel de Cervantes - Don Quijote.pdf" → autor y título.
function datosDelNombre(relativa: string): Datos {
  const nombre = path.posix
    .basename(relativa, path.posix.extname(relativa))
    .replace(/[_]+/g, " ")
    .trim();
  const separado = nombre.match(/^(.+?)\s+-\s+(.+)$/);
  return separado ? { autor: separado[1], titulo: separado[2] } : { titulo: nombre };
}

async function leerCatalogo(): Promise<Record<string, Datos>> {
  try {
    const crudo = JSON.parse(await readFile(path.join(RAIZ, "catalogo.json"), "utf8"));
    return crudo && typeof crudo === "object" ? crudo : {};
  } catch {
    return {};
  }
}

const texto = (valor: unknown) =>
  typeof valor === "string" && valor.trim() ? valor.trim().slice(0, 300) : undefined;

// ── Revisar la carpeta ──────────────────────────────────────────────

// Lista los archivos de libros (sin seguir accesos directos ni carpetas
// ocultas).
async function listarArchivos(): Promise<string[]> {
  const encontrados: string[] = [];
  async function recorrer(carpeta: string, profundidad: number) {
    if (profundidad > MAX_PROFUNDIDAD || encontrados.length >= MAX_ARCHIVOS) return;
    const entradas = await readdir(path.join(RAIZ, carpeta), { withFileTypes: true }).catch(
      () => [],
    );
    for (const e of entradas) {
      if (e.name.startsWith(".") || e.isSymbolicLink()) continue;
      const relativa = carpeta ? `${carpeta}/${e.name}` : e.name;
      if (e.isDirectory()) await recorrer(relativa, profundidad + 1);
      else if (e.isFile() && FORMATOS[path.extname(e.name).toLowerCase()]) {
        encontrados.push(relativa);
        if (encontrados.length >= MAX_ARCHIVOS) return;
      }
    }
  }
  await recorrer("", 0);
  return encontrados;
}

async function construirIndice(): Promise<Indice> {
  const anterior = indice?.libros ?? new Map<string, Entrada>();
  const catalogo = await leerCatalogo();
  const libros = new Map<string, Entrada>();

  for (const relativa of await listarArchivos()) {
    const info = await stat(path.join(RAIZ, relativa)).catch(() => null);
    if (!info || info.size > MAX_TAMANO || info.size === 0) continue;
    const id = idDe(relativa);
    const corregido = catalogo[relativa] ?? catalogo[path.posix.basename(relativa)] ?? {};

    // Si el archivo no cambió, se reusan los datos ya leídos.
    const previo = anterior.get(id);
    let datos: Datos;
    if (previo && previo.modificado === info.mtimeMs && previo.tamano === info.size) {
      datos = { titulo: previo.titulo, autor: previo.autores.join(", "), idioma: previo.idiomas[0] };
    } else {
      const deEpub = relativa.toLowerCase().endsWith(".epub")
        ? datosDeEpub(new Uint8Array(await readFile(path.join(RAIZ, relativa))))
        : {};
      const delNombre = datosDelNombre(relativa);
      datos = {
        titulo: deEpub.titulo ?? delNombre.titulo,
        autor: deEpub.autor ?? delNombre.autor,
        idioma: deEpub.idioma,
      };
    }

    const autor = texto(corregido.autor) ?? texto(datos.autor);
    libros.set(id, {
      id,
      relativa,
      tamano: info.size,
      modificado: info.mtimeMs,
      titulo: texto(corregido.titulo) ?? texto(datos.titulo) ?? "Sin título",
      autores: autor ? [autor] : [],
      idiomas: [(texto(corregido.idioma) ?? texto(datos.idioma) ?? "es").slice(0, 2).toLowerCase()],
    });
  }
  return { hecho: Date.now(), libros };
}

async function obtenerIndice(): Promise<Indice> {
  if (indice && Date.now() - indice.hecho < REVISAR_CADA_MS) return indice;
  enCurso ??= construirIndice()
    .then((nuevo) => (indice = nuevo))
    .finally(() => (enCurso = null));
  return enCurso;
}

function aLibro(e: Entrada): Libro {
  return {
    id: e.id,
    fuente: "biblioteca",
    titulo: e.titulo,
    autores: e.autores,
    idiomas: e.idiomas,
    // Nunca la ruta real: solo un marcador con el código del libro.
    urlTexto: `biblioteca:${e.id}`,
  };
}

// Los libros más recientes de la carpeta (para mostrarlos en Explorar).
export async function librosRecientes(cuantos = 24): Promise<Libro[]> {
  const { libros } = await obtenerIndice();
  return [...libros.values()]
    .sort((a, b) => b.modificado - a.modificado)
    .slice(0, cuantos)
    .map(aLibro);
}

export const biblioteca: FuenteLibros = {
  id: "biblioteca",
  nombre: "Biblioteca Lumbre",

  async buscar(consulta) {
    const palabras = simplificar(consulta).split(/\s+/).filter(Boolean);
    if (palabras.length === 0) return [];
    const { libros } = await obtenerIndice();
    return [...libros.values()]
      .filter((e) => {
        const donde = simplificar(`${e.titulo} ${e.autores.join(" ")}`);
        return palabras.every((p) => donde.includes(p));
      })
      .slice(0, 40)
      .map(aLibro);
  },

  async obtener(id) {
    if (!ES_ID.test(id)) return null;
    const entrada = (await obtenerIndice()).libros.get(id);
    return entrada ? aLibro(entrada) : null;
  },

  async leer(libro) {
    const entrada = ES_ID.test(libro.id) ? (await obtenerIndice()).libros.get(libro.id) : undefined;
    if (!entrada) throw new Error("Ese libro ya no está en la biblioteca");

    // Doble seguro: la ruta real debe quedar dentro de la carpeta.
    const raiz = await realpath(RAIZ);
    const ruta = await realpath(path.join(raiz, entrada.relativa));
    if (!ruta.startsWith(raiz + path.sep)) throw new Error("Ruta no permitida");

    const datos = new Uint8Array(await readFile(ruta));
    return archivoACapitulos(datos, FORMATOS[path.extname(ruta).toLowerCase()]);
  },
};
