"use client";

// SUBRAYADOS Y NOTAS dentro del lector.
// - Al seleccionar texto aparece una barrita para subrayarlo (en tres
//   colores) o para agregarle una nota.
// - Al tocar un subrayado se abre un editor: cambiar color, escribir o
//   corregir la nota, o eliminarlo.
// - El botón de notas de la barra superior abre un panel con todos los
//   subrayados y notas del libro.
// Todo se guarda en la tabla "subrayados" de Supabase.
//
// ¿Cómo se recuerda QUÉ texto se subrayó? Cada párrafo del capítulo lleva
// su número (atributo data-parrafo) y se guarda en qué párrafo y en qué
// letra empieza y termina la selección.

import Link from "next/link";
import { useEffect, useMemo, useState, useTransition } from "react";
import { CompartirCita } from "@/components/CompartirCita";
import { IconoBasura, IconoCerrar, IconoCompartir, IconoNota } from "@/components/Iconos";
import {
  COLORES,
  MAX_NOTA,
  MAX_TEXTO,
  extraerTexto,
  segmentar,
  ubicar,
  type Color,
  type Posicion,
  type Subrayado,
} from "@/lib/subrayados";
import {
  actualizarSubrayado,
  crearSubrayado,
  eliminarSubrayado,
} from "../../acciones-subrayados";

const LISTA_COLORES = Object.keys(COLORES) as Color[];
const ANCHO_BARRA = 232;
const ALTO_BARRA = 54;

type Seleccion = {
  inicio: Posicion;
  fin: Posicion;
  texto: string;
  x: number; // posición de la barrita en la página
  y: number;
};

// Convierte un punto del navegador (nodo + desplazamiento) en
// párrafo + letra. Devuelve null si el punto no está en un párrafo.
function posicionEn(nodo: Node, desplazamiento: number): Posicion | null {
  const elemento = nodo instanceof Element ? nodo : nodo.parentElement;
  const parrafo = elemento?.closest<HTMLElement>("[data-parrafo]");
  if (!parrafo) return null;
  // Se mide cuánto texto hay desde el inicio del párrafo hasta ese punto.
  const rango = document.createRange();
  rango.setStart(parrafo, 0);
  rango.setEnd(nodo, desplazamiento);
  return { parrafo: Number(parrafo.dataset.parrafo), offset: rango.toString().length };
}

// ── El "cerebro": guarda los subrayados y lo que se está haciendo ─────

