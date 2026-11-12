// Foto de perfil de OTRO lector. La base de datos decide si quien pregunta
// la puede ver (según la privacidad de ese lector); si no, responde 404.

import { NextResponse } from "next/server";
import { obtenerUsuario } from "@/lib/sesion";
import { crearClienteServidor } from "@/lib/supabase/servidor";

export async function GET(_request: Request, ctx: RouteContext<"/api/foto/[apodo]">) {
  const usuario = await obtenerUsuario();
  if (!usuario) return new NextResponse(null, { status: 401 });

  const { apodo } = await ctx.params;
  if (!/^[a-z0-9_.]{3,20}$/.test(apodo)) return new NextResponse(null, { status: 404 });

  const supabase = await crearClienteServidor();
  const { data: archivo } = await supabase.rpc("foto_de_lector", { p_apodo: apodo });
  if (typeof archivo !== "string") return new NextResponse(null, { status: 404 });

  const { data, error } = await supabase.storage.from("fotos").download(archivo);
  if (error || !data) return new NextResponse(null, { status: 404 });

  return new NextResponse(data, {
    headers: {
      "Content-Type": data.type || "image/jpeg",
      // Corto y privado: si la persona cambia su privacidad, deja de verse pronto.
      "Cache-Control": "private, max-age=300",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
