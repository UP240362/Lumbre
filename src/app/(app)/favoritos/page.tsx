import Link from "next/link";
import { Suspense } from "react";
import { RejillaLibros, type DatosTarjeta } from "@/components/TarjetaLibro";
import { claveLibro } from "@/lib/favoritos";
import { esFuente } from "@/lib/fuentes";
import { crearClienteServidor } from "@/lib/supabase/servidor";

export const metadata = { title: "Favoritos · Lumbre" };

// Lee de Supabase los libros marcados con el corazón, del más reciente
// al más antiguo. (RLS garantiza que solo salgan los del usuario.)
async function ListaFavoritos() {
  const supabase = await crearClienteServidor();
  const { data } = await supabase
    .from("libros_favoritos")
    .select("book_id, fuente, titulo, autor")
    .order("creado_en", { ascending: false });

  const libros: DatosTarjeta[] = (data ?? []).flatMap((f) =>
    esFuente(f.fuente)
      ? [{ id: f.book_id, fuente: f.fuente, titulo: f.titulo, autor: f.autor ?? "" }]
      : [],
  );

  if (libros.length === 0) {
    return (
      <p className="rounded-2xl border border-dashed border-borde p-6 text-tenue">
        Aún no tienes favoritos. Toca el corazón de cualquier libro para
        guardarlo aquí, o{" "}
        <Link href="/explorar" className="text-acento underline underline-offset-4">
          explora el catálogo
        </Link>
        .
      </p>
    );
  }

  return (
    <>
      <p className="text-tenue">
        {libros.length} {libros.length === 1 ? "libro" : "libros"}
      </p>
      <RejillaLibros libros={libros} favoritos={new Set(libros.map(claveLibro))} />
    </>
  );
}

export default function Favoritos() {
  return (
    <div className="flex flex-col gap-8">
      <h1 className="font-serif text-4xl font-semibold md:text-5xl">
        Favoritos
      </h1>
      <Suspense fallback={<p className="text-tenue">Cargando tus favoritos…</p>}>
        <ListaFavoritos />
      </Suspense>
    </div>
  );
}
