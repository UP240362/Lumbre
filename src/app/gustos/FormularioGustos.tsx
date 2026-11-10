"use client";

// Pantalla "Tus gustos": chips para elegir autores y libros, cada sección
// con su buscador. Corre en el navegador porque todo es interactivo.

import { useEffect, useState, useTransition } from "react";
import { NOMBRES_FUENTE, type Libro } from "@/lib/fuentes/tipos";
import type { LibroElegible } from "@/lib/sugerencias";
import { simplificar } from "@/lib/texto";
import { guardarGustos, omitirGustos } from "./acciones";

// ── Buscador ────────────────────────────────────────────────────────
// Espera a que la persona deje de teclear (400 ms) y entonces pregunta
// a /api/buscar. Si se sigue escribiendo, cancela la búsqueda anterior.

type Resultado = { consulta: string; libros: Libro[]; error: boolean };

function useBusqueda(consulta: string) {
  const [resultado, setResultado] = useState<Resultado | null>(null);
  const limpia = consulta.trim();
  const activa = limpia.length >= 2;

  useEffect(() => {
    if (!activa) return;
    const control = new AbortController();
    const espera = setTimeout(async () => {
      try {
        const respuesta = await fetch(
          `/api/buscar?q=${encodeURIComponent(limpia)}`,
          { signal: control.signal },
        );
        if (!respuesta.ok) throw new Error("Falló la búsqueda");
        const datos: { libros: Libro[] } = await respuesta.json();
        setResultado({ consulta: limpia, libros: datos.libros, error: false });
      } catch {
        if (!control.signal.aborted) {
          setResultado({ consulta: limpia, libros: [], error: true });
        }
      }
    }, 400);
    return () => {
      clearTimeout(espera);
      control.abort();
    };
  }, [limpia, activa]);

  // Solo vale el resultado que corresponde a lo que está escrito ahora.
  const vigente = activa && resultado?.consulta === limpia ? resultado : null;
  return {
    activa,
    cargando: activa && !vigente,
    error: vigente?.error ?? false,
    libros: vigente?.libros ?? [],
  };
}

// ── Piezas ──────────────────────────────────────────────────────────

function Chip({
  activo,
  onClick,
  children,
}: {
  activo: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      aria-pressed={activo}
      onClick={onClick}
      className={`min-h-11 rounded-full border px-5 py-2 text-left font-medium transition-colors ${
        activo
          ? "border-naranja bg-naranja text-negro"
          : "border-orilla-borde text-orilla-texto hover:border-naranja"
      }`}
    >
      {children}
    </button>
  );
}

// Un resultado de búsqueda: al tocarlo se agrega a los chips.
function Sugerencia({
  onClick,
  children,
}: {
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="min-h-11 rounded-full border border-dashed border-orilla-tenue px-5 py-2 text-left text-sm text-orilla-texto transition-colors hover:border-naranja"
    >
      + {children}
    </button>
  );
}

function CampoBusqueda({
  etiqueta,
  ejemplo,
  valor,
  onChange,
}: {
  etiqueta: string;
  ejemplo: string;
  valor: string;
  onChange: (valor: string) => void;
}) {
  return (
    <label className="flex flex-col gap-2 text-sm text-orilla-tenue">
      {etiqueta}
      <input
        type="search"
        value={valor}
        onChange={(e) => onChange(e.target.value)}
        placeholder={ejemplo}
        className="h-12 rounded-xl border border-orilla-borde bg-orilla-superficie px-4 text-base text-orilla-texto placeholder:text-orilla-tenue/60"
      />
    </label>
  );
}

function EstadoBusqueda({
  cargando,
  error,
  vacio,
}: {
  cargando: boolean;
  error: boolean;
  vacio: boolean;
}) {
  const texto = cargando
    ? "Buscando…"
    : error
      ? "No se pudo consultar el catálogo. Intenta de nuevo."
      : vacio
        ? "Sin resultados."
        : null;
  return texto ? <p className="text-sm text-orilla-tenue">{texto}</p> : null;
}

// ── Formulario ──────────────────────────────────────────────────────

const claveLibro = (l: { fuente: string; id: string }) => `${l.fuente}:${l.id}`;

type Props = {
  primeraVez: boolean;
  autoresSugeridos: string[];
  librosSugeridos: LibroElegible[];
  autoresIniciales: string[];
  librosIniciales: LibroElegible[];
};

