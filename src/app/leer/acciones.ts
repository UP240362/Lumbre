"use server";

// Acción del servidor que guarda el avance de lectura en Supabase.
// El lector la llama solo, sin que el usuario pulse nada.

import { esFuente, obtenerLibro } from "@/lib/fuentes";
import { obtenerUsuario } from "@/lib/sesion";
import { crearClienteServidor } from "@/lib/supabase/servidor";

export async function guardarAvance(
  fuente: unknown,
  id: unknown,
  capitulo: unknown,
  porcentaje: unknown,
): Promise<{ ok: boolean }> {
  // Se revisa todo lo que llega del navegador antes de usarlo.
  if (!esFuente(fuente) || typeof id !== "string") return { ok: false };
  if (typeof capitulo !== "number" || !Number.isInteger(capitulo) || capitulo < 0) {
    return { ok: false };
  }
  if (typeof porcentaje !== "number" || !Number.isFinite(porcentaje)) {
    return { ok: false };
  }

  const usuario = await obtenerUsuario();
  if (!usuario) return { ok: false };

  // El título y el autor se toman de la fuente, no de lo que diga el navegador.
  const libro = await obtenerLibro(fuente, id).catch(() => null);
  if (!libro) return { ok: false };

  const supabase = await crearClienteServidor();
  // "upsert": crea el renglón si no existe, o lo actualiza si ya existe.
  const { error } = await supabase.from("progreso_lectura").upsert(
    {
      user_id: usuario.id,
      book_id: libro.id,
      fuente: libro.fuente,
      titulo: libro.titulo,
      autor: libro.autores.join(", ") || null,
      capitulo,
      porcentaje: Math.min(100, Math.max(0, Math.round(porcentaje * 100) / 100)),
      actualizado_en: new Date().toISOString(),
    },
    { onConflict: "user_id,fuente,book_id" },
  );

  return { ok: !error };
}
