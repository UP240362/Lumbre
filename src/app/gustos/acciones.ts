"use server";

// Acciones del servidor de la pantalla "Tus gustos".

import { redirect } from "next/navigation";
import { esFuente } from "@/lib/fuentes";
import { obtenerUsuario } from "@/lib/sesion";
import type { LibroElegible } from "@/lib/sugerencias";
import { crearClienteServidor } from "@/lib/supabase/servidor";

const MAX_ELEMENTOS = 40;

// Lo que llega del navegador nunca es de fiar: aquí se revisa que tenga
// la forma correcta antes de guardarlo.
function limpiarAutores(valor: unknown): string[] {
  if (!Array.isArray(valor)) return [];
  const nombres = valor
    .filter((v): v is string => typeof v === "string")
    .map((v) => v.trim().slice(0, 120))
    .filter(Boolean);
  return [...new Set(nombres)].slice(0, MAX_ELEMENTOS);
}

function limpiarLibros(valor: unknown): LibroElegible[] {
  if (!Array.isArray(valor)) return [];
  const libros: LibroElegible[] = [];
  const vistos = new Set<string>();

  for (const v of valor) {
    if (typeof v !== "object" || v === null) continue;
    const { id, fuente, titulo, autor } = v as Record<string, unknown>;
    if (typeof id !== "string" || !/^[\w.:-]{1,80}$/.test(id)) continue;
    if (!esFuente(fuente)) continue;
    if (typeof titulo !== "string" || !titulo.trim()) continue;

    const clave = `${fuente}:${id}`;
    if (vistos.has(clave)) continue;
    vistos.add(clave);

    libros.push({
      id,
      fuente,
      titulo: titulo.trim().slice(0, 300),
      autor: typeof autor === "string" ? autor.trim().slice(0, 200) : "",
    });
  }
  return libros.slice(0, MAX_ELEMENTOS);
}

export async function guardarGustos(
  autoresRecibidos: unknown,
  librosRecibidos: unknown,
): Promise<{ error: string }> {
  const usuario = await obtenerUsuario();
  if (!usuario) redirect("/login");

  const autores = limpiarAutores(autoresRecibidos);
  const libros = limpiarLibros(librosRecibidos);
  const supabase = await crearClienteServidor();
  const fallo = { error: "No se pudieron guardar tus gustos. Intenta de nuevo." };

  // AUTORES: se borran los anteriores y se guardan los elegidos.
  const borrado = await supabase
    .from("autores_preferidos")
    .delete()
    .eq("user_id", usuario.id);
  if (borrado.error) return fallo;

  if (autores.length > 0) {
    const { error } = await supabase
      .from("autores_preferidos")
      .insert(autores.map((nombre_autor) => ({ nombre_autor })));
    if (error) return fallo;
  }

  // LIBROS: se quitan los favoritos que se desmarcaron y se agregan los nuevos.
  const actuales = await supabase
    .from("libros_favoritos")
    .select("book_id, fuente")
    .eq("user_id", usuario.id);
  if (actuales.error) return fallo;

  const elegidos = new Set(libros.map((l) => `${l.fuente}:${l.id}`));
  for (const fila of actuales.data) {
    if (elegidos.has(`${fila.fuente}:${fila.book_id}`)) continue;
    const { error } = await supabase
      .from("libros_favoritos")
      .delete()
      .eq("user_id", usuario.id)
      .eq("fuente", fila.fuente)
      .eq("book_id", fila.book_id);
    if (error) return fallo;
  }

  if (libros.length > 0) {
    const { error } = await supabase.from("libros_favoritos").upsert(
      libros.map((l) => ({
        user_id: usuario.id,
        book_id: l.id,
        fuente: l.fuente,
        titulo: l.titulo,
        autor: l.autor || null,
      })),
      { onConflict: "user_id,fuente,book_id", ignoreDuplicates: true },
    );
    if (error) return fallo;
  }

  const marcado = await marcarCompletado(usuario.id);
  if (!marcado) return fallo;

  redirect("/");
}

// "Omitir por ahora": no guarda gustos, solo anota que ya pasó por aquí.
export async function omitirGustos() {
  const usuario = await obtenerUsuario();
  if (!usuario) redirect("/login");
  await marcarCompletado(usuario.id);
  redirect("/");
}

async function marcarCompletado(idUsuario: string): Promise<boolean> {
  const supabase = await crearClienteServidor();
  const { error } = await supabase
    .from("profiles")
    .update({ gustos_completados: true })
    .eq("id", idUsuario);
  return !error;
}
