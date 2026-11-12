import { Suspense } from "react";
import { Buscador } from "@/components/Buscador";
import { LibroDelDia, LibroDelDiaCargando } from "@/components/LibroDelDia";
import { RejillaLibros } from "@/components/TarjetaLibro";
import { obtenerClavesFavoritas } from "@/lib/favoritos";
import { buscarLibros, type Libro } from "@/lib/fuentes";
import { librosRecientes } from "@/lib/fuentes/biblioteca";

export const metadata = { title: "Explorar · Lumbre" };

// Datos que necesita cada tarjeta de libro.
const aTarjeta = (libro: Libro) => ({
  id: libro.id,
  fuente: libro.fuente,
  titulo: libro.titulo,
  autor: libro.autores.join(", "),
  idioma: libro.idiomas[0],
});

// Lee ?q=... de la dirección, busca en todas las fuentes y pinta el
// buscador (con lo que se escribió) y los resultados.
async function Resultados({
  searchParams,
}: {
  searchParams: PageProps<"/explorar">["searchParams"];
}) {
  const { q } = await searchParams;
  const consulta = (typeof q === "string" ? q : "").trim().slice(0, 80);

  // Sin búsqueda: el libro del día y los libros de la Biblioteca Lumbre.
  if (consulta.length < 2) {
    const [recientes, favoritos] = await Promise.all([
      librosRecientes().catch(() => []),
      obtenerClavesFavoritas(),
    ]);
    return (
      <>
        <Buscador />
        <p className="text-tenue">
          Escribe un título o un autor para buscar en la Biblioteca Lumbre,
          Project Gutenberg, Elejandría e Internet Archive.
        </p>
        <Suspense fallback={<LibroDelDiaCargando />}>
          <LibroDelDia />
        </Suspense>
        {recientes.length > 0 && (
          <section aria-labelledby="biblioteca" className="flex flex-col gap-4">
            <h2 id="biblioteca" className="font-serif text-2xl font-semibold">
              En la Biblioteca Lumbre
            </h2>
            <RejillaLibros favoritos={favoritos} libros={recientes.map(aTarjeta)} />
          </section>
        )}
      </>
    );
  }

  // Primero se piden los datos (lo que puede fallar)…
  const [libros, favoritos] = await Promise.all([
    buscarLibros(consulta).catch(() => null),
    obtenerClavesFavoritas(),
  ]);

  // …y después se decide qué pintar.
  let contenido: React.ReactNode;
  if (libros === null) {
    contenido = (
      <p role="alert" className="text-tenue">
        No pudimos consultar los catálogos en este momento. Intenta de nuevo
        en un minuto.
      </p>
    );
  } else {
    contenido =
      libros.length === 0 ? (
        <p className="text-tenue">
          No encontramos libros de dominio público para “{consulta}”. Prueba
          con otro título o con el apellido del autor.
        </p>
      ) : (
        <>
          <p className="text-tenue">
            {libros.length} {libros.length === 1 ? "resultado" : "resultados"}{" "}
            para “{consulta}”
          </p>
          <RejillaLibros
            favoritos={favoritos}
            libros={libros.map(aTarjeta)}
          />
        </>
      );
  }

  return (
    <>
      <Buscador valorInicial={consulta} />
      {contenido}
    </>
  );
}

export default function Explorar({ searchParams }: PageProps<"/explorar">) {
  return (
    <div className="flex flex-col gap-8">
      <h1 className="font-serif text-4xl font-semibold md:text-5xl">
        Explorar
      </h1>
      {/* Mientras llegan los resultados se ve el buscador y "Buscando…" */}
      <Suspense
        fallback={
          <>
            <Buscador />
            <p className="text-tenue">Buscando…</p>
          </>
        }
      >
        <Resultados searchParams={searchParams} />
      </Suspense>
    </div>
  );
}
