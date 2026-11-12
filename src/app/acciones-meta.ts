"use server";

// Guarda (o quita) la meta de lectura semanal del usuario.

import { obtenerUsuario } from "@/lib/sesion";
import { crearClienteServidor } from "@/lib/supabase/servidor";

export async function guardarMeta(minutos: unknown): Promise<{ ok: boolean }> {
  // null = quitar la meta. Si no, de 10 minutos a 168 horas (toda la semana).
  const valida =
    minutos === null ||
    (typeof minutos === "number" && Number.isInteger(minutos) && minutos >= 10 && minutos <= 10080);
  if (!valida) return { ok: false };

  const usuario = await obtenerUsuario();
  if (!usuario) return { ok: false };

  const supabase = await crearClienteServidor();
  const { error } = await supabase
    .from("profiles")
    .update({ meta_semanal_minutos: minutos })
    .eq("id", usuario.id);
  return { ok: !error };
}
