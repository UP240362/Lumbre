// RUTA DE API: GET /api/imagen/<fuente>/<id>?r=<ruta>
// Entrega una ilustración de un libro. "ruta" es la que anotó el lector al
// preparar el libro (Capitulo.imagenes). Lumbre la pide a la fuente (o la
// saca del ePub) y la reenvía: así el navegador nunca habla con otros
// sitios y la imagen se puede guardar para leer sin internet.

import { NextResponse, type NextRequest } from "next/server";
import { esFuente, imagenDeLibro, obtenerLibro } from "@/lib/fuentes";
import { limites } from "@/lib/limites";
import { ipDesdeEncabezados } from "@/lib/limites/limitador";
import { obtenerUsuario } from "@/lib/sesion";

export async function GET(
  request: NextRequest,
  ctx: RouteContext<"/api/imagen/[fuente]/[id]">,
) {
  if (!(await obtenerUsuario())) {
    return NextResponse.json({ error: "Inicia sesión" }, { status: 401 });
  }
  if (!limites.imagenes(ipDesdeEncabezados(request.headers))) {
    return NextResponse.json(
      { error: "Demasiadas imágenes. Espera un momento." },
      { status: 429, headers: { "Retry-After": "120" } },
    );
  }

  const { fuente, id: idCrudo } = await ctx.params;
  const ruta = request.nextUrl.searchParams.get("r");
  if (!esFuente(fuente) || !ruta || ruta.length > 500) {
    return NextResponse.json({ error: "No encontrada" }, { status: 404 });
  }

  try {
    // En "propio", obtenerLibro solo encuentra libros de este usuario.
    const libro = await obtenerLibro(fuente, decodeURIComponent(idCrudo));
    const imagen = libro ? await imagenDeLibro(libro, ruta) : null;
    if (!imagen) {
      return NextResponse.json({ error: "No encontrada" }, { status: 404 });
    }
    return new NextResponse(new Uint8Array(imagen.datos), {
      headers: {
        "Content-Type": imagen.tipo,
        // La ilustración de un libro no cambia: el navegador la guarda un
        // año. "private": es contenido de una cuenta, no para intermediarios.
        "Cache-Control": "private, max-age=31536000, immutable",
        "X-Content-Type-Options": "nosniff",
        "Content-Security-Policy": "default-src 'none'; sandbox",
      },
    });
  } catch {
    return NextResponse.json({ error: "No se pudo traer la imagen" }, { status: 502 });
  }
}
