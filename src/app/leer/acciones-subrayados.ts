"use server";

// Acciones del servidor para crear, cambiar y borrar subrayados y notas.
// Las reglas RLS de Supabase garantizan que cada quien solo toque los suyos.

import { esFuente } from "@/lib/fuentes";
import { obtenerUsuario } from "@/lib/sesion";
import {
  COLUMNAS_SUBRAYADO,
  MAX_NOTA,
  MAX_TEXTO,
  esColor,
  type Color,
  type Subrayado,
} from "@/lib/subrayados";
import { crearClienteServidor } from "@/lib/supabase/servidor";

const ES_UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function esEntero(valor: unknown, maximo = 1_000_000): valor is number {
  return (
    typeof valor === "number" &&
    Number.isInteger(valor) &&
    valor >= 0 &&
    valor <= maximo
  );
}

function limpiarNota(valor: unknown): string | null {
  if (typeof valor !== "string") return null;
  const nota = valor.trim().slice(0, MAX_NOTA);
  return nota || null;
}

export async function crearSubrayado(datos: {
  fuente: unknown;
  bookId: unknown;
  capitulo: unknown;
  inicioParrafo: unknown;
  inicioOffset: unknown;
  finParrafo: unknown;
  finOffset: unknown;
  texto: unknown;
  color: unknown;
}): Promise<Subrayado | null> {
  const { fuente, bookId, capitulo, inicioParrafo, inicioOffset, finParrafo, finOffset, texto, color } = datos;

  // Se revisa todo lo que llega del navegador antes de guardarlo.
  if (!esFuente(fuente) || typeof bookId !== "string" || !bookId || bookId.length > 100) {
    return null;
  }
  if (
    !esEntero(capitulo, 100_000) ||
    !esEntero(inicioParrafo) || !esEntero(inicioOffset) ||
    !esEntero(finParrafo) || !esEntero(finOffset)
  ) {
    return null;
  }
  const enOrden =
    inicioParrafo < finParrafo ||
    (inicioParrafo === finParrafo && inicioOffset < finOffset);
  if (!enOrden) return null;
  if (typeof texto !== "string" || !texto.trim() || texto.length > MAX_TEXTO) return null;
  if (!esColor(color)) return null;

  const usuario = await obtenerUsuario();
  if (!usuario) return null;

  const supabase = await crearClienteServidor();
  const { data, error } = await supabase
    .from("subrayados")
    .insert({
      fuente,
      book_id: bookId,
      capitulo,
      inicio_parrafo: inicioParrafo,
      inicio_offset: inicioOffset,
      fin_parrafo: finParrafo,
      fin_offset: finOffset,
      texto,
      color,
    })
    .select(COLUMNAS_SUBRAYADO)
    .single();

  return error ? null : (data as Subrayado);
}

export async function actualizarSubrayado(
  id: unknown,
  cambios: { color?: unknown; nota?: unknown },
): Promise<Subrayado | null> {
  if (typeof id !== "string" || !ES_UUID.test(id)) return null;

  const datos: { color?: Color; nota?: string | null; actualizado_en: string } = {
    actualizado_en: new Date().toISOString(),
  };
  if (cambios.color !== undefined) {
    if (!esColor(cambios.color)) return null;
    datos.color = cambios.color;
  }
  if (cambios.nota !== undefined) datos.nota = limpiarNota(cambios.nota);

  const usuario = await obtenerUsuario();
  if (!usuario) return null;

  const supabase = await crearClienteServidor();
  const { data, error } = await supabase
    .from("subrayados")
    .update(datos)
    .eq("id", id)
    .select(COLUMNAS_SUBRAYADO)
    .single();

  return error ? null : (data as Subrayado);
}

export async function eliminarSubrayado(id: unknown): Promise<{ ok: boolean }> {
  if (typeof id !== "string" || !ES_UUID.test(id)) return { ok: false };

  const usuario = await obtenerUsuario();
  if (!usuario) return { ok: false };

  const supabase = await crearClienteServidor();
  const { error } = await supabase.from("subrayados").delete().eq("id", id);
  return { ok: !error };
}
