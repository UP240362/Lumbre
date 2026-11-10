"use client";

// LA PANTALLA DEL LECTOR
// Barra superior (volver, título, luz, tamaño de letra), el texto del
// capítulo en una columna angosta, y barra inferior (anterior, avance,
// siguiente). Corre en el navegador porque debe seguir el desplazamiento
// de la página para calcular y guardar el avance.

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { BotonFavorito } from "@/components/BotonFavorito";
import { IconoAtras } from "@/components/Iconos";
import { LUCES, TAMANO_MAX, TAMANO_MIN, TAMANO_PASO } from "@/lib/luz";
import {
  guardarLuz,
  guardarTamano,
  useLuz,
  useTamanoLetra,
} from "@/lib/preferencias";
import { guardarAvance } from "../../acciones";

type Props = {
  libro: { id: string; fuente: string; titulo: string; autor: string };
  rutaBase: string; // dirección del libro, sin el número de capítulo
  indice: number; // capítulo actual, contando desde 0
  titulos: string[]; // títulos de todos los capítulos
  parrafos: string[]; // texto del capítulo actual
  // Para calcular el porcentaje del libro: cuántas letras hay antes de este
  // capítulo, cuántas tiene este y cuántas el libro entero.
  letrasAntes: number;
  letrasCapitulo: number;
  letrasTotal: number;
  // En qué punto del capítulo se quedó la última vez (0 = inicio, 1 = final).
  fraccionInicial: number;
  esFavorito: boolean;
};

// Qué tanto de la página se ha recorrido: 0 arriba, 1 hasta abajo.
function fraccionRecorrida(): number {
  const recorrible = document.documentElement.scrollHeight - window.innerHeight;
  if (recorrible <= 0) return 1; // el capítulo cabe completo en la pantalla
  return Math.min(1, Math.max(0, window.scrollY / recorrible));
}

