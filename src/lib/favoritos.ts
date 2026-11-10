// Consulta de los libros favoritos del usuario (lado del servidor).

import { cache } from "react";
import { crearClienteServidor } from "./supabase/servidor";

// Identificador único de un libro entre todas las fuentes: "fuente:id".
export function claveLibro(libro: { fuente: string; id: string }): string {
  return `${libro.fuente}:${libro.id}`;
}

// Devuelve las claves de todos los favoritos del usuario, para saber en
// cada tarjeta si el corazón va relleno. "cache" evita repetir la consulta
// cuando varias partes de la misma página la piden.
export const obtenerClavesFavoritas = cache(async (): Promise<Set<string>> => {
  const supabase = await crearClienteServidor();
  const { data } = await supabase
    .from("libros_favoritos")
    .select("book_id, fuente");
  return new Set(
    (data ?? []).map((f) => claveLibro({ fuente: f.fuente, id: f.book_id })),
  );
});
