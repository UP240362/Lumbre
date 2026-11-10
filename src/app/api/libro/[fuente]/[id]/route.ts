// RUTA DE API: GET /api/libro/<fuente>/<id>
// Entrega el libro completo (todos sus capítulos) para que el teléfono lo
// guarde y se pueda leer sin internet. La llama el lector al abrir un libro.

import { NextResponse, type NextRequest } from "next/server";
import { esFuente, leerLibro, obtenerLibro } from "@/lib/fuentes";
import { limites } from "@/lib/limites";
import { ipDesdeEncabezados } from "@/lib/limites/limitador";
import { obtenerUsuario } from "@/lib/sesion";

export async function GET(
  request: NextRequest,
  ctx: RouteContext<"/api/libro/[fuente]/[id]">,
) {
  const usuario = await obtenerUsuario();
  if (!usuario) {
    return NextResponse.json({ error: "Inicia sesión" }, { status: 401 });
  }
  if (!limites.descargas(ipDesdeEncabezados(request.headers))) {
    return NextResponse.json(
      { error: "Demasiadas descargas. Espera un momento." },
      { status: 429, headers: { "Retry-After": "300" } },
    );
  }

  const { fuente, id: idCrudo } = await ctx.params;
  if (!esFuente(fuente)) {
    return NextResponse.json({ error: "Fuente desconocida" }, { status: 404 });
  }
  const id = decodeURIComponent(idCrudo);

  try {
    // En "propio", obtenerLibro solo encuentra libros de este usuario.
    const libro = await obtenerLibro(fuente, id);
    if (!libro) {
      return NextResponse.json({ error: "No encontrado" }, { status: 404 });
    }
    const capitulos = await leerLibro(libro);
    return NextResponse.json(
      {
        titulo: libro.titulo,
        autor: libro.autores.join(", "),
        titulos: capitulos.map((c) => c.titulo),
        capitulos: capitulos.map((c) => c.parrafos),
      },
      // Es contenido de una cuenta: que ningún intermediario lo guarde.
      { headers: { "Cache-Control": "private, no-store" } },
    );
  } catch {
    return NextResponse.json(
      { error: "No se pudo abrir el libro" },
      { status: 502 },
    );
  }
}
