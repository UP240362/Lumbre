"use server";

// Acciones del servidor para guardar y borrar la reseña propia de un libro.
// Las reglas RLS de Supabase garantizan que cada quien solo toque la suya.

import { esFuente, obtenerLibro } from "@/lib/fuentes";
import { ipDelVisitante, limites } from "@/lib/limites";
import {
  MAX_TEXTO_RESENA,
  resenasDelLibro,
  sePuedeResenar,
  type DatosResenas,
} from "@/lib/resenas";
import { obtenerPerfil, obtenerUsuario } from "@/lib/sesion";
import { crearClienteServidor } from "@/lib/supabase/servidor";

type Respuesta = { ok: true; datos: DatosResenas } | { ok: false; error: string };

export async function guardarResena(
  fuente: unknown,
  id: unknown,
  calificacion: unknown,
  texto: unknown,
): Promise<Respuesta> {
  // Se revisa todo lo que llega del navegador antes de usarlo.
  if (!esFuente(fuente) || !sePuedeResenar(fuente)) {
    return { ok: false, error: "Este libro no se puede reseñar." };
  }
  if (typeof id !== "string" || !id || id.length > 100) {
    return { ok: false, error: "Libro no válido." };
  }
  if (
    typeof calificacion !== "number" ||
    !Number.isInteger(calificacion) ||
    calificacion < 1 ||
    calificacion > 5
  ) {
    return { ok: false, error: "Elige de 1 a 5 estrellas." };
  }
  if (texto !== null && typeof texto !== "string") {
    return { ok: false, error: "Reseña no válida." };
  }
  const limpio = (texto ?? "").replace(/\r\n/g, "\n").trim();
  if (limpio.length > MAX_TEXTO_RESENA) {
    return { ok: false, error: `La reseña puede tener hasta ${MAX_TEXTO_RESENA} letras.` };
  }

  const usuario = await obtenerUsuario();
  if (!usuario) return { ok: false, error: "Inicia sesión para calificar." };
  if (!limites.resenas(await ipDelVisitante())) {
    return { ok: false, error: "Demasiadas reseñas seguidas. Espera un rato." };
  }

  // El título y el autor se toman de la fuente, no de lo que diga el navegador.
  const libro = await obtenerLibro(fuente, id).catch(() => null);
  if (!libro) return { ok: false, error: "No encontramos ese libro." };
  const perfil = await obtenerPerfil();

  const supabase = await crearClienteServidor();
  const ahora = new Date().toISOString();
  const { error } = await supabase.from("resenas").upsert(
    {
      user_id: usuario.id,
      fuente: libro.fuente,
      book_id: libro.id,
      titulo: libro.titulo.slice(0, 300),
      autor: libro.autores.join(", ").slice(0, 300) || null,
      nombre: perfil.nombre?.trim().slice(0, 80) || null,
      calificacion,
      texto: limpio || null,
      actualizado_en: ahora,
    },
    { onConflict: "user_id,fuente,book_id" },
  );
  if (error) return { ok: false, error: "No se pudo guardar. Intenta de nuevo." };

  return { ok: true, datos: await resenasDelLibro(libro.fuente, libro.id, usuario.id) };
}

export async function borrarResena(fuente: unknown, id: unknown): Promise<Respuesta> {
  if (!esFuente(fuente) || typeof id !== "string" || !id || id.length > 100) {
    return { ok: false, error: "Libro no válido." };
  }
  const usuario = await obtenerUsuario();
  if (!usuario) return { ok: false, error: "Inicia sesión primero." };

  const supabase = await crearClienteServidor();
  const { error } = await supabase
    .from("resenas")
    .delete()
    .eq("user_id", usuario.id)
    .eq("fuente", fuente)
    .eq("book_id", id);
  if (error) return { ok: false, error: "No se pudo borrar. Intenta de nuevo." };

  return { ok: true, datos: await resenasDelLibro(fuente, id, usuario.id) };
}
