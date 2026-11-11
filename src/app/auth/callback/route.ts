// A esta ruta llegan los enlaces de los correos de Supabase
// (confirmar cuenta y recuperar contraseña). Traen un ?code=... de un solo
// uso, que aquí se cambia por una sesión iniciada.

import { NextResponse, type NextRequest } from "next/server";
import { rutaDeEntrada } from "@/lib/sesion";
import { crearClienteServidor } from "@/lib/supabase/servidor";

export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const codigo = searchParams.get("code");

  // "next" dice a dónde ir después. Solo aceptamos rutas internas ("/algo"),
  // para que nadie pueda usar este enlace para mandar a otro sitio.
  const siguiente = searchParams.get("next");
  const esInterna =
    siguiente !== null &&
    siguiente.startsWith("/") &&
    !siguiente.startsWith("//") &&
    !siguiente.includes("\\");

  if (codigo) {
    const supabase = await crearClienteServidor();
    const { error } = await supabase.auth.exchangeCodeForSession(codigo);
    if (!error) {
      // Sin "next": cuenta recién confirmada → "Tus gustos" (o Inicio).
      const destino = esInterna ? siguiente : await rutaDeEntrada();
      return irA(destino);
    }
  }

  return irA("/login?aviso=enlace");
}

// Redirige con una ruta relativa ("/gustos"), y el navegador la completa con
// el sitio donde está (https://lumbre.uk). No se usa request.nextUrl.origin
// porque dentro de Docker vale "0.0.0.0:3000", que no abre en el navegador.
function irA(ruta: string) {
  return new NextResponse(null, { status: 307, headers: { Location: ruta } });
}
