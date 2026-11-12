"use client";

// Lista de libros guardados en el teléfono y un lector sencillo para
// leerlos sin internet. El avance se anota en el teléfono como pendiente
// y se sube a tu cuenta cuando vuelve la conexión.

import { Fragment, useEffect, useRef, useState } from "react";
import { IconoAtras } from "@/components/Iconos";
import { Ilustracion } from "@/components/Ilustracion";
import { VisorComic } from "@/components/VisorComic";
import { totalPaginas, urlArchivo, urlImagen, type PaginasComic } from "@/lib/lectura/tipos";
import { BotonEscuchar, PanelVoz, useLecturaEnVoz } from "@/components/LecturaEnVoz";
import { useTiempoLectura } from "@/lib/tiempoLectura";
import { LUCES, TAMANO_MAX, TAMANO_MIN, TAMANO_PASO } from "@/lib/luz";
import {
  guardarLuz,
  guardarTamano,
  useLuz,
  useTamanoLetra,
} from "@/lib/preferencias";
import {
  anotarAvance,
  clave,
  listarLibros,
  type LibroGuardado,
} from "@/lib/sinConexion";

const botonRedondo =
  "flex size-10 shrink-0 items-center justify-center rounded-full border border-orilla-borde text-orilla-texto transition-colors hover:border-naranja disabled:opacity-40";

// A dónde quería ir la persona antes de quedarse sin internet.
function rutaDeseada(): string {
  const desde = new URLSearchParams(location.search).get("desde");
  return desde && desde.startsWith("/") && !desde.startsWith("//") ? desde : "/";
}

function useEnLinea(): boolean {
  const [enLinea, setEnLinea] = useState(true);
  useEffect(() => {
    const actualizar = () => setEnLinea(navigator.onLine);
    const espera = setTimeout(actualizar, 0);
    window.addEventListener("online", actualizar);
    window.addEventListener("offline", actualizar);
    return () => {
      clearTimeout(espera);
      window.removeEventListener("online", actualizar);
      window.removeEventListener("offline", actualizar);
    };
  }, []);
  return enLinea;
}

