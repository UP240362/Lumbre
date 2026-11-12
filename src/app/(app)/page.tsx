import Link from "next/link";
import { Suspense } from "react";
import { AvanceMeta } from "@/components/AvanceMeta";
import { BarraAvance } from "@/components/BarraAvance";
import { Buscador } from "@/components/Buscador";
import { PortadaLibro } from "@/components/PortadaLibro";
import { RejillaLibros, rutaLibro } from "@/components/TarjetaLibro";
import { estadisticasDeLectura } from "@/lib/estadisticasLectura";
import { obtenerClavesFavoritas } from "@/lib/favoritos";
import { obtenerRecomendaciones } from "@/lib/recomendaciones";
import { obtenerPerfil } from "@/lib/sesion";
import { crearClienteServidor } from "@/lib/supabase/servidor";

// Página de Inicio (la Biblioteca).

// Saludo con el primer nombre del perfil. Va aparte porque necesita
// saber quién inició sesión (ver el Suspense de abajo).
async function Saludo() {
  const perfil = await obtenerPerfil();
  const primerNombre = perfil.nombre?.trim().split(/\s+/)[0];
  return <>{primerNombre ? `Hola, ${primerNombre}` : "Hola"}</>;
}

// Los libros que el usuario tiene empezados, del más reciente al más antiguo.
async function SeguirLeyendo() {
  const supabase = await crearClienteServidor();
  const { data } = await supabase
    .from("progreso_lectura")
    .select("book_id, fuente, titulo, autor, capitulo, porcentaje")
    .order("actualizado_en", { ascending: false })
    .limit(3);

  if (!data || data.length === 0) {
    return (
      <p className="rounded-2xl border border-dashed border-borde p-6 text-tenue">
        Aún no has empezado ningún libro. Elige uno de abajo o búscalo por
        título o autor.
      </p>
    );
  }

  return (
    <ul className="flex flex-col gap-4">
      {data.map((fila) => {
        const porcentaje = Math.round(Number(fila.porcentaje));
        return (
          <li
            key={`${fila.fuente}:${fila.book_id}`}
            className="flex flex-col gap-5 rounded-2xl border border-borde bg-superficie p-5 md:p-7 lg:flex-row lg:items-center"
          >
            <div className="flex min-w-0 flex-1 items-center gap-5">
              <div className="w-20 shrink-0 md:w-28">
                <PortadaLibro
                  titulo={fila.titulo}
                  autor={fila.autor ?? ""}
                  talla="chica"
                />
              </div>
              <div className="min-w-0 flex-1">
                <h3 className="font-serif text-xl font-semibold md:text-2xl">
                  {fila.titulo}
                </h3>
                <p className="mt-1 text-tenue">
                  {fila.autor ? `${fila.autor} · ` : ""}Parte{" "}
                  {fila.capitulo + 1}
                </p>
                <div className="mt-4">
                  <BarraAvance porcentaje={porcentaje} />
                </div>
                <p className="mt-2 text-sm text-tenue">
                  {porcentaje} % leído · avance guardado
                </p>
              </div>
            </div>
            <Link
              href={rutaLibro({ fuente: fila.fuente, id: fila.book_id })}
              className="boton-primario lg:px-8"
            >
              Continuar
            </Link>
          </li>
        );
      })}
    </ul>
  );
}

// Avance de la meta de lectura semanal (solo si el usuario tiene una).
async function MetaDeLaSemana() {
  const perfil = await obtenerPerfil();
  const e = await estadisticasDeLectura(perfil.id);
  if (!e.meta) return null;
  return (
    <section
      aria-label="Tu meta de lectura"
      className="rounded-2xl border border-borde bg-superficie p-5"
    >
      <AvanceMeta e={e} />
      <Link
        href="/perfil#meta"
        className="mt-3 inline-block text-sm font-semibold text-acento underline underline-offset-4"
      >
        Ver mi tiempo de lectura
      </Link>
    </section>
  );
}

// Libros recomendados según los autores y favoritos del usuario.
async function Recomendados() {
  const [{ libros, personalizadas }, favoritos] = await Promise.all([
    obtenerRecomendaciones(),
    obtenerClavesFavoritas(),
  ]);

  return (
    <>
      <p className="mb-5 mt-1 text-tenue">
        {personalizadas ? (
          "Según tus autores y libros favoritos"
        ) : (
          <>
            Clásicos en español.{" "}
            <Link href="/gustos" className="text-acento underline underline-offset-4">
              Elige tus gustos
            </Link>{" "}
            para recibir recomendaciones a tu medida.
          </>
        )}
      </p>
      <RejillaLibros libros={libros} favoritos={favoritos} />
    </>
  );
}

export default function Inicio() {
  return (
    <div className="flex flex-col gap-12">
      <header className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
        <h1 className="font-serif text-4xl font-semibold md:text-5xl">
          {/* Mientras llega el nombre se muestra solo "Hola" */}
          <Suspense fallback="Hola">
            <Saludo />
          </Suspense>
        </h1>
        <div className="w-full lg:max-w-sm">
          <Buscador />
        </div>
      </header>

      <Suspense fallback={null}>
        <MetaDeLaSemana />
      </Suspense>

      <section aria-labelledby="seguir">
        <h2 id="seguir" className="mb-4 text-xl font-semibold">
          Seguir leyendo
        </h2>
        <Suspense fallback={<p className="text-tenue">Cargando tu avance…</p>}>
          <SeguirLeyendo />
        </Suspense>
      </section>

      <section aria-labelledby="recomendados">
        <h2 id="recomendados" className="text-xl font-semibold">
          Recomendados para ti
        </h2>
        <Suspense
          fallback={
            <p className="mt-1 text-tenue">Buscando libros para ti…</p>
          }
        >
          <Recomendados />
        </Suspense>
      </section>
    </div>
  );
}
