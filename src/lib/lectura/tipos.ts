// Forma del texto de un libro una vez preparado para leerse:
// una lista de capítulos, cada uno con su título y sus párrafos.

export type Capitulo = {
  titulo: string;
  parrafos: string[]; // un párrafo puede traer saltos de línea (versos)
};
