// Entrega la foto de perfil de quien inició sesión. El bucket es privado,
// así que la foto no tiene una dirección pública: solo se ve con sesión.
// La dirección lleva ?v=<versión>; al cambiar la foto cambia la versión,
// por eso el navegador la puede guardar en caché mucho tiempo.

import { NextResponse } from "next/server";
import { obtenerUsuario } from "@/lib/sesion";
import { crearClienteServidor } from "@/lib/supabase/servidor";

export async function GET() {
  const usuario = await obtenerUsuario();
  if (!usuario) return new NextResponse(null, { status: 401 });

  const supabase = await crearClienteServidor();
  const { data, error } = await supabase.storage.from("fotos").download(usuario.id);
  if (error || !data) return new NextResponse(null, { status: 404 });

  return new NextResponse(data, {
    headers: {
      "Content-Type": data.type || "image/jpeg",
      // "private": solo el navegador de esta persona la guarda, nunca un
      // servidor intermedio (Cloudflare).
      "Cache-Control": "private, max-age=31536000, immutable",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
