// Tarjeta de un libro: portada, título, autor, de qué fuente viene y el
// corazón de favorito. La portada y el texto son enlaces al lector.

import Link from "next/link";
import { NOMBRES_FUENTE, type IdFuente } from "@/lib/fuentes/tipos";
import { resumenesDe, type Resumen } from "@/lib/resenas";
import { BotonFavorito } from "./BotonFavorito";
import { Estrellas } from "./Estrellas";
import { PortadaLibro } from "./PortadaLibro";

export type DatosTarjeta = {
  id: string;
  fuente: IdFuente;
  titulo: string;
  autor: string;
  idioma?: string; // se muestra solo si no es español
};

// Dirección de la página de lectura de un libro.
export function rutaLibro(libro: { fuente: string; id: string }): string {
  return `/leer/${libro.fuente}/${encodeURIComponent(libro.id)}`;
}

export function TarjetaLibro({
  libro,
  favorito,
  resumen,
}: {
  libro: DatosTarjeta;
  favorito: boolean;
  resumen?: Resumen; // promedio de estrellas, si alguien lo ha calificado
}) {
  const ruta = rutaLibro(libro);
  return (
    <div>
      {/* El título ya es un enlace; este segundo enlace (la portada) se
          oculta a lectores de pantalla para no repetirlo. */}
      <Link
        href={ruta}
        tabIndex={-1}
        aria-hidden="true"
        className="block transition-transform hover:-translate-y-1"
      >
        <PortadaLibro titulo={libro.titulo} autor={libro.autor} />
      </Link>
      <div className="mt-3 flex items-start justify-between gap-2">
        <Link href={ruta} className="min-w-0">
          <p className="line-clamp-2 font-semibold leading-snug">
            {libro.titulo}
          </p>
          {libro.autor && (
            <p className="line-clamp-1 text-sm text-tenue">{libro.autor}</p>
          )}
          {resumen && (
            <p className="mt-1 flex items-center gap-1.5 text-xs text-tenue">
              <Estrellas valor={resumen.promedio} className="size-3.5" />
              <span aria-hidden="true">
                {resumen.promedio.toLocaleString("es-MX", { maximumFractionDigits: 1 })} (
                {resumen.cantidad})
              </span>
            </p>
          )}
          <p className="mt-1 text-xs text-tenue">
            {NOMBRES_FUENTE[libro.fuente]}
            {libro.idioma && libro.idioma !== "es" && (
              <span className="ml-2 rounded border border-borde px-1.5 py-0.5 font-semibold uppercase">
                {libro.idioma}
              </span>
            )}
          </p>
        </Link>
        <BotonFavorito
          fuente={libro.fuente}
          id={libro.id}
          titulo={libro.titulo}
          inicial={favorito}
        />
      </div>
    </div>
  );
}

// Rejilla que acomoda las tarjetas: 2 columnas en celular, hasta 5 en grande.
// (En "md" vuelve a 2 porque ahí aparece la barra lateral y quita espacio.)
// "favoritos" son las claves ("fuente:id") de los libros ya marcados.
// También trae el promedio de estrellas de cada libro.
export async function RejillaLibros({
  libros,
  favoritos,
}: {
  libros: DatosTarjeta[];
  favoritos: Set<string>;
}) {
  const resumenes = await resumenesDe(libros);
  return (
    <ul className="grid grid-cols-2 gap-x-5 gap-y-8 sm:grid-cols-3 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5">
      {libros.map((libro) => {
        const clave = `${libro.fuente}:${libro.id}`;
        return (
          <li key={clave}>
            <TarjetaLibro
              libro={libro}
              favorito={favoritos.has(clave)}
              resumen={resumenes.get(clave)}
            />
          </li>
        );
      })}
    </ul>
  );
}
