"use server";

// Acción del servidor que agrega o quita un libro de favoritos.

import { esFuente, obtenerLibro } from "@/lib/fuentes";
import { obtenerUsuario } from "@/lib/sesion";
import { crearClienteServidor } from "@/lib/supabase/servidor";

export async function marcarFavorito(
  fuente: unknown,
  id: unknown,
  activo: unknown,
): Promise<{ ok: boolean }> {
  if (!esFuente(fuente) || typeof id !== "string" || typeof activo !== "boolean") {
    return { ok: false };
  }

  const usuario = await obtenerUsuario();
  if (!usuario) return { ok: false };
  const supabase = await crearClienteServidor();

  if (!activo) {
    const { error } = await supabase
      .from("libros_favoritos")
      .delete()
      .eq("user_id", usuario.id)
      .eq("fuente", fuente)
      .eq("book_id", id);
    return { ok: !error };
  }

  // El título y el autor se toman de la fuente, no de lo que diga el navegador.
  const libro = await obtenerLibro(fuente, id).catch(() => null);
  if (!libro) return { ok: false };

  const { error } = await supabase.from("libros_favoritos").upsert(
    {
      user_id: usuario.id,
      book_id: libro.id,
      fuente: libro.fuente,
      titulo: libro.titulo,
      autor: libro.autores.join(", ") || null,
    },
    { onConflict: "user_id,fuente,book_id", ignoreDuplicates: true },
  );
  return { ok: !error };
}
