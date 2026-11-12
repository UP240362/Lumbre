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
import { BotonEscuchar, PanelVoz, useLecturaEnVoz } from "@/components/LecturaEnVoz";
import { IconoAtras, IconoNota } from "@/components/Iconos";
import { LUCES, TAMANO_MAX, TAMANO_MIN, TAMANO_PASO } from "@/lib/luz";
import {
  guardarLuz,
  guardarTamano,
  useLuz,
  useTamanoLetra,
} from "@/lib/preferencias";
import { anotarAvance, guardarEnTelefono } from "@/lib/sinConexion";
import { useTiempoLectura } from "@/lib/tiempoLectura";
import type { Subrayado } from "@/lib/subrayados";
import { guardarAvance } from "../../acciones";
import { AvisoResenas, PanelResenas, useResenas } from "./Resenas";
import type { DatosResenas } from "@/lib/resenas";
import {
  BarraSeleccion,
  EditorSubrayado,
  PanelNotas,
  ParrafosAnotados,
  useAnotaciones,
} from "./Anotaciones";

type Props = {
  usuarioId: string; // para guardar el libro en el teléfono a nombre de quien lee
  libro: { id: string; fuente: string; titulo: string; autor: string; idioma?: string };
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
  subrayados: Subrayado[]; // de todo el libro
  subrayadoInicial: string | null; // al abrir, llevar la vista a este
  resenas: DatosResenas | null; // null en libros que no se reseñan (los propios)
};

// Qué tanto de la página se ha recorrido: 0 arriba, 1 hasta abajo.
function fraccionRecorrida(): number {
  const recorrible = document.documentElement.scrollHeight - window.innerHeight;
  if (recorrible <= 0) return 1; // el capítulo cabe completo en la pantalla
  return Math.min(1, Math.max(0, window.scrollY / recorrible));
}

