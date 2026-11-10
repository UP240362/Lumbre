"use server";

// Acciones del servidor de "Mis libros": agregar por enlace, registrar un
// archivo recién subido y eliminar.

import { leerLibro, obtenerLibro, olvidarLibro } from "@/lib/fuentes";
import { EnlaceNoPermitido, validarEnlace } from "@/lib/fuentes/descargarExterno";
import { ALMACEN } from "@/lib/fuentes/propio";
import { PdfSinTexto } from "@/lib/lectura/pdf";
import { ipDelVisitante, limites } from "@/lib/limites";
import { obtenerUsuario } from "@/lib/sesion";
import { crearClienteServidor } from "@/lib/supabase/servidor";

type Resultado = { ok: true; id: string } | { ok: false; error: string };

const LIMITE_LIBROS =
  "Agregaste muchos libros en poco tiempo. Espera un rato y vuelve a intentar.";

function limpiar(valor: unknown, maximo: number): string {
  return typeof valor === "string" ? valor.trim().slice(0, maximo) : "";
}

// Abre el libro recién guardado para comprobar que de verdad se puede leer.
// Si no se puede, se deshace el guardado y se explica por qué.
async function comprobarLectura(id: string): Promise<string | null> {
  try {
    const libro = await obtenerLibro("propio", id);
    if (!libro) return "No se pudo guardar el libro.";
    const capitulos = await leerLibro(libro);
    return capitulos.length > 0
      ? null
      : "No encontramos texto que leer en ese libro.";
  } catch (error) {
    if (error instanceof PdfSinTexto) {
      return "Ese PDF parece un escaneo (son fotos de las páginas) y no tiene texto que extraer.";
    }
    if (error instanceof EnlaceNoPermitido) return error.message;
    return "No pudimos leer ese libro. Revisa que sea un PDF, un ePub o una página con el texto.";
  }
}

export async function agregarEnlace(
  urlRecibida: unknown,
  tituloRecibido: unknown,
  autorRecibido: unknown,
): Promise<Resultado> {
  const usuario = await obtenerUsuario();
  if (!usuario) return { ok: false, error: "Tu sesión terminó. Vuelve a entrar." };

  const titulo = limpiar(tituloRecibido, 300);
  const autor = limpiar(autorRecibido, 200);
  if (!titulo) return { ok: false, error: "Escribe el título del libro." };
  if (!limites.libros(await ipDelVisitante())) {
    return { ok: false, error: LIMITE_LIBROS };
  }

  let url: string;
  try {
    url = (await validarEnlace(limpiar(urlRecibida, 2000))).href;
  } catch (error) {
    return {
      ok: false,
      error: error instanceof EnlaceNoPermitido ? error.message : "El enlace no es válido.",
    };
  }

  const supabase = await crearClienteServidor();
  const { data, error } = await supabase
    .from("libros_propios")
    .insert({ titulo, autor: autor || null, tipo: "enlace", url })
    .select("id")
    .single();
  if (error || !data) return { ok: false, error: "No se pudo guardar el libro." };

  const problema = await comprobarLectura(data.id);
  if (problema) {
    await supabase.from("libros_propios").delete().eq("id", data.id);
    return { ok: false, error: problema };
  }
  return { ok: true, id: data.id };
}

// El archivo ya fue subido por el navegador directo a Supabase Storage;
// aquí solo se anota en la tabla (y se comprueba que se pueda leer).
export async function registrarArchivo(
  rutaRecibida: unknown,
  tituloRecibido: unknown,
  autorRecibido: unknown,
): Promise<Resultado> {
  const usuario = await obtenerUsuario();
  if (!usuario) return { ok: false, error: "Tu sesión terminó. Vuelve a entrar." };

  const ruta = limpiar(rutaRecibida, 300);
  const titulo = limpiar(tituloRecibido, 300);
  const autor = limpiar(autorRecibido, 200);

  // La ruta debe ser <id del usuario>/<nombre>.pdf o .epub, nada más.
  const rutaValida = new RegExp(`^${usuario.id}/[\\w-]+\\.(pdf|epub)$`).test(ruta);
  if (!rutaValida) return { ok: false, error: "El archivo no es válido." };

  const supabase = await crearClienteServidor();
  if (!titulo) {
    await supabase.storage.from(ALMACEN).remove([ruta]);
    return { ok: false, error: "Escribe el título del libro." };
  }
  if (!limites.libros(await ipDelVisitante())) {
    // El archivo ya se había subido: se borra para no ocupar espacio.
    await supabase.storage.from(ALMACEN).remove([ruta]);
    return { ok: false, error: LIMITE_LIBROS };
  }

  const { data, error } = await supabase
    .from("libros_propios")
    .insert({ titulo, autor: autor || null, tipo: "archivo", ruta_archivo: ruta })
    .select("id")
    .single();
  if (error || !data) {
    await supabase.storage.from(ALMACEN).remove([ruta]);
    return { ok: false, error: "No se pudo guardar el libro." };
  }

  const problema = await comprobarLectura(data.id);
  if (problema) {
    await supabase.from("libros_propios").delete().eq("id", data.id);
    await supabase.storage.from(ALMACEN).remove([ruta]);
    return { ok: false, error: problema };
  }
  return { ok: true, id: data.id };
}

// Elimina un libro propio junto con su archivo, su avance y su favorito.
export async function eliminarLibroPropio(
  idRecibido: unknown,
): Promise<{ ok: boolean }> {
  const usuario = await obtenerUsuario();
  const id = limpiar(idRecibido, 60);
  if (!usuario || !id) return { ok: false };

  const supabase = await crearClienteServidor();
  // RLS garantiza que solo se encuentre si es del usuario.
  const { data } = await supabase
    .from("libros_propios")
    .select("id, ruta_archivo")
    .eq("id", id)
    .maybeSingle();
  if (!data) return { ok: false };

  if (data.ruta_archivo) {
    await supabase.storage.from(ALMACEN).remove([data.ruta_archivo]);
  }
  await supabase.from("progreso_lectura").delete().eq("fuente", "propio").eq("book_id", id);
  await supabase.from("libros_favoritos").delete().eq("fuente", "propio").eq("book_id", id);
  await supabase.from("subrayados").delete().eq("fuente", "propio").eq("book_id", id);
  const { error } = await supabase.from("libros_propios").delete().eq("id", id);

  olvidarLibro({ fuente: "propio", id });
  return { ok: !error };
}
