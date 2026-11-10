// PROXY: código que corre antes de cada página (antes se llamaba "middleware").
// Hace tres cosas:
//   1. Frena a quien manda demasiadas peticiones (para que no tumben el sitio).
//   2. Renueva la sesión de Supabase si está por vencer.
//   3. Manda al login a quien no ha iniciado sesión, y saca del login
//      a quien ya la inició.

import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { crearLimitador, ipDesdeEncabezados } from "@/lib/limites/limitador";
import { SUPABASE_CLAVE, SUPABASE_URL } from "@/lib/supabase/config";

// Páginas que se pueden ver sin iniciar sesión.
const RUTAS_PUBLICAS = ["/login", "/crear-cuenta", "/recuperar"];

// Freno general: peticiones por minuto desde una misma IP. Es alto a
// propósito, porque navegar normal ya hace varias (Next.js precarga las
// páginas de los enlaces que ves); solo frena a quien inunda el sitio.
const limiteGeneral = crearLimitador({ maximo: 600, ventanaMs: 60_000 });

export async function proxy(request: NextRequest) {
  if (!limiteGeneral(ipDesdeEncabezados(request.headers))) {
    return new NextResponse(
      "Demasiadas solicitudes desde tu conexión. Espera un minuto y vuelve a intentar.",
      {
        status: 429,
        headers: { "Retry-After": "60", "Content-Type": "text/plain; charset=utf-8" },
      },
    );
  }

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
  // La página sin conexión no tiene datos de nadie y el service worker la
  // guarda; se deja pasar siempre, con o sin sesión.
  if (ruta === "/sin-conexion") return respuesta;
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
  // Corre en todas las rutas, menos archivos estáticos, imágenes y el
  // manifiesto y el service worker de la app (el teléfono los lee aunque no
  // hayas iniciado sesión).
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|manifest.webmanifest|sw.js|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)",
  ],
};
