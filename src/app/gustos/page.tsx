import Link from "next/link";
import { Suspense } from "react";
import { obtenerPerfil } from "@/lib/sesion";
import {
  AUTORES_SUGERIDOS,
  LIBROS_SUGERIDOS,
  type LibroElegible,
} from "@/lib/sugerencias";
import { esFuente } from "@/lib/fuentes";
import { crearClienteServidor } from "@/lib/supabase/servidor";
import { FormularioGustos } from "./FormularioGustos";

export const metadata = { title: "Tus gustos · Lumbre" };

// Parte que depende de quién inició sesión: lee lo que ya tenía elegido
// (si viene de "Editar mis gustos") y se lo pasa al formulario.
async function Contenido() {
  const perfil = await obtenerPerfil();
  const supabase = await crearClienteServidor();

  const [autores, favoritos] = await Promise.all([
    supabase.from("autores_preferidos").select("nombre_autor").order("creado_en"),
    supabase
      .from("libros_favoritos")
      .select("book_id, fuente, titulo, autor")
      .order("creado_en"),
  ]);

  const librosIniciales: LibroElegible[] = (favoritos.data ?? []).flatMap((f) =>
    esFuente(f.fuente)
      ? [{ id: f.book_id, fuente: f.fuente, titulo: f.titulo, autor: f.autor ?? "" }]
      : [],
  );
  const primeraVez = !perfil.gustos_completados;

  return (
    <>
      <header className="flex items-center justify-between gap-4">
        <p className="font-serif text-3xl font-bold text-naranja">Lumbre</p>
        {primeraVez ? (
          <p className="flex items-center gap-3 text-sm text-orilla-tenue">
            Paso 2 de 2
            <span className="h-1.5 w-24 rounded-full bg-naranja sm:w-36" />
          </p>
        ) : (
          <Link
            href="/perfil"
            className="text-sm font-medium text-naranja underline underline-offset-4"
          >
            Volver a mi perfil
          </Link>
        )}
      </header>

      <div className="mt-10">
        <h1 className="font-serif text-4xl font-semibold text-orilla-texto sm:text-5xl">
          Cuéntanos qué te gusta leer
        </h1>
        <p className="mt-4 text-lg text-orilla-tenue">
          {primeraVez
            ? "Con esto armamos tus primeras recomendaciones. Puedes cambiarlo después en tu perfil."
            : "Con esto armamos tus recomendaciones."}
        </p>
      </div>

      <div className="mt-10">
        <FormularioGustos
          primeraVez={primeraVez}
          autoresSugeridos={AUTORES_SUGERIDOS.map((a) => a.nombre)}
          librosSugeridos={LIBROS_SUGERIDOS}
          autoresIniciales={(autores.data ?? []).map((a) => a.nombre_autor)}
          librosIniciales={librosIniciales}
        />
      </div>
    </>
  );
}

// Pantalla negra con marco naranja, igual que el login.
export default function Gustos() {
  return (
    <div className="min-h-dvh border-4 border-naranja bg-negro md:border-8">
      <div className="mx-auto w-full max-w-4xl px-5 py-10 md:px-10 md:py-14">
        <Suspense
          fallback={<p className="text-orilla-tenue">Cargando tus gustos…</p>}
        >
          <Contenido />
        </Suspense>
      </div>
    </div>
  );
}
