import Link from "next/link";
import { Suspense } from "react";
import { BotonCerrarSesion } from "@/components/BotonCerrarSesion";
import { SelectorLuz } from "@/components/SelectorLuz";
import { SelectorTamano } from "@/components/SelectorTamano";
import { TiempoDeLectura } from "@/components/TiempoDeLectura";
import { obtenerPerfil } from "@/lib/sesion";

export const metadata = { title: "Mi perfil · Lumbre" };

// Nombre y correo de la cuenta. Va aparte porque necesita la sesión.
async function DatosDeCuenta() {
  const perfil = await obtenerPerfil();
  return (
    <dl className="grid gap-x-8 gap-y-3 sm:grid-cols-[auto_1fr]">
      <dt className="text-tenue">Nombre</dt>
      <dd className="font-medium">{perfil.nombre ?? "Sin nombre"}</dd>
      <dt className="text-tenue">Correo</dt>
      <dd className="break-all font-medium">{perfil.correo}</dd>
    </dl>
  );
}

export default function Perfil() {
  return (
    <div className="flex flex-col gap-10">
      <h1 className="font-serif text-4xl font-semibold md:text-5xl">
        Mi perfil
      </h1>

      <section aria-labelledby="cuenta">
        <h2 id="cuenta" className="mb-4 text-xl font-semibold">
          Cuenta
        </h2>
        <div className="rounded-2xl border border-borde bg-superficie p-5">
          <Suspense fallback={<p className="text-tenue">Cargando…</p>}>
            <DatosDeCuenta />
          </Suspense>
        </div>
      </section>

      <section aria-labelledby="tiempo">
        <h2 id="tiempo" className="mb-1 text-xl font-semibold">
          Tiempo de lectura
        </h2>
        <p className="mb-4 text-tenue">
          Solo cuenta mientras tienes un libro abierto y estás leyendo o
          escuchando.
        </p>
        <Suspense
          fallback={
            <div className="rounded-2xl border border-borde bg-superficie p-5 text-tenue">
              Cargando…
            </div>
          }
        >
          <TiempoDeLectura />
        </Suspense>
      </section>

      <section aria-labelledby="gustos">
        <h2 id="gustos" className="mb-1 text-xl font-semibold">
          Tus gustos
        </h2>
        <p className="mb-4 text-tenue">
          Autores preferidos y libros favoritos, para tus recomendaciones.
        </p>
        <Link href="/gustos" className="boton-primario">
          Editar mis gustos
        </Link>
      </section>

      <section aria-labelledby="luz">
        <h2 id="luz" className="mb-1 text-xl font-semibold">
          Luz
        </h2>
        <p className="mb-4 text-tenue">
          Cambia el color del área de lectura. Las orillas siempre son negras.
        </p>
        <SelectorLuz sobre="contenido" />
      </section>

      <section aria-labelledby="letra">
        <h2 id="letra" className="mb-1 text-xl font-semibold">
          Tamaño de letra
        </h2>
        <p className="mb-4 text-tenue">Se aplica al texto de los libros.</p>
        <SelectorTamano />
        <p className="lectura mt-6 rounded-2xl border border-borde bg-superficie p-5">
          En un lugar de la Mancha, de cuyo nombre no quiero acordarme, no ha
          mucho tiempo que vivía un hidalgo de los de lanza en astillero,
          adarga antigua, rocín flaco y galgo corredor.
        </p>
      </section>

      {/* Borra los libros guardados en el teléfono y cierra la sesión */}
      <BotonCerrarSesion />
    </div>
  );
}
