// RUTA DE API: GET /api/archivo/<fuente>/<id>
// Entrega el PDF de un cómic propio tal cual, para que el visor de cómics
// dibuje sus páginas en el navegador. Solo libros propios que se leen por
// páginas y solo para su dueño (obtenerLibro lo revisa con RLS).

import { NextResponse, type NextRequest } from "next/server";
import { obtenerLibro } from "@/lib/fuentes";
import { archivoPropio } from "@/lib/fuentes/propio";
import { limites } from "@/lib/limites";
import { ipDesdeEncabezados } from "@/lib/limites/limitador";
import { obtenerUsuario } from "@/lib/sesion";

export async function GET(
  request: NextRequest,
  ctx: RouteContext<"/api/archivo/[fuente]/[id]">,
) {
  if (!(await obtenerUsuario())) {
    return NextResponse.json({ error: "Inicia sesión" }, { status: 401 });
  }
  if (!limites.descargas(ipDesdeEncabezados(request.headers))) {
    return NextResponse.json(
      { error: "Demasiadas descargas. Espera un momento." },
      { status: 429, headers: { "Retry-After": "300" } },
    );
  }

  const { fuente, id } = await ctx.params;
  if (fuente !== "propio") {
    return NextResponse.json({ error: "No encontrado" }, { status: 404 });
  }

  try {
    const libro = await obtenerLibro("propio", decodeURIComponent(id));
    if (!libro || libro.formato !== "comic") {
      return NextResponse.json({ error: "No encontrado" }, { status: 404 });
    }
    const datos = await archivoPropio(libro);
    if (!(datos[0] === 0x25 && datos[1] === 0x50 && datos[2] === 0x44 && datos[3] === 0x46)) {
      return NextResponse.json({ error: "No es un PDF" }, { status: 404 });
    }
    return new NextResponse(new Uint8Array(datos), {
      headers: {
        "Content-Type": "application/pdf",
        "Cache-Control": "private, max-age=31536000, immutable",
        "X-Content-Type-Options": "nosniff",
        "Content-Security-Policy": "default-src 'none'; sandbox",
      },
    });
  } catch {
    return NextResponse.json({ error: "No se pudo abrir el archivo" }, { status: 502 });
  }
}
