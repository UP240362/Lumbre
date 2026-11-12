// LIBRO DEL DÍA (tarjeta de arriba en Explorar). Es el mismo para todos y
// cambia a medianoche, hora del centro de México. Se elige así:
//   1. Si hoy es una fecha especial del calendario hecho a mano
//      (src/data/fechasEspeciales.ts), ese libro.
//   2. Si no, un escritor que nació o murió un día como hoy
//      (src/data/autores.json, armado desde Wikidata con
//      scripts/actualizar-autores.mjs) y uno de sus libros.
//   3. Si nada de eso funciona, un clásico de una lista fija.

import { cacheLife } from "next/cache";
import type { DatosTarjeta } from "@/components/TarjetaLibro";
import autores from "@/data/autores.json";
import { CLASICOS, FECHAS_ESPECIALES } from "@/data/fechasEspeciales";
import { obtenerLibro } from "./fuentes";
import { librosDeAutor as deElejandria } from "./fuentes/elejandria";
import { librosDeAutor as deGutenberg } from "./fuentes/gutenberg";
import type { Libro } from "./fuentes/tipos";
import { simplificar } from "./texto";

export type LibroDelDia = {
  titulo: string; // "Día Internacional del Libro", "Un día como hoy, en 1648"
  motivo: string;
  libro: DatosTarjeta;
};

type Autor = (typeof autores)[number];

const ZONA = "America/Mexico_City";

// "2026-11-12", la fecha de hoy en México.
export function hoyEnMexico(): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: ZONA }).format(new Date());
}

const aTarjeta = (libro: Libro): DatosTarjeta => ({
  id: libro.id,
  fuente: libro.fuente,
  titulo: libro.titulo,
  autor: libro.autores.join(", "),
  idioma: libro.idiomas[0],
});

// "Primero sueño" ≈ "primero-sueno": sin acentos, signos ni mayúsculas.
const comparable = (texto: string) =>
  simplificar(texto).replace(/[^a-z0-9]+/g, " ").trim();

// Elige un libro del autor: primero una de sus obras famosas en español
// (Elejandría), después su libro en español más leído en Gutenberg, después
// cualquiera suyo en Elejandría y por último su libro más leído en Gutenberg.
async function libroDelAutor(autor: Autor): Promise<DatosTarjeta | null> {
  const [enElejandria, enGutenberg] = await Promise.all([
    deElejandria(autor.nombre).catch(() => []),
    deGutenberg(autor.gutenberg).catch(() => []),
  ]);

  const obras = autor.obras.map(comparable).filter((o) => o.length >= 4);
  // Primero un título que contenga la obra completa; si no, uno que sea
  // parte de ella ("Rimas" cuenta para "Rimas y leyendas").
  const titulos = enElejandria.map((libro) => ({ libro, titulo: comparable(libro.titulo) }));
  const famosa = (
    titulos.find(({ titulo }) => obras.some((obra) => titulo.includes(obra))) ??
    titulos.find(({ titulo }) => titulo.length >= 5 && obras.some((obra) => obra.includes(titulo)))
  )?.libro;
  const elegidoEle = famosa ?? (enGutenberg.some((l) => l.idiomas.includes("es")) ? null : enElejandria[0]);
  if (elegidoEle) {
    const libro = await obtenerLibro("elejandria", elegidoEle.id).catch(() => null);
    // Sin enlace al ePub no se podría leer: se busca en Gutenberg.
    if (libro?.urlTexto) return aTarjeta(libro);
  }

  const libro = enGutenberg.find((l) => l.idiomas.includes("es")) ?? enGutenberg[0];
  return libro ? aTarjeta(libro) : null;
}

// Escritores que nacieron o murieron este día y murieron hace más de 100
// años (dominio público en México). Primero los más conocidos; los que
// escribieron en español cuentan el triple.
function autoresDelDia(fecha: string): { autor: Autor; nacio: boolean }[] {
  const dia = fecha.slice(5);
  const limite = Number(fecha.slice(0, 4)) - 101;
  return autores
    .filter((a) => a.muere === null || Number(a.muere.slice(0, 4)) <= limite)
    .flatMap((autor) =>
      autor.nace?.slice(5) === dia
        ? [{ autor, nacio: true }]
        : autor.muere?.slice(5) === dia
          ? [{ autor, nacio: false }]
          : [],
    )
    .sort(
      (x, y) =>
        y.autor.fama * (y.autor.espanol ? 3 : 1) - x.autor.fama * (x.autor.espanol ? 3 : 1),
    );
}

// Puntos para elegir entre los autores del día: el orden de arriba, y el
// doble si el libro elegido está en español (así Darwin, con su libro
// traducido, gana a Lincoln, que solo está en inglés).
const puntos = (autor: Autor, libro: DatosTarjeta) =>
  autor.fama * (autor.espanol ? 3 : 1) * (libro.idioma === "es" ? 2 : 1);

// "fecha" es "AAAA-MM-DD". Se guarda un día: todos ven el mismo libro y las
// fuentes solo se consultan una vez.
export async function libroDelDia(fecha: string): Promise<LibroDelDia> {
  "use cache";
  cacheLife("days");

  const dia = fecha.slice(5);
  const especial = FECHAS_ESPECIALES.find((f) => f.dia === dia);
  if (especial) {
    return { titulo: especial.titulo, motivo: especial.motivo, libro: especial.libro };
  }

  const anio = Number(fecha.slice(0, 4));
  // Se revisan los cuatro primeros y gana el de más puntos.
  const candidatos = autoresDelDia(fecha).slice(0, 4);
  const conLibro = await Promise.all(
    candidatos.map(async (c) => ({ ...c, libro: await libroDelAutor(c.autor).catch(() => null) })),
  );
  const elegido = conLibro
    .filter((c): c is typeof c & { libro: DatosTarjeta } => c.libro !== null)
    .sort((x, y) => puntos(y.autor, y.libro) - puntos(x.autor, x.libro))[0];
  if (elegido) {
    const { autor, nacio, libro } = elegido;
    const cuando = (nacio ? autor.nace : autor.muere)!;
    const hace = anio - Number(cuando.slice(0, 4));
    return {
      titulo: `Un día como hoy, en ${Number(cuando.slice(0, 4))}`,
      motivo: `${nacio ? "Nació" : "Murió"} ${autor.nombre}, hace ${hace} años. Te dejamos uno de sus libros.`,
      libro,
    };
  }

  // Un clásico distinto según el día del año.
  const numeroDeDia = Math.floor(Date.UTC(anio, Number(dia.slice(0, 2)) - 1, Number(dia.slice(3))) / 86_400_000);
  return {
    titulo: "Un clásico para hoy",
    motivo: "Un libro que vale la pena leer al menos una vez en la vida.",
    libro: CLASICOS[numeroDeDia % CLASICOS.length],
  };
}
