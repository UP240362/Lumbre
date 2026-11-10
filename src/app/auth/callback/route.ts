// A esta ruta llegan los enlaces de los correos de Supabase
// (confirmar cuenta y recuperar contraseña). Traen un ?code=... de un solo
// uso, que aquí se cambia por una sesión iniciada.

import { NextResponse, type NextRequest } from "next/server";
import { rutaDeEntrada } from "@/lib/sesion";
import { crearClienteServidor } from "@/lib/supabase/servidor";

export async function GET(request: NextRequest) {
  const { searchParams, origin } = request.nextUrl;
  const codigo = searchParams.get("code");

  // "next" dice a dónde ir después. Solo aceptamos rutas internas ("/algo"),
  // para que nadie pueda usar este enlace para mandar a otro sitio.
  const siguiente = searchParams.get("next");
  const esInterna =
    siguiente !== null &&
    siguiente.startsWith("/") &&
    !siguiente.startsWith("//");

  if (codigo) {
    const supabase = await crearClienteServidor();
    const { error } = await supabase.auth.exchangeCodeForSession(codigo);
    if (!error) {
      // Sin "next": cuenta recién confirmada → "Tus gustos" (o Inicio).
      const destino = esInterna ? siguiente : await rutaDeEntrada();
      return NextResponse.redirect(`${origin}${destino}`);
    }
  }

  return NextResponse.redirect(`${origin}/login?aviso=enlace`);
}
