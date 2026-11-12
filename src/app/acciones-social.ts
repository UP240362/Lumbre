"use server";

// Apodo, privacidad y amistades. Las reglas de quién puede ver qué viven en
// la base de datos (supabase/migrations/0009_social.sql y 0010); aquí solo
// se revisa lo que llega del navegador y se llaman esas funciones.

import { revalidatePath } from "next/cache";
import { obtenerUsuario, type Visibilidad } from "@/lib/sesion";
import { crearClienteServidor } from "@/lib/supabase/servidor";

const ES_APODO = /^[a-z0-9_.]{3,20}$/;
// Apodos que podrían confundirse con la app o con un administrador.
const RESERVADOS = new Set(["lumbre", "admin", "administrador", "soporte", "moderador", "oficial", "sistema"]);

type Resultado = { ok: true } | { ok: false; error: string };

export async function guardarApodo(valor: unknown): Promise<Resultado> {
  if (typeof valor !== "string") return { ok: false, error: "Apodo no válido." };
  const apodo = valor.trim().toLowerCase().replace(/^@/, "");
  if (!ES_APODO.test(apodo)) {
    return {
      ok: false,
      error: "Usa de 3 a 20 letras minúsculas, números, punto o guion bajo (sin espacios ni acentos).",
    };
  }
  if (RESERVADOS.has(apodo)) return { ok: false, error: "Ese apodo no está disponible." };

  const usuario = await obtenerUsuario();
  if (!usuario) return { ok: false, error: "Inicia sesión primero." };

  const supabase = await crearClienteServidor();
  const { error } = await supabase.from("profiles").update({ apodo }).eq("id", usuario.id);
  if (error) {
    return {
      ok: false,
      error: error.code === "23505" ? "Ese apodo ya lo tiene alguien más." : "No se pudo guardar.",
    };
  }
  // Las reseñas ya escritas muestran el apodo nuevo.
  await supabase.from("resenas").update({ nombre: apodo }).eq("user_id", usuario.id);
  revalidatePath("/", "layout");
  return { ok: true };
}

export async function guardarPrivacidad(datos: {
  visibilidad: unknown;
  mostrar_tiempo: unknown;
  mostrar_favoritos: unknown;
  mostrar_resenas: unknown;
  mostrar_gustos: unknown;
}): Promise<Resultado> {
  const visibles: Visibilidad[] = ["publico", "amigos", "privado"];
  if (!visibles.includes(datos.visibilidad as Visibilidad)) return { ok: false, error: "Opción no válida." };
  const banderas = [datos.mostrar_tiempo, datos.mostrar_favoritos, datos.mostrar_resenas, datos.mostrar_gustos];
  if (banderas.some((b) => typeof b !== "boolean")) return { ok: false, error: "Opción no válida." };

  const usuario = await obtenerUsuario();
  if (!usuario) return { ok: false, error: "Inicia sesión primero." };

  const supabase = await crearClienteServidor();
  const { error } = await supabase
    .from("profiles")
    .update({
      visibilidad: datos.visibilidad,
      mostrar_tiempo: datos.mostrar_tiempo,
      mostrar_favoritos: datos.mostrar_favoritos,
      mostrar_resenas: datos.mostrar_resenas,
      mostrar_gustos: datos.mostrar_gustos,
    })
    .eq("id", usuario.id);
  return error ? { ok: false, error: "No se pudo guardar." } : { ok: true };
}

// ── Amistades ─────────────────────────────────────────────

export type Relacion = "amigo" | "enviada" | "recibida" | null;
export type Lector = { apodo: string; foto_version: number | null; relacion: Relacion };

const apodoValido = (v: unknown): v is string => typeof v === "string" && ES_APODO.test(v);

export async function buscarLectores(texto: unknown): Promise<Lector[]> {
  if (typeof texto !== "string" || texto.trim().length < 2) return [];
  const supabase = await crearClienteServidor();
  const { data } = await supabase.rpc("buscar_lectores", { p_texto: texto.slice(0, 40) });
  return (data ?? []) as Lector[];
}

// Una acción sobre la amistad con alguien: pedir, aceptar, rechazar o quitar.
export async function cambiarAmistad(
  apodo: unknown,
  accion: unknown,
): Promise<{ ok: true; relacion: Relacion } | { ok: false; error: string }> {
  if (!apodoValido(apodo)) return { ok: false, error: "Lector no válido." };
  const supabase = await crearClienteServidor();

  let respuesta;
  switch (accion) {
    case "pedir":
      respuesta = await supabase.rpc("enviar_solicitud", { p_apodo: apodo });
      break;
    case "aceptar":
    case "rechazar":
      respuesta = await supabase.rpc("responder_solicitud", {
        p_apodo: apodo,
        p_aceptar: accion === "aceptar",
      });
      break;
    case "quitar":
      respuesta = await supabase.rpc("quitar_amistad", { p_apodo: apodo });
      break;
    default:
      return { ok: false, error: "Acción no válida." };
  }
  if (respuesta.error) {
    const mensaje = respuesta.error.message;
    return {
      ok: false,
      error: /apodo|solicitudes|encontrado/i.test(mensaje) ? mensaje : "No se pudo. Intenta de nuevo.",
    };
  }
  revalidatePath("/amigos");
  return { ok: true, relacion: accion === "quitar" ? null : ((respuesta.data as Relacion) ?? null) };
}