export function useAnotaciones({
  libro,
  capitulo,
  parrafos,
  iniciales,
}: {
  libro: { fuente: string; id: string };
  capitulo: number;
  parrafos: string[];
  iniciales: Subrayado[];
}) {
  const [subrayados, setSubrayados] = useState(iniciales);
  const [seleccion, setSeleccion] = useState<Seleccion | null>(null);
  const [editandoId, setEditandoId] = useState<string | null>(null);
  const [panelAbierto, setPanelAbierto] = useState(false);
  const [aviso, setAviso] = useState<string | null>(null);
  const [guardando, iniciar] = useTransition();

  // Subrayados de ESTE capítulo, ya ubicados sobre su texto.
  const ubicados = useMemo(
    () =>
      subrayados
        .filter((s) => s.capitulo === capitulo)
        .flatMap((s) => {
          const lugar = ubicar(s, parrafos);
          return lugar ? [{ subrayado: s, ...lugar }] : [];
        }),
    [subrayados, capitulo, parrafos],
  );

  useEffect(() => {
    let espera: ReturnType<typeof setTimeout> | undefined;

    // Lee lo que la persona seleccionó y, si es texto del libro, muestra
    // la barrita debajo (o encima, si abajo no cabe).
    function leerSeleccion() {
      const seleccionActual = window.getSelection();
      // El texto del libro está marcado con data-texto-libro (VistaLector).
      const raiz = document.querySelector<HTMLElement>("[data-texto-libro]");
      if (!seleccionActual || seleccionActual.isCollapsed || !raiz) return;
      if (seleccionActual.rangeCount === 0) return;
      const rango = seleccionActual.getRangeAt(0);
      if (!raiz.contains(rango.commonAncestorContainer)) return;

      const lista = raiz.querySelectorAll<HTMLElement>("[data-parrafo]");
      if (lista.length === 0) return;
      const ultimoIndice = lista.length - 1;

      // Si empieza en el título o termina después del último párrafo, se
      // recorta al texto del capítulo.
      const inicio =
        posicionEn(rango.startContainer, rango.startOffset) ??
        (rango.intersectsNode(lista[0]) ? { parrafo: 0, offset: 0 } : null);
      let fin =
        posicionEn(rango.endContainer, rango.endOffset) ??
        (rango.intersectsNode(lista[ultimoIndice])
          ? { parrafo: ultimoIndice, offset: parrafos[ultimoIndice]?.length ?? 0 }
          : null);
      if (!inicio || !fin) return;

      // Si termina justo al inicio de un párrafo (pasa con el triple clic),
      // se cuenta hasta el final del párrafo anterior.
      if (fin.offset === 0 && fin.parrafo > inicio.parrafo) {
        fin = { parrafo: fin.parrafo - 1, offset: parrafos[fin.parrafo - 1]?.length ?? 0 };
      }
      const enOrden =
        inicio.parrafo < fin.parrafo ||
        (inicio.parrafo === fin.parrafo && inicio.offset < fin.offset);
      if (!enOrden) return;

      const texto = extraerTexto(parrafos, inicio, fin);
      if (!texto.trim()) return;
      if (texto.length > MAX_TEXTO) {
        setAviso("La selección es demasiado larga para subrayarla.");
        return;
      }

      const caja = rango.getBoundingClientRect();
      const centro = caja.left + caja.width / 2;
      const x =
        Math.min(
          Math.max(8, centro - ANCHO_BARRA / 2),
          window.innerWidth - ANCHO_BARRA - 8,
        ) + window.scrollX;
      // Abajo de la selección, salvo que choque con la barra inferior.
      const cabeAbajo = caja.bottom + 10 + ALTO_BARRA < window.innerHeight - 100;
      const y = (cabeAbajo ? caja.bottom + 10 : caja.top - 10 - ALTO_BARRA) + window.scrollY;

      setAviso(null);
      setSeleccion({ inicio, fin, texto, x, y });
    }

    function alCambiarSeleccion() {
      clearTimeout(espera);
      espera = setTimeout(leerSeleccion, 200);
    }

    // Tocar fuera de la barrita la esconde (si se está seleccionando otro
    // texto, volverá a aparecer en cuanto termine la selección).
    function alTocar(evento: PointerEvent) {
      const tocado = evento.target;
      if (tocado instanceof Element && tocado.closest("[data-barra-subrayado]")) return;
      setSeleccion(null);
    }

    function alTeclear(evento: KeyboardEvent) {
      if (evento.key !== "Escape") return;
      setSeleccion(null);
      setEditandoId(null);
      setPanelAbierto(false);
    }

    document.addEventListener("selectionchange", alCambiarSeleccion);
    document.addEventListener("pointerdown", alTocar);
    document.addEventListener("keydown", alTeclear);
    return () => {
      clearTimeout(espera);
      document.removeEventListener("selectionchange", alCambiarSeleccion);
      document.removeEventListener("pointerdown", alTocar);
      document.removeEventListener("keydown", alTeclear);
    };
  }, [parrafos]);

  // Subraya lo seleccionado. Con abrirNota, abre el editor al terminar.
  function subrayar(color: Color, abrirNota = false) {
    const elegido = seleccion;
    if (!elegido) return;
    iniciar(async () => {
      const nuevo = await crearSubrayado({
        fuente: libro.fuente,
        bookId: libro.id,
        capitulo,
        inicioParrafo: elegido.inicio.parrafo,
        inicioOffset: elegido.inicio.offset,
        finParrafo: elegido.fin.parrafo,
        finOffset: elegido.fin.offset,
        texto: elegido.texto,
        color,
      });
      if (!nuevo) {
        setAviso("No se pudo guardar el subrayado. Intenta de nuevo.");
        return;
      }
      setSubrayados((previos) => [...previos, nuevo]);
      setSeleccion(null);
      window.getSelection()?.removeAllRanges();
      if (abrirNota) setEditandoId(nuevo.id);
    });
  }

  function cambiar(id: string, cambios: { color?: Color; nota?: string }) {
    iniciar(async () => {
      const actualizado = await actualizarSubrayado(id, cambios);
      if (!actualizado) {
        setAviso("No se pudo guardar el cambio. Intenta de nuevo.");
        return;
      }
      setSubrayados((previos) => previos.map((s) => (s.id === id ? actualizado : s)));
      // Al guardar la nota se cierra el editor; al cambiar color, no.
      if (cambios.nota !== undefined) setEditandoId(null);
    });
  }

  function borrar(id: string) {
    iniciar(async () => {
      const { ok } = await eliminarSubrayado(id);
      if (!ok) {
        setAviso("No se pudo eliminar. Intenta de nuevo.");
        return;
      }
      setSubrayados((previos) => previos.filter((s) => s.id !== id));
      setEditandoId(null);
    });
  }

  // Elimina un subrayado (y su nota) después de preguntar.
  function eliminarConConfirmacion(subrayado: Subrayado) {
    const seguro = window.confirm(
      subrayado.nota
        ? "¿Eliminar este subrayado y su nota? No se puede deshacer."
        : "¿Eliminar este subrayado?",
    );
    if (seguro) borrar(subrayado.id);
  }

  // Lleva la vista a un subrayado de este capítulo.
  function irA(id: string) {
    setPanelAbierto(false);
    document
      .querySelector(`[data-subrayado="${id}"]`)
      ?.scrollIntoView({ behavior: "smooth", block: "center" });
  }

  return {
    subrayados,
    ubicados,
    seleccion,
    editando: subrayados.find((s) => s.id === editandoId) ?? null,
    setEditandoId,
    panelAbierto,
    setPanelAbierto,
    aviso,
    setAviso,
    guardando,
    subrayar,
    cambiar,
    borrar,
    eliminarConConfirmacion,
    irA,
  };
}

