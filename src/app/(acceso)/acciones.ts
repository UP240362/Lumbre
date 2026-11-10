"use server";

// ACCIONES DEL SERVIDOR para entrar, crear cuenta y recuperar contraseña.
// "use server" significa que estas funciones corren en el servidor: el
// formulario las llama, pero su código nunca llega al navegador.

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { rutaDeEntrada } from "@/lib/sesion";
import { crearClienteServidor } from "@/lib/supabase/servidor";
import type { EstadoFormulario } from "./tipos";

const MIN_CONTRASENA = 8;

// Convierte los errores de Supabase (en inglés) a mensajes en español.
function traducirError(error: { code?: string }): string {
  switch (error.code) {
    case "invalid_credentials":
      return "Correo o contraseña incorrectos.";
    case "email_not_confirmed":
      return "Aún no confirmas tu correo. Abre el enlace que te enviamos.";
    case "user_already_exists":
    case "email_exists":
      return "Ya existe una cuenta con ese correo.";
    case "weak_password":
      return `La contraseña es muy débil. Usa al menos ${MIN_CONTRASENA} caracteres.`;
    case "same_password":
      return "La nueva contraseña debe ser distinta a la anterior.";
    case "email_address_invalid":
    case "validation_failed":
      return "Ese correo no parece válido.";
    case "over_email_send_rate_limit":
    case "over_request_rate_limit":
      return "Demasiados intentos. Espera unos minutos y vuelve a probar.";
    default:
      return "Algo salió mal. Intenta de nuevo.";
  }
}

// Dirección del sitio (por ejemplo http://localhost:3000), para armar
// los enlaces que van en los correos.
async function origenDelSitio(): Promise<string> {
  const encabezados = await headers();
  const origen = encabezados.get("origin");
  if (origen) return origen;
  const host = encabezados.get("host") ?? "localhost:3000";
  return `http://${host}`;
}

function texto(datos: FormData, campo: string): string {
  const valor = datos.get(campo);
  return typeof valor === "string" ? valor : "";
}

export async function iniciarSesion(
  _anterior: EstadoFormulario,
  datos: FormData,
): Promise<EstadoFormulario> {
  const correo = texto(datos, "correo").trim();
  const contrasena = texto(datos, "contrasena");

  if (!correo || !contrasena) {
    return { error: "Escribe tu correo y tu contraseña.", correo };
  }

  const supabase = await crearClienteServidor();
  const { error } = await supabase.auth.signInWithPassword({
    email: correo,
    password: contrasena,
  });

  if (error) return { error: traducirError(error), correo };

  redirect(await rutaDeEntrada());
}

export async function crearCuenta(
  _anterior: EstadoFormulario,
  datos: FormData,
): Promise<EstadoFormulario> {
  const nombre = texto(datos, "nombre").trim();
  const correo = texto(datos, "correo").trim();
  const contrasena = texto(datos, "contrasena");

  if (!nombre || !correo) {
    return { error: "Escribe tu nombre y tu correo.", correo, nombre };
  }
  if (contrasena.length < MIN_CONTRASENA) {
    return {
      error: `La contraseña debe tener al menos ${MIN_CONTRASENA} caracteres.`,
      correo,
      nombre,
    };
  }

  const supabase = await crearClienteServidor();
  const { data, error } = await supabase.auth.signUp({
    email: correo,
    password: contrasena,
    options: {
      // El nombre se guarda con el usuario; la base de datos lo copia al perfil.
      data: { nombre },
      emailRedirectTo: `${await origenDelSitio()}/auth/callback`,
    },
  });

  if (error) return { error: traducirError(error), correo, nombre };

  // Si Supabase no pide confirmar el correo, ya hay sesión: entramos directo.
  if (data.session) redirect(await rutaDeEntrada());

  return {
    mensaje:
      "Te enviamos un correo para confirmar tu cuenta. Abre el enlace en este mismo navegador para entrar.",
  };
}

export async function pedirRecuperacion(
  _anterior: EstadoFormulario,
  datos: FormData,
): Promise<EstadoFormulario> {
  const correo = texto(datos, "correo").trim();
  if (!correo) return { error: "Escribe tu correo." };

  const supabase = await crearClienteServidor();
  const { error } = await supabase.auth.resetPasswordForEmail(correo, {
    redirectTo: `${await origenDelSitio()}/auth/callback?next=/nueva-contrasena`,
  });

  if (error) return { error: traducirError(error), correo };

  // El mismo mensaje exista o no la cuenta, para no revelar quién está registrado.
  return {
    mensaje:
      "Si hay una cuenta con ese correo, te llegará un enlace para cambiar tu contraseña.",
  };
}

export async function cambiarContrasena(
  _anterior: EstadoFormulario,
  datos: FormData,
): Promise<EstadoFormulario> {
  const contrasena = texto(datos, "contrasena");
  if (contrasena.length < MIN_CONTRASENA) {
    return {
      error: `La contraseña debe tener al menos ${MIN_CONTRASENA} caracteres.`,
    };
  }

  const supabase = await crearClienteServidor();
  const { error } = await supabase.auth.updateUser({ password: contrasena });

  if (error) return { error: traducirError(error) };

  redirect("/");
}

export async function cerrarSesion() {
  const supabase = await crearClienteServidor();
  await supabase.auth.signOut();
  redirect("/login");
}
