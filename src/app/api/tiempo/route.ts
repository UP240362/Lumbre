// Recibe el tiempo de lectura que junta el lector (src/lib/tiempoLectura.ts)
// y lo suma en Supabase. Se usa una ruta y no una acción del servidor porque
// el navegador la puede mandar con "keepalive" al cerrar la página.

import { NextResponse, type NextRequest } from "next/server";
import { esFuente } from "@/lib/fuentes";
import { ipDelVisitante, limites } from "@/lib/limites";
import { obtenerUsuario } from "@/lib/sesion";
import { crearClienteServidor } from "@/lib/supabase/servidor";

const ES_DIA = /^\d{4}-\d{2}-\d{2}$/;
const DIA_MS = 86_400_000;

// La fecha llega del navegador (es la fecha local de quien lee). Se acepta
// de hasta 14 días atrás (tiempo leído sin internet) y hasta mañana (zonas
// horarias adelantadas).
function diaValido(dia: unknown): dia is string {
  if (typeof dia !== "string" || !ES_DIA.test(dia)) return false;
  const fecha = Date.parse(`${dia}T12:00:00Z`);
  if (Number.isNaN(fecha)) return false;
  const ahora = Date.now();
  return fecha >= ahora - 15 * DIA_MS && fecha <= ahora + 2 * DIA_MS;
}

export async function POST(request: NextRequest) {
  const usuario = await obtenerUsuario();
  if (!usuario) return NextResponse.json({ ok: false }, { status: 401 });
  if (!limites.tiempo(await ipDelVisitante())) {
    return NextResponse.json({ ok: false }, { status: 429 });
  }

  const cuerpo = await request.json().catch(() => null);
  const entradas: unknown[] = Array.isArray(cuerpo?.entradas) ? cuerpo.entradas.slice(0, 50) : [];

  const supabase = await crearClienteServidor();
  let guardadas = 0;
  for (const e of entradas) {
    if (!e || typeof e !== "object") continue;
    const { dueno, dia, fuente, id, segundos } = e as Record<string, unknown>;
    // El tiempo de otra cuenta (mismo teléfono, otra sesión) se descarta.
    if (dueno !== usuario.id) continue;
    if (!diaValido(dia) || !esFuente(fuente)) continue;
    if (typeof id !== "string" || !id || id.length > 200) continue;
    if (typeof segundos !== "number" || !Number.isFinite(segundos)) continue;
    const enteros = Math.min(14_400, Math.max(0, Math.round(segundos)));
    if (enteros === 0) continue;

    const { error } = await supabase.rpc("sumar_tiempo_lectura", {
      p_dia: dia,
      p_fuente: fuente,
      p_book_id: id,
      p_segundos: enteros,
    });
    if (!error) guardadas++;
  }

  return NextResponse.json({ ok: true, guardadas });
}