export function PantallaSinConexion() {
  const [libros, setLibros] = useState<LibroGuardado[] | null>(null);
  const [abierto, setAbierto] = useState<LibroGuardado | null>(null);
  const enLinea = useEnLinea();

  useEffect(() => {
    listarLibros()
      .then((lista) => {
        setLibros(lista);
        // Si venía de un libro guardado, se abre directo.
        const m = rutaDeseada().match(/^\/leer\/([^/]+)\/([^/?]+)/);
        if (m) {
          const k = clave(decodeURIComponent(m[1]), decodeURIComponent(m[2]));
          const libro = lista.find((l) => l.clave === k);
          if (libro) setAbierto(libro);
        }
      })
      .catch(() => setLibros([]));
  }, []);

  if (abierto) {
    const alSalir = () => {
      setAbierto(null);
      listarLibros().then(setLibros).catch(() => {});
    };
    return abierto.comic ? (
      <ComicLocal libro={abierto} paginas={abierto.comic} alSalir={alSalir} />
    ) : (
      <LectorLocal libro={abierto} alSalir={alSalir} />
    );
  }

  return (
    <div className="flex min-h-dvh flex-col bg-orilla">
      <header className="flex h-14 items-center gap-3 border-b-2 border-naranja px-4 sm:px-6">
        <span className="font-serif text-2xl font-bold text-naranja">Lumbre</span>
        <span className="rounded-full border border-orilla-borde px-3 py-0.5 text-sm text-orilla-tenue">
          {enLinea ? "Conexión recuperada" : "Sin conexión"}
        </span>
      </header>

      <main className="flex-1 bg-fondo px-5 py-8 text-texto">
        <div className="mx-auto w-full max-w-2xl">
          <div className="mb-8 rounded-2xl border border-borde bg-superficie p-5">
            <p className="mb-4">
              {enLinea
                ? "Ya hay internet de nuevo."
                : "No hay internet, pero puedes leer los libros que guardaste en este teléfono."}
            </p>
            <button
              type="button"
              onClick={() => location.assign(rutaDeseada())}
              className="boton-primario px-5"
            >
              {enLinea ? "Volver a Lumbre" : "Intentar con internet"}
            </button>
          </div>

          <h1 className="mb-1 font-serif text-2xl font-semibold">
            Guardados en este teléfono
          </h1>
          <p className="mb-6 text-tenue">
            Se guardan solos los últimos 10 libros que abres con internet.
          </p>

          {libros === null ? (
            <p className="text-tenue">Buscando libros guardados…</p>
          ) : libros.length === 0 ? (
            <p className="text-tenue">
              Aún no hay libros guardados. Abre un libro cuando tengas
              internet y quedará listo para leer sin conexión.
            </p>
          ) : (
            <ul className="flex flex-col gap-3">
              {libros.map((libro) => (
                <li key={libro.clave}>
                  <button
                    type="button"
                    onClick={() => setAbierto(libro)}
                    className="flex w-full items-center gap-4 rounded-2xl border border-borde bg-superficie p-4 text-left transition-colors hover:border-naranja"
                  >
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-serif text-lg font-semibold">
                        {libro.titulo}
                      </p>
                      {libro.autor && (
                        <p className="truncate text-sm text-tenue">{libro.autor}</p>
                      )}
                      <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-borde">
                        <div
                          className="h-full rounded-full bg-naranja"
                          style={{ width: `${libro.porcentaje}%` }}
                        />
                      </div>
                    </div>
                    <span className="shrink-0 text-sm text-tenue">
                      {Math.round(libro.porcentaje)} %
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </main>
    </div>
  );
}

// ── Cómic sin conexión ──
// Las páginas (o el PDF) salen del almacén del teléfono a través de
// public/sw.js; si no se alcanzaron a guardar, el visor avisa en esa página.

function ComicLocal({
  libro,
  paginas,
  alSalir,
}: {
  libro: LibroGuardado;
  paginas: PaginasComic;
  alSalir: () => void;
}) {
  const total = totalPaginas(paginas);
  useTiempoLectura({ dueno: libro.dueno, fuente: libro.fuente, id: libro.id, escuchando: false });
  return (
    <VisorComic
      clave={libro.clave}
      titulo={libro.titulo}
      paginas={paginas}
      urlPagina={(ruta) => urlImagen(libro.fuente, libro.id, ruta)}
      urlPdf={urlArchivo(libro.fuente, libro.id)}
      inicial={libro.capitulo}
      nota="Sin conexión"
      alCambiar={(pagina) => {
        const porcentaje = total > 1 ? (pagina / (total - 1)) * 100 : 100;
        void anotarAvance(libro.fuente, libro.id, pagina, porcentaje, true).catch(() => {});
      }}
      volver={
        <button
          type="button"
          onClick={alSalir}
          aria-label="Volver a los libros guardados"
          className="flex size-11 shrink-0 items-center justify-center rounded-full border border-orilla-borde text-naranja"
        >
          <IconoAtras />
        </button>
      }
    />
  );
}

// ── Lector sin conexión ──

const largo = (parrafos: string[]) => parrafos.reduce((s, p) => s + p.length, 0);

function LectorLocal({
  libro,
  alSalir,
}: {
  libro: LibroGuardado;
  alSalir: () => void;
}) {
  const largos = libro.capitulos.map(largo);
  const total = largos.reduce((s, l) => s + l, 0);
  const antesDe = (n: number) => largos.slice(0, n).reduce((s, l) => s + l, 0);
  const ultimo = libro.capitulos.length - 1;

  // Dónde se quedó: capítulo guardado y, del porcentaje, el punto dentro.
  const [posicion, setPosicion] = useState(() => {
    const indice = Math.min(ultimo, Math.max(0, libro.capitulo));
    const dentro = (libro.porcentaje / 100) * total - antesDe(indice);
    const fraccion =
      largos[indice] > 0 ? Math.min(1, Math.max(0, dentro / largos[indice])) : 0;
    return { indice, fraccion };
  });

  return (
    <CapituloLocal
      key={posicion.indice}
      libro={libro}
      indice={posicion.indice}
      fraccionInicial={posicion.fraccion}
      letrasAntes={antesDe(posicion.indice)}
      letrasCapitulo={largos[posicion.indice]}
      letrasTotal={total}
      irA={(indice) => setPosicion({ indice, fraccion: 0 })}
      alSalir={alSalir}
    />
  );
}

function fraccionRecorrida(): number {
  const recorrible = document.documentElement.scrollHeight - window.innerHeight;
  if (recorrible <= 0) return 1;
  return Math.min(1, Math.max(0, window.scrollY / recorrible));
}

function CapituloLocal({
  libro,
  indice,
  fraccionInicial,
  letrasAntes,
  letrasCapitulo,
  letrasTotal,
  irA,
  alSalir,
}: {
  libro: LibroGuardado;
  indice: number;
  fraccionInicial: number;
  letrasAntes: number;
  letrasCapitulo: number;
  letrasTotal: number;
  irA: (indice: number) => void;
  alSalir: () => void;
}) {
  const luz = useLuz();
  const tamano = useTamanoLetra();
  const porcentajeDe = (fraccion: number) =>
    letrasTotal > 0 ? ((letrasAntes + fraccion * letrasCapitulo) / letrasTotal) * 100 : 0;
  const [porcentaje, setPorcentaje] = useState(() => porcentajeDe(fraccionInicial));
  const pendiente = useRef<number | null>(null);

  useEffect(() => {
    let espera: ReturnType<typeof setTimeout> | undefined;
    const anotar = (valor: number) => {
      pendiente.current = null;
      void anotarAvance(libro.fuente, libro.id, indice, valor, true).catch(() => {});
    };

    const recorrible = document.documentElement.scrollHeight - window.innerHeight;
    window.scrollTo(0, Math.max(0, recorrible) * fraccionInicial);
    anotar(porcentajeDe(fraccionInicial));

    function alDesplazar() {
      const valor = porcentajeDe(fraccionRecorrida());
      setPorcentaje(valor);
      pendiente.current = valor;
      clearTimeout(espera);
      espera = setTimeout(() => anotar(valor), 800);
    }
    window.addEventListener("scroll", alDesplazar, { passive: true });
    return () => {
      window.removeEventListener("scroll", alDesplazar);
      clearTimeout(espera);
      if (pendiente.current !== null) anotar(pendiente.current);
    };
    // Una vez por capítulo (el componente se crea de nuevo con cada uno).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const totalCapitulos = libro.titulos.length;
  // Ilustraciones de este capítulo (si no se alcanzaron a guardar, no se ven).
  const imagenes = libro.imagenes?.[indice] ?? [];
  const pies = new Set(imagenes.flatMap((imagen) => (imagen.pie !== undefined ? [imagen.pie] : [])));
  const hayAnterior = indice > 0;
  const haySiguiente = indice < totalCapitulos - 1;

  // Lectura en voz alta (las voces del teléfono funcionan sin internet).
  const voz = useLecturaEnVoz({
    parrafos: libro.capitulos[indice],
    titulo: libro.titulos[indice] ?? "",
    haySiguiente,
    irAlSiguiente: () => irA(indice + 1),
  });

  // El tiempo leído sin internet se guarda y se manda al volver la red.
  useTiempoLectura({
    dueno: libro.dueno,
    fuente: libro.fuente,
    id: libro.id,
    escuchando: voz.leyendo,
  });

  return (
    <div className="flex min-h-dvh flex-col bg-fondo text-texto">
      <header className="sticky top-0 z-10 flex flex-wrap items-center gap-x-4 gap-y-2 border-b-2 border-naranja bg-orilla px-3 py-2 sm:px-5">
        <button
          type="button"
          onClick={alSalir}
          aria-label="Volver a los libros guardados"
          className={`${botonRedondo} text-naranja`}
        >
          <IconoAtras />
        </button>
        <div className="min-w-0 flex-1 basis-40">
          <p className="truncate font-serif text-lg font-semibold text-orilla-texto">
            {libro.titulo}
          </p>
          <p className="truncate text-sm text-orilla-tenue">
            Sin conexión · {indice + 1} de {totalCapitulos}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <div role="radiogroup" aria-label="Luz de lectura" className="flex gap-2">
            {LUCES.map((opcion) => (
              <button
                key={opcion.id}
                type="button"
                role="radio"
                aria-checked={opcion.id === luz}
                aria-label={`Luz ${opcion.nombre.toLowerCase()}`}
                onClick={() => guardarLuz(opcion.id)}
                className={`flex h-10 items-center rounded-full border-2 px-2.5 ${
                  opcion.id === luz ? "border-naranja" : "border-orilla-borde"
                }`}
              >
                <span
                  className="size-4 rounded-full border border-neutral-400"
                  style={{ background: opcion.muestra }}
                />
              </button>
            ))}
          </div>
          <BotonEscuchar voz={voz} />
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
        </div>
      </header>

      <main className="flex-1 px-5 pb-40 pt-10 md:pt-14">
        <article className="lectura mx-auto">
          <p className="mb-3 font-sans text-xs font-semibold uppercase tracking-widest text-acento">
            Parte {indice + 1} de {totalCapitulos}
          </p>
          <h1 className="mb-8 text-[1.5em] font-semibold leading-tight">
            {libro.titulos[indice]}
          </h1>
          {libro.capitulos[indice].map((parrafo, i) => (
            <Fragment key={i}>
              {imagenes
                .filter((imagen) => imagen.antes === i)
                .map((imagen, j) => (
                  <Ilustracion
                    key={j}
                    imagen={imagen}
                    src={urlImagen(libro.fuente, libro.id, imagen.ruta)}
                    pie={imagen.pie !== undefined ? libro.capitulos[indice][imagen.pie] : undefined}
                  />
                ))}
              <p
                data-parrafo={i}
                className={
                  pies.has(i)
                    ? "mx-auto mb-10 max-w-[90%] text-center text-[0.85em] italic leading-snug text-tenue"
                    : undefined
                }
              >
                {parrafo}
              </p>
            </Fragment>
          ))}
          {imagenes
            .filter((imagen) => imagen.antes >= libro.capitulos[indice].length)
            .map((imagen, j) => (
              <Ilustracion
                key={`fin-${j}`}
                imagen={imagen}
                src={urlImagen(libro.fuente, libro.id, imagen.ruta)}
              />
            ))}
          <p className="mt-10 font-sans text-sm text-tenue">
            Tus subrayados y notas se ven cuando vuelvas a tener internet.
          </p>
        </article>
      </main>

      <footer className="fixed inset-x-0 bottom-0 z-10 flex items-center gap-3 border-t-2 border-naranja bg-orilla px-3 py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] sm:gap-5 sm:px-5">
        <button
          type="button"
          disabled={!hayAnterior}
          onClick={() => irA(indice - 1)}
          className="flex h-11 shrink-0 items-center rounded-xl border border-orilla-borde px-3 font-medium text-naranja disabled:opacity-40 sm:px-5"
        >
          Anterior
        </button>
        <div className="min-w-0 flex-1">
          <div
            role="progressbar"
            aria-label="Avance en el libro"
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={Math.round(porcentaje)}
            className="h-2 overflow-hidden rounded-full bg-orilla-borde"
          >
            <div className="h-full rounded-full bg-naranja" style={{ width: `${porcentaje}%` }} />
          </div>
          <div className="mt-1.5 flex flex-col gap-x-3 gap-y-0.5 text-xs text-orilla-tenue sm:flex-row sm:items-center sm:text-sm">
            <label className="min-w-0 sm:flex-1">
              <span className="sr-only">Ir a un capítulo</span>
              <select
                value={indice}
                onChange={(e) => irA(Number(e.target.value))}
                className="w-full truncate rounded-md bg-orilla py-1 text-orilla-texto"
              >
                {libro.titulos.map((titulo, i) => (
                  <option key={i} value={i}>
                    {i + 1}. {titulo.length > 70 ? `${titulo.slice(0, 70)}…` : titulo}
                  </option>
                ))}
              </select>
            </label>
            <span className="shrink-0">
              {Math.round(porcentaje)} % · guardado en el teléfono
            </span>
          </div>
        </div>
        <button
          type="button"
          disabled={!haySiguiente}
          onClick={() => irA(indice + 1)}
          className="boton-primario shrink-0 px-3 disabled:opacity-40 sm:px-5"
        >
          Siguiente
        </button>
      </footer>

      <PanelVoz voz={voz} />
    </div>
  );
}
