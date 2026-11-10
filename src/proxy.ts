// PROXY: código que corre antes de cada página (antes se llamaba "middleware").
// Hace dos cosas:
//   1. Renueva la sesión de Supabase si está por vencer.
//   2. Manda al login a quien no ha iniciado sesión, y saca del login
//      a quien ya la inició.

import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { SUPABASE_CLAVE, SUPABASE_URL } from "@/lib/supabase/config";

// Páginas que se pueden ver sin iniciar sesión.
const RUTAS_PUBLICAS = ["/login", "/crear-cuenta", "/recuperar"];

export async function proxy(request: NextRequest) {
  let respuesta = NextResponse.next({ request });

  const supabase = createServerClient(SUPABASE_URL, SUPABASE_CLAVE, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(lista, encabezados) {
        for (const { name, value } of lista) {
          request.cookies.set(name, value);
        }
        respuesta = NextResponse.next({ request });
        for (const { name, value, options } of lista) {
          respuesta.cookies.set(name, value, options);
        }
        for (const [nombre, valor] of Object.entries(encabezados ?? {})) {
          respuesta.headers.set(nombre, valor);
        }
      },
    },
  });

  // getClaims revisa que la sesión sea auténtica (y la renueva si hace falta).
  const { data } = await supabase.auth.getClaims();
  const hayUsuario = Boolean(data?.claims);

  const ruta = request.nextUrl.pathname;
  const esPublica = RUTAS_PUBLICAS.includes(ruta);
  const esDeAuth = ruta.startsWith("/auth/");

  // Si un enlace de correo cayó en la portada con ?code=..., lo pasamos
  // a la ruta que sabe convertir ese código en sesión.
  if (ruta === "/" && request.nextUrl.searchParams.has("code")) {
    const destino = request.nextUrl.clone();
    destino.pathname = "/auth/callback";
    return redirigir(destino, respuesta);
  }

  if (!hayUsuario && !esPublica && !esDeAuth) {
    const destino = request.nextUrl.clone();
    destino.pathname = "/login";
    destino.search = "";
    return redirigir(destino, respuesta);
  }

  if (hayUsuario && esPublica) {
    const destino = request.nextUrl.clone();
    destino.pathname = "/";
    destino.search = "";
    return redirigir(destino, respuesta);
  }

  return respuesta;
}

// Redirige conservando las cookies de sesión que Supabase haya renovado.
function redirigir(destino: URL, respuesta: NextResponse) {
  const redireccion = NextResponse.redirect(destino);
  for (const cookie of respuesta.cookies.getAll()) {
    redireccion.cookies.set(cookie);
  }
  return redireccion;
}

export const config = {
  // Corre en todas las rutas, menos archivos estáticos e imágenes.
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)",
  ],
};
