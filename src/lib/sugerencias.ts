// Autores y libros que se ofrecen como chips en la pantalla "Tus gustos".
// Son los del mockup; todos existen EN ESPAÑOL en alguna de las fuentes
// (los números son sus identificadores en esa fuente).

import type { IdFuente } from "./fuentes/tipos";

export type AutorSugerido = {
  nombre: string; // como se muestra y se guarda
  busqueda: string; // palabra con la que se le encuentra en las fuentes (etapa 6)
};

export const AUTORES_SUGERIDOS: AutorSugerido[] = [
  { nombre: "Miguel de Cervantes", busqueda: "Cervantes" },
  { nombre: "Jane Austen", busqueda: "Austen" },
  { nombre: "Julio Verne", busqueda: "Verne" },
  { nombre: "Mary Shelley", busqueda: "Shelley" },
  { nombre: "Edgar Allan Poe", busqueda: "Poe" },
  { nombre: "Fiódor Dostoievski", busqueda: "Dostoyevski" },
  { nombre: "Franz Kafka", busqueda: "Kafka" },
  { nombre: "Oscar Wilde", busqueda: "Wilde" },
  { nombre: "Benito Pérez Galdós", busqueda: "Galdós" },
  { nombre: "Sor Juana Inés de la Cruz", busqueda: "Sor Juana" },
  { nombre: "Robert Louis Stevenson", busqueda: "Stevenson" },
  { nombre: "Bram Stoker", busqueda: "Stoker" },
];

export type LibroElegible = {
  id: string;
  fuente: IdFuente;
  titulo: string;
  autor: string;
};

export const LIBROS_SUGERIDOS: LibroElegible[] = [
  { id: "2000", fuente: "gutenberg", titulo: "Don Quijote de la Mancha", autor: "Miguel de Cervantes" },
  { id: "1739", fuente: "elejandria", titulo: "Frankenstein", autor: "Mary Shelley" },
  { id: "2481", fuente: "elejandria", titulo: "Veinte mil leguas de viaje submarino", autor: "Julio Verne" },
  { id: "143", fuente: "elejandria", titulo: "Drácula", autor: "Bram Stoker" },
  { id: "20", fuente: "elejandria", titulo: "Orgullo y prejuicio", autor: "Jane Austen" },
  { id: "117", fuente: "elejandria", titulo: "La metamorfosis", autor: "Franz Kafka" },
  { id: "146", fuente: "elejandria", titulo: "Crimen y castigo", autor: "Fiódor Dostoievski" },
  { id: "1309", fuente: "elejandria", titulo: "La isla del tesoro", autor: "Robert Louis Stevenson" },
  { id: "1788", fuente: "elejandria", titulo: "El retrato de Dorian Gray", autor: "Oscar Wilde" },
];