export type Anotaciones = ReturnType<typeof useAnotaciones>;

// ── El texto del capítulo, con los subrayados pintados ────────────────

export function ParrafosAnotados({
  parrafos,
  notas,
}: {
  parrafos: string[];
  notas: Anotaciones;
}) {
  return parrafos.map((parrafo, i) => (
    // whitespace-pre-line respeta los saltos de línea de los versos
    <p key={i} data-parrafo={i} className="whitespace-pre-line">
      {segmentar(parrafo, i, notas.ubicados).map((segmento, j) => {
        const s = segmento.subrayado;
        if (!s) return segmento.texto;
        return (
          <mark
            key={j}
            data-subrayado={s.id}
            title={s.nota ?? undefined}
            onClick={() => {
              // Si se estaba seleccionando texto, no se abre el editor.
              if (window.getSelection()?.isCollapsed === false) return;
              notas.setEditandoId(s.id);
            }}
            style={{ backgroundColor: COLORES[s.color].fondo }}
            className={`cursor-pointer rounded-[3px] text-inherit ${
              // Los subrayados con nota llevan una línea punteada abajo.
              s.nota ? "underline decoration-dotted decoration-2 underline-offset-4" : ""
            }`}
          >
            {segmento.texto}
          </mark>
        );
      })}
    </p>
  ));
}

// ── Barrita que aparece al seleccionar texto ─────────────────────────

export function BarraSeleccion({ notas }: { notas: Anotaciones }) {
  const elegido = notas.seleccion;

  return (
    <>
      {elegido && (
        <div
          data-barra-subrayado=""
          role="toolbar"
          aria-label="Subrayar la selección"
          // Evita que tocar la barrita borre la selección de texto.
          onMouseDown={(e) => e.preventDefault()}
          style={{ left: elegido.x, top: elegido.y, width: ANCHO_BARRA }}
          className="absolute z-20 flex items-center gap-2 rounded-2xl border-2 border-naranja bg-orilla p-2 shadow-lg"
        >
          {LISTA_COLORES.map((color) => (
            <button
              key={color}
              type="button"
              disabled={notas.guardando}
              onClick={() => notas.subrayar(color)}
              aria-label={`Subrayar en ${COLORES[color].nombre.toLowerCase()}`}
              style={{ backgroundColor: COLORES[color].muestra }}
              className="size-9 shrink-0 rounded-full border-2 border-orilla-borde transition-colors hover:border-orilla-texto disabled:opacity-50"
            />
          ))}
          <button
            type="button"
            disabled={notas.guardando}
            onClick={() => notas.subrayar("amarillo", true)}
            className="ml-auto flex h-9 items-center gap-1.5 rounded-xl bg-naranja px-3 text-sm font-semibold text-negro disabled:opacity-50"
          >
            <IconoNota className="size-4" />
            {notas.guardando ? "…" : "Nota"}
          </button>
        </div>
      )}

      {notas.aviso && (
        <div
          role="alert"
          className="fixed inset-x-3 bottom-28 z-30 mx-auto flex max-w-md items-center gap-3 rounded-xl border-2 border-naranja bg-orilla px-4 py-3 text-sm text-orilla-texto shadow-lg"
        >
          <span className="flex-1">{notas.aviso}</span>
          <button
            type="button"
            onClick={() => notas.setAviso(null)}
            aria-label="Cerrar aviso"
            className="text-orilla-tenue hover:text-orilla-texto"
          >
            <IconoCerrar className="size-4" />
          </button>
        </div>
      )}
    </>
  );
}