export function VistaLector({
  usuarioId,
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
  subrayados,
  subrayadoInicial,
  resenas: resenasIniciales,
}: Props) {
  const router = useRouter();
  const luz = useLuz();
  const tamano = useTamanoLetra();
  const notas = useAnotaciones({
    libro,
    capitulo: indice,
    parrafos,
    iniciales: subrayados,
  });

  const total = titulos.length;
  const rutaCapitulo = (n: number) => `${rutaBase}?c=${n + 1}`;
  const hayAnterior = indice > 0;
  const haySiguiente = indice < total - 1;

  const resenas = useResenas(
    libro,
    resenasIniciales ?? { promedio: 0, cantidad: 0, mia: null, otras: [] },
  );

  // Lectura en voz alta: al terminar el capítulo pasa solo al siguiente.
  const voz = useLecturaEnVoz({
    parrafos,
    titulo: titulos[indice] ?? "",
    idioma: libro.idioma,
    haySiguiente,
    irAlSiguiente: () => router.push(rutaCapitulo(indice + 1)),
  });

  // Cuenta el tiempo de lectura (solo mientras de verdad se lee o escucha).
  useTiempoLectura({
    dueno: usuarioId,
    fuente: libro.fuente,
    id: libro.id,
    escuchando: voz.leyendo,
  });

  const porcentajeDe = (fraccion: number) =>
    letrasTotal > 0
      ? ((letrasAntes + fraccion * letrasCapitulo) / letrasTotal) * 100
      : 0;

  const [porcentaje, setPorcentaje] = useState(() =>
    porcentajeDe(fraccionInicial),
  );
  const [estado, setEstado] = useState<
    "guardando" | "guardado" | "en-telefono" | "error"
  >("guardando");
  // Último porcentaje calculado, para guardarlo al salir de la página.
  const pendiente = useRef<number | null>(null);

  useEffect(() => {
    let espera: ReturnType<typeof setTimeout> | undefined;

    // Guarda el avance en la cuenta. Si se fue el internet, lo anota en el
    // teléfono como pendiente; se sube solo cuando vuelva la conexión.
    async function guardar(valor: number) {
      pendiente.current = null;
      setEstado("guardando");
      const enviado = await guardarAvance(libro.fuente, libro.id, indice, valor)
        .then(({ ok }) => (ok ? "ok" : "error"))
        .catch(() => "sin-red" as const);
      await anotarAvance(libro.fuente, libro.id, indice, valor, enviado === "sin-red")
        .catch(() => {});
      setEstado(
        enviado === "ok" ? "guardado" : enviado === "sin-red" ? "en-telefono" : "error",
      );
    }

    // Guarda el libro completo en el teléfono para leerlo sin internet.
    void guardarEnTelefono({
      dueno: usuarioId,
      fuente: libro.fuente,
      id: libro.id,
      capitulo: indice,
      porcentaje: porcentajeDe(fraccionInicial),
    }).catch(() => {});

    function alDesplazar() {
      const valor = porcentajeDe(fraccionRecorrida());
      setPorcentaje(valor);
      pendiente.current = valor;
      // Se guarda cuando la persona lleva 1.5 s sin moverse, no en cada
      // movimiento: así no se satura la base de datos.
      clearTimeout(espera);
      espera = setTimeout(() => guardar(valor), 1500);
    }

    // Al abrir el capítulo: ir al subrayado pedido (desde el panel de
    // notas) o volver a donde se quedó; y guardar que está aquí.
    const marca = subrayadoInicial
      ? document.querySelector(`[data-subrayado="${subrayadoInicial}"]`)
      : null;
    if (marca) {
      marca.scrollIntoView({ block: "center" });
      guardar(porcentajeDe(fraccionRecorrida()));
    } else {
      const recorrible =
        document.documentElement.scrollHeight - window.innerHeight;
      window.scrollTo(0, Math.max(0, recorrible) * fraccionInicial);
      guardar(porcentajeDe(fraccionInicial));
    }

    window.addEventListener("scroll", alDesplazar, { passive: true });
    return () => {
      window.removeEventListener("scroll", alDesplazar);
      clearTimeout(espera);
      // Si quedó un avance sin guardar al salir, se guarda ahora.
      if (pendiente.current !== null) {
        const valor = pendiente.current;
        void guardarAvance(libro.fuente, libro.id, indice, valor).catch(() =>
          anotarAvance(libro.fuente, libro.id, indice, valor, true),
        );
      }
    };
    // Este efecto debe correr una sola vez por capítulo (el componente se
    // crea de nuevo en cada capítulo gracias a su "key").
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const botonRedondo =
    "flex size-9 shrink-0 items-center justify-center rounded-full border border-orilla-borde text-orilla-texto transition-colors hover:border-naranja disabled:opacity-40 sm:size-10";

  return (
    // "relative" sirve para colocar la barrita de subrayar junto al texto.
    <div className="relative flex min-h-dvh flex-col bg-fondo text-texto">
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

        <div className="flex flex-wrap items-center gap-1.5 sm:gap-2">
          <div role="radiogroup" aria-label="Luz de lectura" className="flex gap-1.5 sm:gap-2">
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
                  className={`flex h-9 items-center gap-2 rounded-full border-2 px-2 text-sm sm:h-10 sm:px-2.5 font-medium text-orilla-texto transition-colors md:px-4 ${
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
            className={`${botonRedondo} ml-1 font-serif text-sm sm:ml-2`}
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

          <BotonEscuchar voz={voz} />

          <span className="ml-1 sm:ml-2">
            <BotonFavorito
              fuente={libro.fuente}
              id={libro.id}
              titulo={libro.titulo}
              inicial={esFavorito}
              sobre="orilla"
            />
          </span>

          <button
            type="button"
            onClick={() => notas.setPanelAbierto(true)}
            aria-label={`Notas y subrayados (${notas.subrayados.length})`}
            className={`${botonRedondo} relative text-naranja`}
          >
            <IconoNota />
            {notas.subrayados.length > 0 && (
              <span className="absolute -right-1.5 -top-1.5 flex h-5 min-w-5 items-center justify-center rounded-full bg-naranja px-1 text-[11px] font-bold text-negro">
                {notas.subrayados.length}
              </span>
            )}
          </button>
        </div>
      </header>

      {/* ── Texto ── */}
      <main className="flex-1 px-5 pb-40 pt-10 md:pt-14">
        {/* data-texto-libro marca dónde se puede subrayar (Anotaciones.tsx) */}
        <article data-texto-libro="" className="lectura mx-auto">
          <p className="mb-3 font-sans text-xs font-semibold uppercase tracking-widest text-acento">
            Parte {indice + 1} de {total}
          </p>
          <h1 className="mb-8 text-[1.5em] font-semibold leading-tight">
            {titulos[indice]}
          </h1>
          <ParrafosAnotados parrafos={parrafos} notas={notas} />

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

          {resenasIniciales && (
            <AvisoResenas resenas={resenas} titulo={libro.titulo} esUltimo={!haySiguiente} />
          )}
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
                  : estado === "en-telefono"
                    ? "sin internet: guardado en el teléfono"
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

      {/* ── Calificaciones y reseñas ── */}
      <PanelResenas resenas={resenas} titulo={libro.titulo} />

      {/* ── Lectura en voz alta ── */}
      <PanelVoz voz={voz} idioma={libro.idioma} />

      {/* ── Subrayados y notas ── */}
      <BarraSeleccion notas={notas} />
      <EditorSubrayado notas={notas} />
      <PanelNotas
        notas={notas}
        titulos={titulos}
        indice={indice}
        rutaBase={rutaBase}
      />
    </div>
  );
}
