// Funciones del servidor para saber quién está usando la página.
// "cache" hace que, aunque varias partes de la misma página pregunten,
// solo se consulte una vez por visita.

import { cache } from "react";
import { redirect } from "next/navigation";
import type { Luz } from "./luz";
import { crearClienteServidor } from "./supabase/servidor";

export type Perfil = {
  id: string;
  correo: string;
  nombre: string | null;
  luz_preferida: Luz;
  tamano_letra: number;
  gustos_completados: boolean;
  foto_version: number | null; // null = sin foto de perfil
  apodo: string | null; // nombre público (el nombre real nunca se muestra a otros)
  visibilidad: Visibilidad;
  mostrar_tiempo: boolean;
  mostrar_favoritos: boolean;
  mostrar_resenas: boolean;
  mostrar_gustos: boolean;
};

// Quién puede ver el perfil: cualquier lector, solo amigos o nadie.
export type Visibilidad = "publico" | "amigos" | "privado";

// Devuelve el usuario con sesión iniciada, o null si no hay.
export const obtenerUsuario = cache(async () => {
  const supabase = await crearClienteServidor();
  const { data } = await supabase.auth.getClaims();
  if (!data?.claims) return null;
  return {
    id: data.claims.sub,
    correo: typeof data.claims.email === "string" ? data.claims.email : "",
  };
});

// A dónde mandar a alguien que acaba de entrar: a "Tus gustos" si es una
// cuenta nueva que aún no pasa por esa pantalla, o a Inicio si ya pasó.
export async function rutaDeEntrada(): Promise<"/" | "/gustos"> {
  const supabase = await crearClienteServidor();
  const { data } = await supabase
    .from("profiles")
    .select("gustos_completados")
    .maybeSingle();
  return data && !data.gustos_completados ? "/gustos" : "/";
}

// Devuelve el perfil del usuario. Si no hay sesión, manda al login.
export const obtenerPerfil = cache(async (): Promise<Perfil> => {
  const usuario = await obtenerUsuario();
  if (!usuario) redirect("/login");

  const supabase = await crearClienteServidor();
  const { data } = await supabase
    .from("profiles")
    .select(
      "nombre, luz_preferida, tamano_letra, gustos_completados, foto_version, apodo, visibilidad, mostrar_tiempo, mostrar_favoritos, mostrar_resenas, mostrar_gustos",
    )
    .eq("id", usuario.id)
    .maybeSingle();

  return {
    id: usuario.id,
    correo: usuario.correo,
    nombre: data?.nombre ?? null,
    luz_preferida: data?.luz_preferida ?? "amarilla",
    tamano_letra: data?.tamano_letra ?? 19,
    gustos_completados: data?.gustos_completados ?? false,
    foto_version: data?.foto_version ?? null,
    apodo: data?.apodo ?? null,
    visibilidad: data?.visibilidad ?? "amigos",
    mostrar_tiempo: data?.mostrar_tiempo ?? true,
    mostrar_favoritos: data?.mostrar_favoritos ?? true,
    mostrar_resenas: data?.mostrar_resenas ?? true,
    mostrar_gustos: data?.mostrar_gustos ?? true,
  };
});