// ── Editor de un subrayado (color, nota, eliminar) ────────────────────

export function EditorSubrayado({ notas }: { notas: Anotaciones }) {
  const subrayado = notas.editando;
  if (!subrayado) return null;
  // "key" hace que el editor empiece de cero con cada subrayado.
  return <Editor key={subrayado.id} subrayado={subrayado} notas={notas} />;
}

function Editor({ subrayado, notas }: { subrayado: Subrayado; notas: Anotaciones }) {
  const [nota, setNota] = useState(subrayado.nota ?? "");
  const cambio = nota.trim() !== (subrayado.nota ?? "");

  // Quita solo la nota; el subrayado se queda.
  function borrarNota() {
    if (!window.confirm("¿Borrar esta nota? El subrayado se queda.")) return;
    setNota("");
    notas.cambiar(subrayado.id, { nota: "" });
  }

  return (
    <div className="fixed inset-x-0 bottom-0 z-30 px-3 pb-3">
      <div
        role="dialog"
        aria-label="Subrayado y nota"
        className="mx-auto max-w-xl rounded-2xl border-2 border-naranja bg-orilla p-5 text-orilla-texto shadow-2xl"
      >
        <div className="flex items-start gap-3">
          <blockquote
            className="line-clamp-3 flex-1 whitespace-pre-line border-l-4 pl-3 font-serif italic"
            style={{ borderColor: COLORES[subrayado.color].muestra }}
          >
            {subrayado.texto}
          </blockquote>
          <button
            type="button"
            onClick={() => notas.setEditandoId(null)}
            aria-label="Cerrar"
            className="flex size-9 shrink-0 items-center justify-center rounded-full border border-orilla-borde text-orilla-tenue hover:border-naranja hover:text-orilla-texto"
          >
            <IconoCerrar className="size-4" />
          </button>
        </div>

        <div className="mt-4 flex items-center gap-2" role="radiogroup" aria-label="Color">
          <span className="mr-1 text-sm text-orilla-tenue">Color</span>
          {LISTA_COLORES.map((color) => (
            <button
              key={color}
              type="button"
              role="radio"
              aria-checked={subrayado.color === color}
              aria-label={COLORES[color].nombre}
              disabled={notas.guardando}
              onClick={() => notas.cambiar(subrayado.id, { color })}
              style={{ backgroundColor: COLORES[color].muestra }}
              className={`size-8 rounded-full border-2 transition-colors ${
                subrayado.color === color ? "border-orilla-texto" : "border-orilla-borde"
              }`}
            />
          ))}
        </div>

        <label className="mt-4 flex flex-col gap-2 text-sm text-orilla-tenue">
          Nota
          <textarea
            value={nota}
            onChange={(e) => setNota(e.target.value)}
            maxLength={MAX_NOTA}
            rows={4}
            placeholder="Escribe lo que pensaste al leer esto…"
            className="resize-y rounded-xl border border-orilla-borde bg-negro p-3 text-base text-orilla-texto placeholder:text-orilla-tenue/60"
          />
        </label>

        <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap gap-x-5">
            {/* Solo aparece si el subrayado ya tiene una nota guardada */}
            {subrayado.nota && (
              <button
                type="button"
                onClick={borrarNota}
                disabled={notas.guardando}
                className="min-h-11 text-sm text-orilla-tenue underline underline-offset-4 hover:text-naranja"
              >
                Borrar nota
              </button>
            )}
            <button
              type="button"
              onClick={() => notas.eliminarConConfirmacion(subrayado)}
              disabled={notas.guardando}
              className="min-h-11 text-sm text-orilla-tenue underline underline-offset-4 hover:text-naranja"
            >
              Eliminar subrayado
            </button>
          </div>
          <button
            type="button"
            onClick={() => notas.cambiar(subrayado.id, { nota })}
            disabled={notas.guardando || !cambio}
            className="boton-primario px-6 disabled:opacity-50"
          >
            {notas.guardando ? "Guardando…" : "Guardar nota"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Panel con todos los subrayados y notas del libro ──────────────────

export function PanelNotas({
  notas,
  titulos,
  indice,
  rutaBase,
  libro,
}: {
  notas: Anotaciones;
  titulos: string[];
  indice: number;
  rutaBase: string;
  libro: { titulo: string; autor: string }; // para la tarjeta al compartir
}) {
  // El subrayado que se está compartiendo (abre la pantalla de compartir).
  const [compartiendo, setCompartiendo] = useState<{
    texto: string;
    titulo: string;
    autor: string;
  } | null>(null);

  if (!notas.panelAbierto) return null;

  const ordenados = [...notas.subrayados].sort(
    (a, b) =>
      a.capitulo - b.capitulo ||
      a.inicio_parrafo - b.inicio_parrafo ||
      a.inicio_offset - b.inicio_offset,
  );
  // La parte de arriba de cada tarjeta lleva al subrayado en el libro.
  const claseTarjeta =
    "block w-full rounded-t-xl p-4 pb-3 text-left transition-colors hover:bg-orilla-superficie";

  return (
    // Fondo oscuro: tocarlo cierra el panel.
    <div
      className="fixed inset-0 z-30 flex justify-end bg-black/50"
      onClick={() => notas.setPanelAbierto(false)}
    >
      <aside
        role="dialog"
        aria-label="Notas y subrayados"
        onClick={(e) => e.stopPropagation()}
        className="flex h-full w-full max-w-md flex-col border-l-2 border-naranja bg-orilla text-orilla-texto"
      >
        <header className="flex items-center justify-between gap-3 border-b border-orilla-borde px-5 py-4">
          <h2 className="font-serif text-2xl font-semibold">
            Notas y subrayados
          </h2>
          <button
            type="button"
            onClick={() => notas.setPanelAbierto(false)}
            aria-label="Cerrar"
            className="flex size-10 items-center justify-center rounded-full border border-orilla-borde text-orilla-tenue hover:border-naranja hover:text-orilla-texto"
          >
            <IconoCerrar />
          </button>
        </header>

        <div className="flex-1 overflow-y-auto p-5">
          {ordenados.length === 0 ? (
            <p className="text-orilla-tenue">
              Aún no hay nada aquí. Selecciona un texto del libro para
              subrayarlo o agregarle una nota.
            </p>
          ) : (
            <ul className="flex flex-col gap-4">
              {ordenados.map((s) => {
                const contenido = (
                  <>
                    <span className="line-clamp-1 text-xs font-semibold uppercase tracking-widest text-orilla-tenue">
                      {titulos[s.capitulo] ?? `Parte ${s.capitulo + 1}`}
                      {s.nota && " · con nota"}
                    </span>
                    <span
                      className="mt-2 line-clamp-4 block whitespace-pre-line border-l-4 pl-3 font-serif"
                      style={{ borderColor: COLORES[s.color].muestra }}
                    >
                      {s.texto}
                    </span>
                    {s.nota && (
                      <span className="mt-3 block whitespace-pre-line text-sm text-orilla-tenue">
                        Mi nota: {s.nota}
                      </span>
                    )}
                  </>
                );
                return (
                  <li key={s.id} className="rounded-xl border border-orilla-borde">
                    {s.capitulo === indice ? (
                      <button type="button" onClick={() => notas.irA(s.id)} className={claseTarjeta}>
                        {contenido}
                      </button>
                    ) : (
                      <Link href={`${rutaBase}?c=${s.capitulo + 1}&s=${s.id}`} className={claseTarjeta}>
                        {contenido}
                      </Link>
                    )}
                    {/* Van aparte (no dentro de la tarjeta) porque un botón
                        no puede ir dentro de otro botón o enlace. */}
                    <div className="mx-4 flex items-center justify-between gap-3 border-t border-orilla-borde py-3">
                      <button
                        type="button"
                        onClick={() =>
                          setCompartiendo({ texto: s.texto, titulo: libro.titulo, autor: libro.autor })
                        }
                        className="flex min-h-10 items-center gap-2 rounded-full bg-naranja px-4 text-sm font-semibold text-negro transition-transform active:scale-95"
                      >
                        <IconoCompartir className="size-4" />
                        Compartir
                      </button>
                      <button
                        type="button"
                        onClick={() => notas.eliminarConConfirmacion(s)}
                        disabled={notas.guardando}
                        aria-label={s.nota ? "Eliminar subrayado y nota" : "Eliminar subrayado"}
                        title="Eliminar"
                        className="flex size-10 items-center justify-center rounded-full border border-orilla-borde text-orilla-tenue transition-colors hover:border-naranja hover:text-naranja disabled:opacity-50"
                      >
                        <IconoBasura className="size-4" />
                      </button>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </aside>

      {compartiendo && (
        <CompartirCita cita={compartiendo} alCerrar={() => setCompartiendo(null)} />
      )}
    </div>
  );
}
