// Sección "Mis reseñas" de Mi perfil: las reseñas que escribió el usuario,
// con enlace al libro para leerlo o editar la reseña (al final del libro).
// Se muestran 5; las demás quedan en "Ver todas".

import Link from "next/link";
import { misResenas, type MiResena } from "@/lib/resenas";
import { obtenerUsuario } from "@/lib/sesion";
import { BotonBorrarResena } from "./BotonBorrarResena";
import { Estrellas } from "./Estrellas";
import { rutaLibro } from "./TarjetaLibro";

const VISIBLES = 5;

function Tarjeta({ r }: { r: MiResena }) {
  return (
    <li className="rounded-2xl border border-borde bg-superficie p-5">
      <div className="flex flex-wrap items-start justify-between gap-x-4 gap-y-2">
        <div className="min-w-0">
          <Link
            href={rutaLibro(r)}
            className="font-serif text-lg font-semibold hover:text-acento hover:underline"
          >
            {r.titulo}
          </Link>
          {r.autor && <p className="text-sm text-tenue">{r.autor}</p>}
        </div>
        <Estrellas valor={r.calificacion} className="size-5" />
      </div>
      {r.texto ? (
        <p className="mt-3 whitespace-pre-line break-words">{r.texto}</p>
      ) : (
        <p className="mt-3 text-sm text-tenue">Solo calificación, sin reseña escrita.</p>
      )}
      <div className="mt-4 flex flex-wrap items-center justify-between gap-3 text-sm">
        <span className="text-tenue">
          {new Date(r.fecha).toLocaleDateString("es-MX", { dateStyle: "long" })}
        </span>
        <span className="flex items-center gap-4">
          <Link
            href={rutaLibro(r)}
            className="font-semibold text-acento underline underline-offset-4"
          >
            Ir al libro
          </Link>
          <BotonBorrarResena fuente={r.fuente} id={r.id} titulo={r.titulo} />
        </span>
      </div>
    </li>
  );
}

export async function MisResenas() {
  const usuario = await obtenerUsuario();
  if (!usuario) return null;
  const resenas = await misResenas(usuario.id);

  if (resenas.length === 0) {
    return (
      <p className="rounded-2xl border border-dashed border-borde p-5 text-tenue">
        Aún no has reseñado ningún libro. Al terminar uno, califícalo en
        “¿Qué te pareció?”.
      </p>
    );
  }

  const promedio = resenas.reduce((s, r) => s + r.calificacion, 0) / resenas.length;
  const primeras = resenas.slice(0, VISIBLES);
  const resto = resenas.slice(VISIBLES);

  return (
    <div className="flex flex-col gap-4">
      <p className="flex flex-wrap items-center gap-2 text-sm text-tenue">
        {resenas.length === 1 ? "1 reseña" : `${resenas.length} reseñas`} · das en promedio
        <Estrellas valor={promedio} />
        {promedio.toLocaleString("es-MX", { maximumFractionDigits: 1 })}
      </p>
      <ul className="flex flex-col gap-4">
        {primeras.map((r) => (
          <Tarjeta key={`${r.fuente}:${r.id}`} r={r} />
        ))}
      </ul>
      {resto.length > 0 && (
        <details className="group">
          <summary className="cursor-pointer font-semibold text-acento underline underline-offset-4">
            <span className="group-open:hidden">Ver todas ({resenas.length})</span>
            <span className="hidden group-open:inline">Ver menos</span>
          </summary>
          <ul className="mt-4 flex flex-col gap-4">
            {resto.map((r) => (
              <Tarjeta key={`${r.fuente}:${r.id}`} r={r} />
            ))}
          </ul>
        </details>
      )}
    </div>
  );
}
