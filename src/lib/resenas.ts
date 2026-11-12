// CALIFICACIONES Y RESEÑAS (lado del servidor)
// Leer las reseñas de un libro y los promedios para las tarjetas.
// Guardar y borrar están en src/app/leer/acciones-resenas.ts.

import { claveLibro } from "./favoritos";
import { crearClienteServidor } from "./supabase/servidor";

export const MAX_TEXTO_RESENA = 1000;
const MAX_RESENAS_MOSTRADAS = 50;

export type Resena = {
  nombre: string; // lo que se muestra (el apodo, o "Lector de Lumbre")
  apodo: string | null; // para enlazar a su perfil
  calificacion: number;
  texto: string;
  fecha: string; // ISO
};

export type DatosResenas = {
  promedio: number; // 0 si no hay
  cantidad: number;
  mia: Resena | null;
  otras: Resena[]; // de los demás, las más nuevas primero
};

export type Resumen = { promedio: number; cantidad: number };

// Los libros propios son privados: no se pueden reseñar.
export const sePuedeResenar = (fuente: string) => fuente !== "propio";

type Fila = {
  user_id: string;
  nombre: string | null;
  calificacion: number;
  texto: string | null;
  actualizado_en: string;
};

const aResena = (f: Fila): Resena => ({
  nombre: f.nombre?.trim() || "Lector de Lumbre",
  apodo: f.nombre?.trim() || null,
  calificacion: f.calificacion,
  texto: f.texto ?? "",
  fecha: f.actualizado_en,
});

export async function resenasDelLibro(
  fuente: string,
  id: string,
  usuarioId: string,
): Promise<DatosResenas> {
  const vacio: DatosResenas = { promedio: 0, cantidad: 0, mia: null, otras: [] };
  if (!sePuedeResenar(fuente)) return vacio;

  const supabase = await crearClienteServidor();
  const [{ data: filas }, { data: resumen }, { data: propia }] = await Promise.all([
    supabase
      .from("resenas")
      .select("user_id, nombre, calificacion, texto, actualizado_en")
      .eq("fuente", fuente)
      .eq("book_id", id)
      .neq("user_id", usuarioId)
      .order("actualizado_en", { ascending: false })
      .limit(MAX_RESENAS_MOSTRADAS),
    supabase
      .from("resenas_resumen")
      .select("promedio, cantidad")
      .eq("fuente", fuente)
      .eq("book_id", id)
      .maybeSingle(),
    supabase
      .from("resenas")
      .select("user_id, nombre, calificacion, texto, actualizado_en")
      .eq("fuente", fuente)
      .eq("book_id", id)
      .eq("user_id", usuarioId)
      .maybeSingle(),
  ]);

  return {
    promedio: resumen?.promedio ?? 0,
    cantidad: resumen?.cantidad ?? 0,
    mia: propia ? aResena(propia as Fila) : null,
    otras: ((filas ?? []) as Fila[]).map(aResena),
  };
}

export type MiResena = Resena & { fuente: string; id: string; titulo: string; autor: string };

// Todas las reseñas que escribió el usuario (para "Mis reseñas" en Mi
// perfil), las más nuevas primero.
export async function misResenas(usuarioId: string): Promise<MiResena[]> {
  const supabase = await crearClienteServidor();
  const { data } = await supabase
    .from("resenas")
    .select("fuente, book_id, titulo, autor, nombre, calificacion, texto, actualizado_en, user_id")
    .eq("user_id", usuarioId)
    .order("actualizado_en", { ascending: false })
    .limit(200);
  return (data ?? []).map((f) => ({
    ...aResena(f as Fila),
    fuente: f.fuente,
    id: f.book_id,
    titulo: f.titulo,
    autor: f.autor ?? "",
  }));
}

// Promedios de varios libros a la vez (para las rejillas de tarjetas).
// Devuelve un mapa "fuente:id" → resumen; los libros sin reseñas no salen.
export async function resumenesDe(
  libros: { fuente: string; id: string }[],
): Promise<Map<string, Resumen>> {
  const mapa = new Map<string, Resumen>();
  const ids = [...new Set(libros.filter((l) => sePuedeResenar(l.fuente)).map((l) => l.id))];
  if (ids.length === 0) return mapa;

  const supabase = await crearClienteServidor();
  const { data } = await supabase
    .from("resenas_resumen")
    .select("fuente, book_id, promedio, cantidad")
    .in("book_id", ids.slice(0, 200));

  const pedidas = new Set(libros.map(claveLibro));
  for (const fila of data ?? []) {
    const clave = claveLibro({ fuente: fila.fuente, id: fila.book_id });
    if (pedidas.has(clave)) mapa.set(clave, { promedio: fila.promedio, cantidad: fila.cantidad });
  }
  return mapa;
}
