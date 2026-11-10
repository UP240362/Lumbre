// CAPA DE FUENTES
// Lumbre no guarda libros: los pide a "fuentes" gratuitas por internet.
// Aquí se define la forma común que debe tener cualquier fuente, para que el
// resto de la aplicación no necesite saber de cuál viene cada libro.

import type { Capitulo } from "../lectura/tipos";

// Las fuentes que existen. Para añadir otra (Standard Ebooks, Open Library,
// Wikisource…) se agrega su nombre aquí y en NOMBRES_FUENTE.
export type IdFuente = "gutenberg" | "elejandria" | "archive";

// Nombre de cada fuente para mostrarlo en pantalla.
export const NOMBRES_FUENTE: Record<IdFuente, string> = {
  gutenberg: "Gutenberg",
  elejandria: "Elejandría",
  archive: "Internet Archive",
};

// Un libro, venga de donde venga.
export type Libro = {
  id: string; // identificador dentro de su fuente
  fuente: IdFuente;
  titulo: string;
  autores: string[]; // en formato "Nombre Apellido"
  idiomas: string[]; // códigos como "es" o "en"
  // Dónde se descarga el texto para leerlo. En los resultados de búsqueda
  // puede venir vacío (null); "obtener" lo llena.
  urlTexto: string | null;
};

// Lo que toda fuente debe saber hacer.
export interface FuenteLibros {
  id: IdFuente;
  nombre: string;
  buscar(consulta: string): Promise<Libro[]>;
  obtener(id: string): Promise<Libro | null>;
  // Descarga el texto del libro y lo entrega ya separado en capítulos.
  leer(libro: Libro): Promise<Capitulo[]>;
}