export function VistaLector({
  libro,
  rutaBase,
  indice,
  titulos,
  parrafos,
  letrasAntes,
  letrasCapitulo,
  letrasTotal,
  fraccionInicial,
  esFavorito,
}: Props) {
  const router = useRouter();
  const luz = useLuz();
  const tamano = useTamanoLetra();

  const porcentajeDe = (fraccion: number) =>
    letrasTotal > 0
      ? ((letrasAntes + fraccion * letrasCapitulo) / letrasTotal) * 100
      : 0;

  const [porcentaje, setPorcentaje] = useState(() =>
    porcentajeDe(fraccionInicial),
  );
  const [estado, setEstado] = useState<"guardando" | "guardado" | "error">(
    "guardando",
  );
  // Último porcentaje calculado, para guardarlo al salir de la página.
  const pendiente = useRef<number | null>(null);

  useEffect(() => {
    let espera: ReturnType<typeof setTimeout> | undefined;

    async function guardar(valor: number) {
      pendiente.current = null;
      setEstado("guardando");
      const { ok } = await guardarAvance(libro.fuente, libro.id, indice, valor);
      setEstado(ok ? "guardado" : "error");
    }

    function alDesplazar() {
      const valor = porcentajeDe(fraccionRecorrida());
      setPorcentaje(valor);
      pendiente.current = valor;
      // Se guarda cuando la persona lleva 1.5 s sin moverse, no en cada
      // movimiento: así no se satura la base de datos.
      clearTimeout(espera);
      espera = setTimeout(() => guardar(valor), 1500);
    }

    // Al abrir el capítulo: volver a donde se quedó y guardar que está aquí.
    const recorrible =
      document.documentElement.scrollHeight - window.innerHeight;
    window.scrollTo(0, Math.max(0, recorrible) * fraccionInicial);
    guardar(porcentajeDe(fraccionInicial));

    window.addEventListener("scroll", alDesplazar, { passive: true });
    return () => {
      window.removeEventListener("scroll", alDesplazar);
      clearTimeout(espera);
      // Si quedó un avance sin guardar al salir, se guarda ahora.
      if (pendiente.current !== null) {
        void guardarAvance(libro.fuente, libro.id, indice, pendiente.current);
      }
    };
    // Este efecto debe correr una sola vez por capítulo (el componente se
    // crea de nuevo en cada capítulo gracias a su "key").
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const total = titulos.length;
  const rutaCapitulo = (n: number) => `${rutaBase}?c=${n + 1}`;
  const hayAnterior = indice > 0;
  const haySiguiente = indice < total - 1;

  const botonRedondo =
    "flex size-10 shrink-0 items-center justify-center rounded-full border border-orilla-borde text-orilla-texto transition-colors hover:border-naranja disabled:opacity-40";

  return (
    <div className="flex min-h-dvh flex-col bg-fondo text-texto">
      {/* ── Barra superior ── */}
      <header className="sticky top-0 z-10 flex flex-wrap items-center gap-x-4 gap-y-2 border-b-2 border-naranja bg-orilla px-3 py-2 sm:px-5">
        <Link
          href="/"
          aria-label="Volver a la biblioteca"
          className={`${botonRedondo} text-naranja`}
        >
          <IconoAtras />
        </Link>

        <div className="min-w-0 flex-1 basis-40">
          <p className="truncate font-serif text-lg font-semibold text-orilla-texto">
            {libro.titulo}
          </p>
          <p className="truncate text-sm text-orilla-tenue">
            {libro.autor ? `${libro.autor} · ` : ""}
            {indice + 1} de {total}
          </p>
        </div>

        <div className="flex items-center gap-2">
          <div role="radiogroup" aria-label="Luz de lectura" className="flex gap-2">
            {LUCES.map((opcion) => {
              const activa = opcion.id === luz;
              return (
                <button
                  key={opcion.id}
                  type="button"
                  role="radio"
                  aria-checked={activa}
                  aria-label={`Luz ${opcion.nombre.toLowerCase()}`}
                  onClick={() => guardarLuz(opcion.id)}
                  className={`flex h-10 items-center gap-2 rounded-full border-2 px-2.5 text-sm font-medium text-orilla-texto transition-colors md:px-4 ${
                    activa
                      ? "border-naranja"
                      : "border-orilla-borde hover:border-naranja/60"
                  }`}
                >
                  <span
                    className="size-4 rounded-full border border-neutral-400"
                    style={{ background: opcion.muestra }}
                  />
                  {/* En celular solo se ve el círculo de color */}
                  <span className="hidden md:inline">{opcion.nombre}</span>
                </button>
              );
            })}
          </div>

          <button
            type="button"
            aria-label="Letra más chica"
            disabled={tamano <= TAMANO_MIN}
            onClick={() => guardarTamano(tamano - TAMANO_PASO)}
            className={`${botonRedondo} ml-2 font-serif text-sm`}
          >
            A
          </button>
          <button
            type="button"
            aria-label="Letra más grande"
            disabled={tamano >= TAMANO_MAX}
            onClick={() => guardarTamano(tamano + TAMANO_PASO)}
            className={`${botonRedondo} font-serif text-xl`}
          >
            A
          </button>

          <span className="ml-2">
            <BotonFavorito
              fuente={libro.fuente}
              id={libro.id}
              titulo={libro.titulo}
              inicial={esFavorito}
              sobre="orilla"
            />
          </span>
        </div>
      </header>

      {/* ── Texto ── */}
      <main className="flex-1 px-5 pb-40 pt-10 md:pt-14">
        <article className="lectura mx-auto">
          <p className="mb-3 font-sans text-xs font-semibold uppercase tracking-widest text-acento">
            Parte {indice + 1} de {total}
          </p>
          <h1 className="mb-8 text-[1.5em] font-semibold leading-tight">
            {titulos[indice]}
          </h1>
          {parrafos.map((parrafo, i) => (
            // whitespace-pre-line respeta los saltos de línea de los versos
            <p key={i} className="whitespace-pre-line">
              {parrafo}
            </p>
          ))}

          <nav
            aria-label="Capítulos"
            className="mt-14 flex justify-between gap-4 border-t border-borde pt-6 font-sans text-base"
          >
            {hayAnterior ? (
              <Link href={rutaCapitulo(indice - 1)} className="text-acento underline underline-offset-4">
                ← Anterior
              </Link>
            ) : (
              <span />
            )}
            {haySiguiente ? (
              <Link href={rutaCapitulo(indice + 1)} className="text-acento underline underline-offset-4">
                Siguiente →
              </Link>
            ) : (
              <span className="text-tenue">Fin del libro</span>
            )}
          </nav>
        </article>
      </main>

      {/* ── Barra inferior ── */}
      <footer className="fixed inset-x-0 bottom-0 z-10 flex items-center gap-3 border-t-2 border-naranja bg-orilla px-3 py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] sm:gap-5 sm:px-5">
        {hayAnterior ? (
          <Link
            href={rutaCapitulo(indice - 1)}
            className="flex h-11 shrink-0 items-center rounded-xl border border-orilla-borde px-3 font-medium text-naranja transition-colors hover:border-naranja sm:px-5"
          >
            Anterior
          </Link>
        ) : (
          <span className="flex h-11 shrink-0 items-center rounded-xl border border-orilla-borde px-3 font-medium text-orilla-tenue opacity-40 sm:px-5">
            Anterior
          </span>
        )}

        <div className="min-w-0 flex-1">
          <div
            role="progressbar"
            aria-label="Avance en el libro"
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={Math.round(porcentaje)}
            className="h-2 overflow-hidden rounded-full bg-orilla-borde"
          >
            <div
              className="h-full rounded-full bg-naranja"
              style={{ width: `${porcentaje}%` }}
            />
          </div>
          <div className="mt-1.5 flex flex-col gap-x-3 gap-y-0.5 text-xs text-orilla-tenue sm:flex-row sm:items-center sm:text-sm">
            <label className="min-w-0 sm:flex-1">
              <span className="sr-only">Ir a un capítulo</span>
              <select
                value={indice}
                onChange={(e) => router.push(rutaCapitulo(Number(e.target.value)))}
                className="w-full truncate rounded-md bg-orilla py-1 text-orilla-texto"
              >
                {titulos.map((titulo, i) => (
                  <option key={i} value={i}>
                    {i + 1}. {titulo.length > 70 ? `${titulo.slice(0, 70)}…` : titulo}
                  </option>
                ))}
              </select>
            </label>
            <span className="shrink-0" aria-live="polite">
              {Math.round(porcentaje)} % ·{" "}
              {estado === "guardado"
                ? "avance guardado"
                : estado === "guardando"
                  ? "guardando…"
                  : "sin guardar"}
            </span>
          </div>
        </div>

        {haySiguiente ? (
          <Link
            href={rutaCapitulo(indice + 1)}
            className="boton-primario shrink-0 px-3 sm:px-5"
          >
            Siguiente
          </Link>
        ) : (
          <span className="boton-primario shrink-0 px-3 opacity-40 sm:px-5">
            Siguiente
          </span>
        )}
      </footer>
    </div>
  );
}
