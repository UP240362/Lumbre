"use client";

// CALIFICAR Y RESEÑAR EL LIBRO (en el lector)
//   - AvisoResenas: al final de cada capítulo, el promedio y un botón para
//     calificar. En el último capítulo es más grande ("¿Qué te pareció?").
//   - PanelResenas: panel lateral con el formulario propio (estrellas y
//     reseña breve) y las reseñas de los demás.

import Link from "next/link";
import { useState, useTransition } from "react";
import { Estrellas } from "@/components/Estrellas";
import { IconoCerrar } from "@/components/Iconos";
import type { DatosResenas } from "@/lib/resenas";
import { borrarResena, guardarResena } from "../../acciones-resenas";

const MAX_TEXTO = 1000;

export function useResenas(libro: { fuente: string; id: string }, iniciales: DatosResenas) {
  const [datos, setDatos] = useState(iniciales);
  const [abierto, setAbierto] = useState(false);
  // Estrellas elegidas desde el aviso antes de abrir el panel.
  const [preelegida, setPreelegida] = useState<number | null>(null);
  return {
    libro,
    datos,
    setDatos,
    abierto,
    abrir: (estrellas?: number) => {
      setPreelegida(estrellas ?? null);
      setAbierto(true);
    },
    cerrar: () => setAbierto(false),
    preelegida,
  };
}

type Resenas = ReturnType<typeof useResenas>;

const formatoNumero = (n: number) => n.toLocaleString("es-MX", { maximumFractionDigits: 1 });
const textoCantidad = (n: number) => (n === 1 ? "1 reseña" : `${n} reseñas`);

// Estrellas que se pueden tocar para elegir de 1 a 5.
function ElegirEstrellas({
  valor,
  alElegir,
  grande = false,
}: {
  valor: number;
  alElegir: (n: number) => void;
  grande?: boolean;
}) {
  const nombres = ["Muy malo", "Malo", "Regular", "Bueno", "Excelente"];
  return (
    <div role="radiogroup" aria-label="Calificación" className="flex gap-1">
      {[1, 2, 3, 4, 5].map((n) => (
        <button
          key={n}
          type="button"
          role="radio"
          aria-checked={valor === n}
          aria-label={`${n} ${n === 1 ? "estrella" : "estrellas"}: ${nombres[n - 1]}`}
          onClick={() => alElegir(n)}
          className="rounded-md p-0.5 text-naranja transition-transform hover:scale-110"
        >
          <svg viewBox="0 0 24 24" aria-hidden="true" className={grande ? "size-9" : "size-7"}>
            <path
              d="M12 3.5l2.6 5.3 5.9.9-4.3 4.1 1 5.8L12 16.9l-5.2 2.7 1-5.8-4.3-4.1 5.9-.9z"
              fill={n <= valor ? "currentColor" : "none"}
              stroke="currentColor"
              strokeWidth="1.6"
              strokeLinejoin="round"
            />
          </svg>
        </button>
      ))}
    </div>
  );
}

