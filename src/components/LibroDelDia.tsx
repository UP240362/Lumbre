// Tarjeta "Libro del día" de Explorar. La elección está en src/lib/libroDelDia.ts.

import Link from "next/link";
import { connection } from "next/server";
import { obtenerClavesFavoritas } from "@/lib/favoritos";
import { NOMBRES_FUENTE } from "@/lib/fuentes/tipos";
import { hoyEnMexico, libroDelDia } from "@/lib/libroDelDia";
import { BotonFavorito } from "./BotonFavorito";
import { PortadaLibro } from "./PortadaLibro";
import { rutaLibro } from "./TarjetaLibro";

export async function LibroDelDia() {
  await connection(); // la fecha de hoy se calcula al pedir la página
  const hoy = hoyEnMexico();
  const [dato, favoritos] = await Promise.all([
    libroDelDia(hoy).catch(() => null),
    obtenerClavesFavoritas(),
  ]);
  if (!dato) return null;

  const { libro } = dato;
  const ruta = rutaLibro(libro);
  const fecha = new Date(`${hoy}T12:00:00Z`).toLocaleDateString("es-MX", {
    day: "numeric",
    month: "long",
    timeZone: "UTC",
  });

  return (
    <section
      aria-labelledby="libro-del-dia"
      className="flex gap-4 rounded-2xl border border-borde bg-superficie p-4 sm:gap-6 sm:p-6"
    >
      {/* La portada repite el enlace de "Leer ahora": se oculta a lectores de pantalla. */}
      <Link
        href={ruta}
        tabIndex={-1}
        aria-hidden="true"
        className="w-28 shrink-0 self-start transition-transform hover:-translate-y-1 sm:w-36"
      >
        {/* En celular la portada es angosta: se usa la versión chica. */}
        <div className="sm:hidden">
          <PortadaLibro titulo={libro.titulo} autor={libro.autor} talla="chica" />
        </div>
        <div className="hidden sm:block">
          <PortadaLibro titulo={libro.titulo} autor={libro.autor} />
        </div>
      </Link>

      <div className="flex min-w-0 flex-1 flex-col">
        <p className="text-xs font-semibold uppercase tracking-widest text-acento">
          Libro del día · {fecha}
        </p>
        <h2 id="libro-del-dia" className="mt-1 font-serif text-xl font-semibold sm:text-2xl">
          {dato.titulo}
        </h2>
        <p className="mt-2 text-tenue">{dato.motivo}</p>

        <p className="mt-3 font-semibold leading-snug">{libro.titulo}</p>
        <p className="text-sm text-tenue">
          {libro.autor}
          {libro.autor && " · "}
          {NOMBRES_FUENTE[libro.fuente]}
          {libro.idioma && libro.idioma !== "es" && (
            <span className="ml-2 rounded border border-borde px-1.5 py-0.5 text-xs font-semibold uppercase">
              {libro.idioma}
            </span>
          )}
        </p>

        <div className="mt-4 flex items-center gap-3">
          <Link href={ruta} className="boton-primario">
            Leer ahora
          </Link>
          <BotonFavorito
            fuente={libro.fuente}
            id={libro.id}
            titulo={libro.titulo}
            inicial={favoritos.has(`${libro.fuente}:${libro.id}`)}
          />
        </div>
      </div>
    </section>
  );
}

// Mientras se elige el libro (la primera visita del día puede tardar unos
// segundos), un hueco del mismo tamaño para que la página no brinque.
export function LibroDelDiaCargando() {
  return (
    <div
      aria-hidden="true"
      className="h-48 animate-pulse rounded-2xl border border-borde bg-superficie sm:h-64"
    />
  );
}
