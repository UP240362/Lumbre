import Link from "next/link";
import { Suspense } from "react";
import type { Lector } from "@/app/acciones-social";
import { BuscadorLectores, FilaLector } from "@/components/Amistad";
import { obtenerPerfil } from "@/lib/sesion";
import { crearClienteServidor } from "@/lib/supabase/servidor";

export const metadata = { title: "Amigos · Lumbre" };

// Página de Amigos: buscar lectores por apodo, responder solicitudes y ver
// a tus amigos. Las reglas (quién ve qué) están en la base de datos.

function Lista({ titulo, lectores, vacio }: { titulo: string; lectores: Lector[]; vacio?: string }) {
  if (lectores.length === 0 && !vacio) return null;
  return (
    <section>
      <h2 className="mb-3 text-xl font-semibold">
        {titulo}
        {lectores.length > 0 && <span className="ml-2 text-base font-normal text-tenue">{lectores.length}</span>}
      </h2>
      {lectores.length === 0 ? (
        <p className="text-tenue">{vacio}</p>
      ) : (
        <ul className="flex flex-col gap-3">
          {lectores.map((l) => (
            <FilaLector key={l.apodo} lector={l} />
          ))}
        </ul>
      )}
    </section>
  );
}

async function Contenido() {
  const perfil = await obtenerPerfil();
  if (!perfil.apodo) {
    return (
      <div className="rounded-2xl border border-borde bg-superficie p-6">
        <p className="text-lg font-semibold">Primero elige tu apodo</p>
        <p className="mt-1 text-tenue">
          Es el nombre con el que otros lectores te encuentran. Tu nombre real no se muestra.
        </p>
        <Link href="/perfil#publico" className="boton-primario mt-4 inline-flex">
          Elegir mi apodo
        </Link>
      </div>
    );
  }

  const supabase = await crearClienteServidor();
  const { data } = await supabase.rpc("mis_amistades");
  const todos = (data ?? []) as Lector[];
  const recibidas = todos.filter((l) => l.relacion === "recibida");
  const amigos = todos.filter((l) => l.relacion === "amigo");
  const enviadas = todos.filter((l) => l.relacion === "enviada");

  return (
    <div className="flex flex-col gap-10">
      <section>
        <p className="mb-3 text-tenue">
          Tú eres{" "}
          <Link href={`/lectores/${perfil.apodo}`} className="font-semibold text-acento underline underline-offset-4">
            @{perfil.apodo}
          </Link>
          . Busca a otros lectores por su apodo:
        </p>
        <BuscadorLectores />
      </section>
      <Lista titulo="Solicitudes para ti" lectores={recibidas} />
      <Lista
        titulo="Tus amigos"
        lectores={amigos}
        vacio="Aún no tienes amigos en Lumbre. Busca a alguien por su apodo y mándale una solicitud."
      />
      <Lista titulo="Solicitudes que enviaste" lectores={enviadas} />
    </div>
  );
}

export default function Amigos() {
  return (
    <div className="flex flex-col gap-8">
      <h1 className="font-serif text-4xl font-semibold md:text-5xl">Amigos</h1>
      <Suspense fallback={<p className="text-tenue">Cargando…</p>}>
        <Contenido />
      </Suspense>
    </div>
  );
}