export function FormularioGustos({
  primeraVez,
  autoresSugeridos,
  librosSugeridos,
  autoresIniciales,
  librosIniciales,
}: Props) {
  // Chips que se muestran (los ya elegidos primero, luego los sugeridos).
  const [opcionesAutores, setOpcionesAutores] = useState(() => [
    ...new Set([...autoresIniciales, ...autoresSugeridos]),
  ]);
  const [opcionesLibros, setOpcionesLibros] = useState(() => {
    const mapa = new Map<string, LibroElegible>();
    for (const l of [...librosIniciales, ...librosSugeridos]) {
      if (!mapa.has(claveLibro(l))) mapa.set(claveLibro(l), l);
    }
    return [...mapa.values()];
  });

  // Cuáles están marcados.
  const [autores, setAutores] = useState(() => new Set(autoresIniciales));
  const [libros, setLibros] = useState(
    () => new Set(librosIniciales.map(claveLibro)),
  );

  const [textoAutor, setTextoAutor] = useState("");
  const [textoLibro, setTextoLibro] = useState("");
  const busquedaAutor = useBusqueda(textoAutor);
  const busquedaLibro = useBusqueda(textoLibro);

  const [error, setError] = useState<string | null>(null);
  const [guardando, iniciarGuardado] = useTransition();

  // Autores distintos que aparecen en los resultados y aún no son chips.
  const consultaAutor = simplificar(textoAutor.trim());
  const todosLosAutores = [
    ...new Set(busquedaAutor.libros.flatMap((l) => l.autores)),
  ].filter((a) => !opcionesAutores.includes(a));
  const coinciden = todosLosAutores.filter((a) =>
    consultaAutor.split(/\s+/).some((p) => simplificar(a).includes(p)),
  );
  const autoresHallados = (coinciden.length ? coinciden : todosLosAutores).slice(0, 8);

  const librosHallados = busquedaLibro.libros
    .filter((l) => !opcionesLibros.some((o) => claveLibro(o) === claveLibro(l)))
    .slice(0, 12);

  function alternarAutor(nombre: string) {
    setAutores((previos) => {
      const nuevos = new Set(previos);
      if (!nuevos.delete(nombre)) nuevos.add(nombre);
      return nuevos;
    });
  }

  function alternarLibro(clave: string) {
    setLibros((previos) => {
      const nuevos = new Set(previos);
      if (!nuevos.delete(clave)) nuevos.add(clave);
      return nuevos;
    });
  }

  function agregarAutor(nombre: string) {
    setOpcionesAutores((previas) => [nombre, ...previas]);
    setAutores((previos) => new Set(previos).add(nombre));
    setTextoAutor("");
  }

  function agregarLibro(libro: Libro) {
    const elegible: LibroElegible = {
      id: libro.id,
      fuente: libro.fuente,
      titulo: libro.titulo,
      autor: libro.autores.join(", "),
    };
    setOpcionesLibros((previas) => [elegible, ...previas]);
    setLibros((previos) => new Set(previos).add(claveLibro(elegible)));
    setTextoLibro("");
  }

  function guardar() {
    setError(null);
    iniciarGuardado(async () => {
      const respuesta = await guardarGustos(
        [...autores],
        opcionesLibros.filter((l) => libros.has(claveLibro(l))),
      );
      // Si todo sale bien, el servidor redirige y esto no llega a correr.
      if (respuesta?.error) setError(respuesta.error);
    });
  }

  return (
    <div className="flex flex-col gap-12">
      <section aria-labelledby="autores" className="flex flex-col gap-4">
        <h2 id="autores" className="text-xl font-semibold text-orilla-texto">
          Autores preferidos
        </h2>
        <CampoBusqueda
          etiqueta="Busca un autor"
          ejemplo="Ej. Julio Verne"
          valor={textoAutor}
          onChange={setTextoAutor}
        />
        {busquedaAutor.activa && (
          <div className="flex flex-wrap gap-3" aria-live="polite">
            <EstadoBusqueda
              cargando={busquedaAutor.cargando}
              error={busquedaAutor.error}
              vacio={autoresHallados.length === 0}
            />
            {autoresHallados.map((nombre) => (
              <Sugerencia key={nombre} onClick={() => agregarAutor(nombre)}>
                {nombre}
              </Sugerencia>
            ))}
          </div>
        )}
        <div className="flex flex-wrap gap-3">
          {opcionesAutores.map((nombre) => (
            <Chip
              key={nombre}
              activo={autores.has(nombre)}
              onClick={() => alternarAutor(nombre)}
            >
              {nombre}
            </Chip>
          ))}
        </div>
      </section>

      <section aria-labelledby="libros" className="flex flex-col gap-4">
        <h2 id="libros" className="text-xl font-semibold text-orilla-texto">
          Libros favoritos
        </h2>
        <CampoBusqueda
          etiqueta="Busca un libro"
          ejemplo="Ej. Frankenstein"
          valor={textoLibro}
          onChange={setTextoLibro}
        />
        {busquedaLibro.activa && (
          <div className="flex flex-wrap gap-3" aria-live="polite">
            <EstadoBusqueda
              cargando={busquedaLibro.cargando}
              error={busquedaLibro.error}
              vacio={librosHallados.length === 0}
            />
            {librosHallados.map((libro) => (
              <Sugerencia
                key={claveLibro(libro)}
                onClick={() => agregarLibro(libro)}
              >
                {libro.titulo}
                <span className="text-orilla-tenue">
                  {libro.autores.length > 0 && ` · ${libro.autores[0]}`}
                  {!libro.idiomas.includes("es") &&
                    ` · ${libro.idiomas[0]?.toUpperCase()}`}
                  {` · ${NOMBRES_FUENTE[libro.fuente]}`}
                </span>
              </Sugerencia>
            ))}
          </div>
        )}
        <div className="flex flex-wrap gap-3">
          {opcionesLibros.map((libro) => (
            <Chip
              key={claveLibro(libro)}
              activo={libros.has(claveLibro(libro))}
              onClick={() => alternarLibro(claveLibro(libro))}
            >
              {libro.titulo}
            </Chip>
          ))}
        </div>
      </section>

      {error && (
        <p
          role="alert"
          className="rounded-xl border border-red-500/50 bg-red-500/10 px-4 py-3 text-sm text-red-200"
        >
          {error}
        </p>
      )}

      <div className="flex flex-col-reverse items-stretch gap-4 border-t border-orilla-borde pt-6 sm:flex-row sm:items-center sm:justify-between">
        {primeraVez ? (
          <form action={omitirGustos} className="text-center">
            <button
              type="submit"
              className="min-h-11 font-medium text-naranja underline underline-offset-4"
            >
              Omitir por ahora
            </button>
          </form>
        ) : (
          <span />
        )}
        <button
          type="button"
          onClick={guardar}
          disabled={guardando}
          className="boton-primario h-13 px-8 disabled:opacity-60"
        >
          {guardando
            ? "Guardando…"
            : primeraVez
              ? "Ver mis recomendaciones"
              : "Guardar mis gustos"}
        </button>
      </div>
    </div>
  );
}