export function AvisoResenas({
  resenas,
  titulo,
  esUltimo,
}: {
  resenas: Resenas;
  titulo: string;
  esUltimo: boolean;
}) {
  const { datos } = resenas;
  const resumen =
    datos.cantidad > 0 ? (
      <span className="flex flex-wrap items-center gap-2">
        <Estrellas valor={datos.promedio} />
        <span>
          {formatoNumero(datos.promedio)} · {textoCantidad(datos.cantidad)}
        </span>
      </span>
    ) : (
      <span>Aún no tiene reseñas.</span>
    );

  if (esUltimo) {
    return (
      <section
        aria-label="Calificar el libro"
        className="mt-12 rounded-2xl border-2 border-naranja/60 bg-superficie p-5 font-sans"
      >
        <h2 className="font-serif text-2xl font-semibold">
          {datos.mia ? "Tu calificación" : "¿Qué te pareció?"}
        </h2>
        <p className="mt-1 text-tenue">{titulo}</p>
        <div className="mt-4">
          <ElegirEstrellas
            grande
            valor={datos.mia?.calificacion ?? 0}
            alElegir={(n) => resenas.abrir(n)}
          />
        </div>
        <div className="mt-4 flex flex-wrap items-center justify-between gap-3 text-sm text-tenue">
          {resumen}
          <button
            type="button"
            onClick={() => resenas.abrir()}
            className="font-semibold text-acento underline underline-offset-4"
          >
            {datos.mia ? "Editar mi reseña" : "Escribir una reseña"}
            {datos.otras.length > 0 && " y ver las demás"}
          </button>
        </div>
      </section>
    );
  }

  return (
    <div className="mt-8 flex flex-wrap items-center justify-between gap-3 font-sans text-sm text-tenue">
      {resumen}
      <button
        type="button"
        onClick={() => resenas.abrir()}
        className="font-semibold text-acento underline underline-offset-4"
      >
        {datos.mia ? "Ver reseñas" : "Calificar este libro"}
      </button>
    </div>
  );
}

