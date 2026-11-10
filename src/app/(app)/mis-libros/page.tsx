import { Suspense } from "react";
import { TarjetaLibro } from "@/components/TarjetaLibro";
import { obtenerClavesFavoritas } from "@/lib/favoritos";
import { crearClienteServidor } from "@/lib/supabase/servidor";
import { BotonEliminar } from "./BotonEliminar";
import { FormularioAgregar } from "./FormularioAgregar";

export const metadata = { title: "Mis libros · Lumbre" };

// Lista de los libros que el usuario agregó, del más reciente al más antiguo.
async function Lista() {
  const supabase = await crearClienteServidor();
  const [{ data }, favoritos] = await Promise.all([
    supabase
      .from("libros_propios")
      .select("id, titulo, autor, tipo")
      .order("creado_en", { ascending: false }),
    obtenerClavesFavoritas(),
  ]);

  if (!data || data.length === 0) {
    return (
      <p className="rounded-2xl border border-dashed border-borde p-6 text-tenue">
        Aún no has agregado libros. Sube un PDF o ePub, o pega un enlace con
        el formulario de arriba.
      </p>
    );
  }

  return (
    <ul className="grid grid-cols-2 gap-x-5 gap-y-8 sm:grid-cols-3 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5">
      {data.map((fila) => (
        <li key={fila.id}>
          <TarjetaLibro
            libro={{
              id: fila.id,
              fuente: "propio",
              titulo: fila.titulo,
              autor: fila.autor ?? "",
            }}
            favorito={favoritos.has(`propio:${fila.id}`)}
          />
          <p className="text-xs text-tenue">
            {fila.tipo === "archivo" ? "Archivo subido" : "Enlace"}
          </p>
          <BotonEliminar id={fila.id} titulo={fila.titulo} />
        </li>
      ))}
    </ul>
  );
}

export default function MisLibros() {
  return (
    <div className="flex flex-col gap-10">
      <div>
        <h1 className="font-serif text-4xl font-semibold md:text-5xl">
          Mis libros
        </h1>
        <p className="mt-3 max-w-prose text-tenue">
          Agrega tus propios libros para leerlos aquí con tus luces y tu avance
          guardado. Solo tú puedes verlos.
        </p>
      </div>

      <section aria-labelledby="agregar">
        <h2 id="agregar" className="mb-4 text-xl font-semibold">
          Agregar un libro
        </h2>
        <FormularioAgregar />
      </section>

      <section aria-labelledby="lista">
        <h2 id="lista" className="mb-4 text-xl font-semibold">
          Tus libros
        </h2>
        <Suspense fallback={<p className="text-tenue">Cargando tus libros…</p>}>
          <Lista />
        </Suspense>
      </section>
    </div>
  );
}
