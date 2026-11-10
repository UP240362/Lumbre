import { Suspense } from "react";
import { Buscador } from "@/components/Buscador";
import { RejillaLibros } from "@/components/TarjetaLibro";
import { obtenerClavesFavoritas } from "@/lib/favoritos";
import { buscarLibros } from "@/lib/fuentes";

export const metadata = { title: "Explorar · Lumbre" };

// Lee ?q=... de la dirección, busca en todas las fuentes y pinta el
// buscador (con lo que se escribió) y los resultados.
async function Resultados({
  searchParams,
}: {
  searchParams: PageProps<"/explorar">["searchParams"];
}) {
  const { q } = await searchParams;
  const consulta = (typeof q === "string" ? q : "").trim().slice(0, 80);

  if (consulta.length < 2) {
    return (
      <>
        <Buscador />
        <p className="text-tenue">
          Escribe un título o un autor para buscar en Project Gutenberg,
          Elejandría e Internet Archive.
        </p>
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
            libros={libros.map((libro) => ({
              id: libro.id,
              fuente: libro.fuente,
              titulo: libro.titulo,
              autor: libro.autores.join(", "),
              idioma: libro.idiomas[0],
            }))}
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
