// TIEMPO DE LECTURA (lado del servidor): totales de la semana y del mes,
// para la sección de "Mi perfil". La semana empieza en lunes. Las fechas se
// calculan con la hora de la Ciudad de México.

import { connection } from "next/server";
import { claveLibro } from "./favoritos";
import { crearClienteServidor } from "./supabase/servidor";

const ZONA = "America/Mexico_City";
const DIA_MS = 86_400_000;

export type DiaSemana = { dia: string; nombre: string; segundos: number; esHoy: boolean };
export type LibroLeido = { titulo: string; segundos: number };

export type Estadisticas = {
  semana: number; // segundos
  semanaPasada: number;
  mes: number;
  mesPasado: number;
  nombreMes: string; // "noviembre"
  dias: DiaSemana[]; // lunes a domingo de esta semana
  masLeidos: LibroLeido[]; // de este mes, hasta 3
};

// "2026-11-12" ↔ fecha (a mediodía UTC, para que no se mueva de día).
const aFecha = (dia: string) => new Date(`${dia}T12:00:00Z`);
const aDia = (fecha: Date) => fecha.toISOString().slice(0, 10);

const NOMBRES = ["Lun", "Mar", "Mié", "Jue", "Vie", "Sáb", "Dom"];

export async function estadisticasDeLectura(usuarioId: string): Promise<Estadisticas> {
  await connection(); // usa la fecha de hoy: se calcula en cada visita

  const hoy = new Intl.DateTimeFormat("en-CA", { timeZone: ZONA }).format(new Date());
  const fechaHoy = aFecha(hoy);
  const desdeLunes = (fechaHoy.getUTCDay() + 6) % 7; // lunes = 0
  const lunes = aDia(new Date(fechaHoy.getTime() - desdeLunes * DIA_MS));
  const lunesPasado = aDia(new Date(aFecha(lunes).getTime() - 7 * DIA_MS));
  const inicioMes = `${hoy.slice(0, 7)}-01`;
  const mesAnterior = new Date(Date.UTC(fechaHoy.getUTCFullYear(), fechaHoy.getUTCMonth() - 1, 1, 12));
  const inicioMesPasado = aDia(mesAnterior);
  const desde = lunesPasado < inicioMesPasado ? lunesPasado : inicioMesPasado;

  const supabase = await crearClienteServidor();
  const { data } = await supabase
    .from("tiempo_lectura")
    .select("dia, fuente, book_id, segundos")
    .eq("user_id", usuarioId)
    .gte("dia", desde)
    .lte("dia", hoy);
  const filas = (data ?? []) as { dia: string; fuente: string; book_id: string; segundos: number }[];

  const sumaEntre = (inicio: string, fin: string) =>
    filas.filter((f) => f.dia >= inicio && f.dia < fin).reduce((s, f) => s + f.segundos, 0);
  const manana = aDia(new Date(fechaHoy.getTime() + DIA_MS));

  const dias: DiaSemana[] = NOMBRES.map((nombre, i) => {
    const dia = aDia(new Date(aFecha(lunes).getTime() + i * DIA_MS));
    return {
      dia,
      nombre,
      esHoy: dia === hoy,
      segundos: filas.filter((f) => f.dia === dia).reduce((s, f) => s + f.segundos, 0),
    };
  });

  // Los libros más leídos del mes, con su título (del avance de lectura).
  const porLibro = new Map<string, { fuente: string; id: string; segundos: number }>();
  for (const f of filas.filter((f) => f.dia >= inicioMes)) {
    const clave = claveLibro({ fuente: f.fuente, id: f.book_id });
    const previo = porLibro.get(clave) ?? { fuente: f.fuente, id: f.book_id, segundos: 0 };
    previo.segundos += f.segundos;
    porLibro.set(clave, previo);
  }
  const top = [...porLibro.values()].sort((a, b) => b.segundos - a.segundos).slice(0, 3);
  const titulos = new Map<string, string>();
  if (top.length > 0) {
    const { data: progreso } = await supabase
      .from("progreso_lectura")
      .select("fuente, book_id, titulo")
      .eq("user_id", usuarioId)
      .in("book_id", top.map((l) => l.id));
    for (const p of progreso ?? []) titulos.set(claveLibro({ fuente: p.fuente, id: p.book_id }), p.titulo);
  }

  return {
    semana: sumaEntre(lunes, manana),
    semanaPasada: sumaEntre(lunesPasado, lunes),
    mes: sumaEntre(inicioMes, manana),
    mesPasado: sumaEntre(inicioMesPasado, inicioMes),
    nombreMes: new Intl.DateTimeFormat("es-MX", { month: "long", timeZone: "UTC" }).format(fechaHoy),
    dias,
    masLeidos: top.map((l) => ({
      titulo: titulos.get(claveLibro(l)) ?? "Libro sin título",
      segundos: l.segundos,
    })),
  };
}

// 0 → "0 min", 2700 → "45 min", 8100 → "2 h 15 min".
export function formatoDuracion(segundos: number): string {
  const minutos = Math.floor(segundos / 60);
  if (segundos > 0 && minutos === 0) return "menos de 1 min";
  const horas = Math.floor(minutos / 60);
  const resto = minutos % 60;
  if (horas === 0) return `${minutos} min`;
  return resto === 0 ? `${horas} h` : `${horas} h ${resto} min`;
}
