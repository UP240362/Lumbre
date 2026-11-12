"use server";

// Subir y quitar la foto de perfil. La foto llega ya recortada y achicada
// por el navegador (EditorFoto.tsx); aquí se revisa que de verdad sea una
// imagen JPEG o WebP pequeña antes de guardarla.

import { ipDelVisitante, limites } from "@/lib/limites";
import { obtenerUsuario } from "@/lib/sesion";
import { crearClienteServidor } from "@/lib/supabase/servidor";

const MAX_BYTES = 512 * 1024;
const BUCKET = "fotos";

type Respuesta = { ok: true; version: number | null } | { ok: false; error: string };

// Revisa los primeros bytes del archivo (no basta con lo que diga el navegador).
function tipoReal(bytes: Uint8Array): "image/jpeg" | "image/webp" | null {
  if (bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return "image/jpeg";
  const texto = (a: number, b: number) => String.fromCharCode(...bytes.slice(a, b));
  if (texto(0, 4) === "RIFF" && texto(8, 12) === "WEBP") return "image/webp";
  return null;
}

export async function subirFoto(datos: FormData): Promise<Respuesta> {
  const usuario = await obtenerUsuario();
  if (!usuario) return { ok: false, error: "Inicia sesión primero." };
  if (!limites.fotos(await ipDelVisitante())) {
    return { ok: false, error: "Demasiados cambios de foto. Espera un rato." };
  }

  const archivo = datos.get("foto");
  if (!(archivo instanceof Blob) || archivo.size === 0) {
    return { ok: false, error: "No llegó ninguna foto." };
  }
  if (archivo.size > MAX_BYTES) return { ok: false, error: "La foto es demasiado grande." };

  const bytes = new Uint8Array(await archivo.arrayBuffer());
  const tipo = tipoReal(bytes);
  if (!tipo) return { ok: false, error: "El archivo no es una imagen válida." };

  const supabase = await crearClienteServidor();
  const { error } = await supabase.storage
    .from(BUCKET)
    .upload(usuario.id, bytes, { contentType: tipo, upsert: true, cacheControl: "0" });
  if (error) return { ok: false, error: "No se pudo guardar la foto. Intenta de nuevo." };

  const version = Date.now();
  const { error: errorPerfil } = await supabase
    .from("profiles")
    .update({ foto_version: version })
    .eq("id", usuario.id);
  if (errorPerfil) return { ok: false, error: "No se pudo guardar la foto. Intenta de nuevo." };

  return { ok: true, version };
}

export async function quitarFoto(): Promise<Respuesta> {
  const usuario = await obtenerUsuario();
  if (!usuario) return { ok: false, error: "Inicia sesión primero." };

  const supabase = await crearClienteServidor();
  await supabase.storage.from(BUCKET).remove([usuario.id]);
  const { error } = await supabase
    .from("profiles")
    .update({ foto_version: null })
    .eq("id", usuario.id);
  if (error) return { ok: false, error: "No se pudo quitar la foto. Intenta de nuevo." };
  return { ok: true, version: null };
}
