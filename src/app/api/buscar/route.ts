// RUTA DE API: GET /api/buscar?q=texto
// El navegador la llama para buscar libros. La búsqueda real se hace aquí,
// en el servidor, a través de la capa de fuentes.
// (El proxy ya exige sesión iniciada para llegar a esta ruta.)

import { NextResponse, type NextRequest } from "next/server";
import { buscarLibros } from "@/lib/fuentes";

export async function GET(request: NextRequest) {
  const consulta = request.nextUrl.searchParams.get("q")?.trim() ?? "";

  if (consulta.length < 2) return NextResponse.json({ libros: [] });
  if (consulta.length > 80) {
    return NextResponse.json({ error: "Búsqueda muy larga" }, { status: 400 });
  }

  try {
    const libros = await buscarLibros(consulta);
    return NextResponse.json({ libros: libros.slice(0, 30) });
  } catch {
    return NextResponse.json(
      { error: "No se pudo consultar el catálogo" },
      { status: 502 },
    );
  }
}