export function PanelResenas({ resenas, titulo }: { resenas: Resenas; titulo: string }) {
  if (!resenas.abierto) return null;
  return (
    // Fondo oscuro: tocarlo cierra el panel.
    <div className="fixed inset-0 z-30 flex justify-end bg-black/50" onClick={resenas.cerrar}>
      <aside
        role="dialog"
        aria-label="Calificaciones y reseñas"
        onClick={(e) => e.stopPropagation()}
        className="flex h-full w-full max-w-md flex-col border-l-2 border-naranja bg-orilla text-orilla-texto"
      >
        <header className="flex items-center justify-between gap-3 border-b border-orilla-borde px-5 py-4">
          <div className="min-w-0">
            <h2 className="font-serif text-2xl font-semibold">Reseñas</h2>
            <p className="truncate text-sm text-orilla-tenue">{titulo}</p>
          </div>
          <button
            type="button"
            onClick={resenas.cerrar}
            aria-label="Cerrar"
            className="flex size-10 shrink-0 items-center justify-center rounded-full border border-orilla-borde text-orilla-tenue hover:border-naranja hover:text-orilla-texto"
          >
            <IconoCerrar />
          </button>
        </header>

        <div className="flex-1 overflow-y-auto p-5">
          <FormularioResena resenas={resenas} />

          <section aria-labelledby="otras-resenas" className="mt-8">
            <h3 id="otras-resenas" className="flex flex-wrap items-center gap-2 text-lg font-semibold">
              Lo que opinan los demás
            </h3>
            {resenas.datos.cantidad > 0 && (
              <p className="mt-1 flex items-center gap-2 text-sm text-orilla-tenue">
                <Estrellas valor={resenas.datos.promedio} />
                Promedio: {formatoNumero(resenas.datos.promedio)} de 5 ·{" "}
                {textoCantidad(resenas.datos.cantidad)}
                {resenas.datos.mia && " (contando la tuya)"}
              </p>
            )}
            {resenas.datos.otras.length === 0 ? (
              <p className="mt-3 text-orilla-tenue">
                Nadie más ha reseñado este libro todavía.
              </p>
            ) : (
              <ul className="mt-4 flex flex-col gap-4">
                {resenas.datos.otras.map((r, i) => (
                  <li key={i} className="rounded-xl border border-orilla-borde p-4">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      {r.apodo ? (
                        <Link
                          href={`/lectores/${encodeURIComponent(r.apodo)}`}
                          className="font-semibold hover:text-naranja hover:underline"
                        >
                          @{r.nombre}
                        </Link>
                      ) : (
                        <span className="font-semibold">{r.nombre}</span>
                      )}
                      <Estrellas valor={r.calificacion} />
                    </div>
                    <p className="mt-0.5 text-xs text-orilla-tenue">
                      {new Date(r.fecha).toLocaleDateString("es-MX", { dateStyle: "medium" })}
                    </p>
                    {r.texto && (
                      <p className="mt-2 whitespace-pre-line break-words">{r.texto}</p>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>
      </aside>
    </div>
  );
}

function FormularioResena({ resenas }: { resenas: Resenas }) {
  const { mia } = resenas.datos;
  const [estrellas, setEstrellas] = useState(resenas.preelegida ?? mia?.calificacion ?? 0);
  const [texto, setTexto] = useState(mia?.texto ?? "");
  const [mensaje, setMensaje] = useState<{ tipo: "ok" | "error"; texto: string } | null>(null);
  const [enviando, iniciar] = useTransition();

  const cambio = estrellas !== (mia?.calificacion ?? 0) || texto.trim() !== (mia?.texto ?? "");

  function guardar() {
    if (estrellas < 1) {
      setMensaje({ tipo: "error", texto: "Elige de 1 a 5 estrellas." });
      return;
    }
    iniciar(async () => {
      const r = await guardarResena(resenas.libro.fuente, resenas.libro.id, estrellas, texto).catch(
        () => ({ ok: false as const, error: "Sin conexión. Intenta cuando tengas internet." }),
      );
      if (r.ok) {
        resenas.setDatos(r.datos);
        setMensaje({ tipo: "ok", texto: "Reseña guardada." });
      } else setMensaje({ tipo: "error", texto: r.error });
    });
  }

  function borrar() {
    if (!confirm("¿Borrar tu calificación y tu reseña?")) return;
    iniciar(async () => {
      const r = await borrarResena(resenas.libro.fuente, resenas.libro.id).catch(() => ({
        ok: false as const,
        error: "Sin conexión. Intenta cuando tengas internet.",
      }));
      if (r.ok) {
        resenas.setDatos(r.datos);
        setEstrellas(0);
        setTexto("");
        setMensaje({ tipo: "ok", texto: "Se borró tu reseña." });
      } else setMensaje({ tipo: "error", texto: r.error });
    });
  }

  return (
    <section aria-labelledby="mi-resena">
      <h3 id="mi-resena" className="text-lg font-semibold">
        {mia ? "Tu reseña" : "Califica este libro"}
      </h3>
      <div className="mt-3">
        <ElegirEstrellas valor={estrellas} alElegir={setEstrellas} />
      </div>
      <label className="mt-4 block">
        <span className="text-sm text-orilla-tenue">Reseña breve (opcional)</span>
        <textarea
          value={texto}
          onChange={(e) => setTexto(e.target.value.slice(0, MAX_TEXTO))}
          maxLength={MAX_TEXTO}
          rows={5}
          placeholder="¿Qué te gustó? ¿A quién se lo recomendarías?"
          className="mt-1 block w-full resize-y rounded-xl border border-orilla-borde bg-orilla p-3 text-orilla-texto placeholder:text-orilla-tenue focus:border-naranja"
        />
        <span className="mt-1 block text-right text-xs text-orilla-tenue">
          {texto.length} / {MAX_TEXTO}
        </span>
      </label>
      <p className="text-xs text-orilla-tenue">
        Tu reseña la verán los demás lectores de Lumbre con tu apodo.
      </p>

      <div className="mt-4 flex flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={guardar}
          disabled={enviando || !cambio}
          className="boton-primario disabled:opacity-50"
        >
          {enviando ? "Guardando…" : mia ? "Guardar cambios" : "Publicar"}
        </button>
        {mia && (
          <button
            type="button"
            onClick={borrar}
            disabled={enviando}
            className="min-h-11 rounded-xl border-2 border-orilla-borde px-4 font-semibold hover:border-naranja disabled:opacity-50"
          >
            Borrar
          </button>
        )}
      </div>
      {mensaje && (
        <p
          role="status"
          className={`mt-3 text-sm ${mensaje.tipo === "ok" ? "text-orilla-tenue" : "font-semibold text-naranja"}`}
        >
          {mensaje.texto}
        </p>
      )}
    </section>
  );
}
