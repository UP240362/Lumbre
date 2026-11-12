"use client";

// LECTURA EN VOZ ALTA
// Usa las voces que ya trae el teléfono o la computadora (Web Speech del
// navegador): no cuesta, no manda el texto a nadie y funciona sin internet.
//
// Cómo se usa en un lector:
//   const voz = useLecturaEnVoz({ ... });
//   <BotonEscuchar voz={voz} />   en la barra de arriba
//   <PanelVoz voz={voz} />        el reproductor, flotando sobre la barra de abajo
// Los párrafos del texto deben tener el atributo data-parrafo={número}: así
// se sabe cuál marcar mientras se lee.
//
// Detalles que no se ven a simple vista:
//   - Cada párrafo se lee en trozos de una o dos oraciones. Chrome corta las
//     frases muy largas a los ~15 segundos, y así además pausar y seguir
//     retoma casi en el mismo punto.
//   - "Pausar" en realidad detiene y recuerda el trozo, porque la pausa del
//     navegador falla en Android.
//   - Mientras lee, se pide que la pantalla no se apague (si se bloquea el
//     teléfono, el navegador deja de hablar).
//   - Al terminar un capítulo se anota en sessionStorage que hay que seguir,
//     se pasa al siguiente y ese capítulo arranca solo.

import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from "react";
import { IconoAudifonos, IconoCerrar } from "./Iconos";

const SEGUIR = "lumbre-voz-seguir"; // sessionStorage: continuar en el capítulo nuevo
const VOZ = "lumbre-voz"; // localStorage: voz elegida
const VELOCIDAD = "lumbre-voz-velocidad"; // localStorage: velocidad elegida
const VELOCIDADES = [0.75, 1, 1.25, 1.5, 1.75, 2];
const TITULO = -1; // "párrafo" especial: el título del capítulo

function leerGuardado(clave: string, almacen: "local" | "session" = "local") {
  try {
    return (almacen === "local" ? localStorage : sessionStorage).getItem(clave);
  } catch {
    return null;
  }
}
function guardar(clave: string, valor: string | null, almacen: "local" | "session" = "local") {
  try {
    const a = almacen === "local" ? localStorage : sessionStorage;
    if (valor === null) a.removeItem(clave);
    else a.setItem(clave, valor);
  } catch {}
}

// Parte un párrafo en trozos de hasta ~220 letras, cortando en oraciones
// (o en comas y espacios si una oración es larguísima).
function trozos(texto: string): string[] {
  const oraciones = texto.replace(/\s+/g, " ").trim().split(/(?<=[.!?…;:»])\s+/);
  const salida: string[] = [];
  let actual = "";
  const meter = (pedazo: string) => {
    if (actual && actual.length + pedazo.length > 220) {
      salida.push(actual);
      actual = pedazo;
    } else {
      actual = actual ? `${actual} ${pedazo}` : pedazo;
    }
  };
  for (const oracion of oraciones) {
    if (oracion.length <= 300) {
      meter(oracion);
      continue;
    }
    for (const parte of oracion.split(/(?<=,)\s+|\s+/)) meter(parte);
  }
  if (actual) salida.push(actual);
  return salida.filter((t) => /[\p{L}\p{N}]/u.test(t));
}

// La mejor voz para un idioma: primero la del mismo idioma y de México o
// Latinoamérica, luego cualquiera del idioma, luego la del sistema.
function mejorVoz(voces: SpeechSynthesisVoice[], idioma: string) {
  const delIdioma = voces.filter((v) => v.lang.toLowerCase().startsWith(idioma));
  const preferidas = idioma === "es" ? ["es-mx", "es-us", "es-419"] : [];
  for (const region of preferidas) {
    const v = delIdioma.find((x) => x.lang.toLowerCase().replace("_", "-") === region);
    if (v) return v;
  }
  return delIdioma.find((v) => v.localService) ?? delIdioma[0] ?? voces.find((v) => v.default);
}

const sinSuscripcion = () => () => {};
const hayVoz = () => "speechSynthesis" in window;

type Opciones = {
  parrafos: string[];
  titulo: string; // del capítulo; se lee al empezar desde arriba
  idioma?: string; // del libro, por ejemplo "es" o "en"
  haySiguiente: boolean;
  irAlSiguiente: () => void; // pasar al siguiente capítulo
};

export function useLecturaEnVoz({
  parrafos,
  titulo,
  idioma = "es",
  haySiguiente,
  irAlSiguiente,
}: Opciones) {
  const soportado = useSyncExternalStore(sinSuscripcion, hayVoz, () => false);
  const [abierto, setAbierto] = useState(false);
  const [leyendo, setLeyendo] = useState(false);
  const [voces, setVoces] = useState<SpeechSynthesisVoice[]>([]);
  const [vozId, setVozId] = useState(() =>
    typeof window === "undefined" ? "" : (leerGuardado(VOZ) ?? ""),
  );
  const [velocidad, setVelocidad] = useState(() => {
    const v = typeof window === "undefined" ? 1 : Number(leerGuardado(VELOCIDAD));
    return VELOCIDADES.includes(v) ? v : 1;
  });

  const vozElegida =
    voces.find((v) => v.voiceURI === vozId) ?? mejorVoz(voces, idioma.slice(0, 2).toLowerCase());

  // Lo que el ciclo de lectura necesita leer siempre al día.
  const ajustes = useRef({ voz: vozElegida, velocidad });
  useEffect(() => {
    ajustes.current = { voz: vozElegida, velocidad };
  }, [vozElegida, velocidad]);
  const turno = useRef(0); // cambia al detener: las frases viejas ya no siguen
  const posicion = useRef<{ parrafo: number; trozo: number } | null>(null);
  const bloqueo = useRef<WakeLockSentinel | null>(null);

  // Las voces del sistema llegan un poco después de abrir la página.
  useEffect(() => {
    if (!soportado) return;
    const cargar = () => setVoces(speechSynthesis.getVoices());
    const espera = setTimeout(cargar, 0);
    speechSynthesis.addEventListener("voiceschanged", cargar);
    return () => {
      clearTimeout(espera);
      speechSynthesis.removeEventListener("voiceschanged", cargar);
    };
  }, [soportado]);

  const marcar = useCallback((parrafo: number | null) => {
    document.querySelectorAll("[data-leyendo]").forEach((e) => e.removeAttribute("data-leyendo"));
    if (parrafo === null || parrafo < 0) return;
    const elemento = document.querySelector<HTMLElement>(`[data-parrafo="${parrafo}"]`);
    if (!elemento) return;
    elemento.setAttribute("data-leyendo", "");
    // Si el párrafo quedó fuera de la vista (o detrás de las barras), se
    // acomoda la página; eso también guarda el avance.
    const caja = elemento.getBoundingClientRect();
    if (caja.top < 90 || caja.top > window.innerHeight - 220) {
      elemento.scrollIntoView({ block: "center", behavior: "smooth" });
    }
  }, []);

  // Pide que la pantalla no se apague mientras se lee.
  const mantenerPantalla = useCallback(async (encendida: boolean) => {
    try {
      if (encendida && !bloqueo.current && "wakeLock" in navigator) {
        bloqueo.current = await navigator.wakeLock.request("screen");
        bloqueo.current.addEventListener("release", () => (bloqueo.current = null));
      } else if (!encendida && bloqueo.current) {
        await bloqueo.current.release();
        bloqueo.current = null;
      }
    } catch {}
  }, []);

  const detener = useCallback(() => {
    turno.current++;
    if (soportado) speechSynthesis.cancel();
    setLeyendo(false);
    void mantenerPantalla(false);
  }, [soportado, mantenerPantalla]);

  const leerDesde = useCallback(
    (parrafo: number, trozo = 0) => {
      if (!soportado) return;
      const miTurno = ++turno.current;
      speechSynthesis.cancel();
      setLeyendo(true);
      void mantenerPantalla(true);

      const decir = (p: number, t: number) => {
        if (miTurno !== turno.current) return;
        if (p >= parrafos.length) {
          // Fin del capítulo.
          if (haySiguiente) {
            guardar(SEGUIR, "1", "session");
            irAlSiguiente();
          } else {
            posicion.current = null;
            marcar(null);
            detener();
          }
          return;
        }
        const partes = p === TITULO ? trozos(titulo) : trozos(parrafos[p] ?? "");
        if (t >= partes.length) return decir(p + 1, 0);

        posicion.current = { parrafo: p, trozo: t };
        if (t === 0) marcar(p);

        const frase = new SpeechSynthesisUtterance(partes[t]);
        const { voz, velocidad: rapidez } = ajustes.current;
        if (voz) frase.voice = voz;
        frase.lang = voz?.lang ?? idioma;
        frase.rate = rapidez;
        frase.onend = () => decir(p, t + 1);
        frase.onerror = (e) => {
          // "interrupted"/"canceled" vienen de detener o saltar: no es error.
          if (e.error === "interrupted" || e.error === "canceled") return;
          if (miTurno === turno.current) detener();
        };
        speechSynthesis.speak(frase);
      };

      // Una pausa corta después de cancel(): algunos navegadores se comen
      // la primera frase si se habla en el mismo instante.
      setTimeout(() => decir(parrafo, trozo), 60);
    },
    [soportado, parrafos, titulo, idioma, haySiguiente, irAlSiguiente, marcar, detener, mantenerPantalla],
  );

  // El primer párrafo que se ve en pantalla (debajo de la barra de arriba).
  const primeroVisible = useCallback(() => {
    if (window.scrollY < 40) return TITULO;
    const lista = document.querySelectorAll<HTMLElement>("[data-parrafo]");
    for (const e of lista) {
      if (e.getBoundingClientRect().bottom > 100) return Number(e.dataset.parrafo);
    }
    return 0;
  }, []);

  const reproducir = useCallback(() => {
    const p = posicion.current;
    if (p) leerDesde(p.parrafo, p.trozo);
    else leerDesde(primeroVisible());
  }, [leerDesde, primeroVisible]);

  const saltar = useCallback(
    (cuanto: 1 | -1) => {
      const actual = posicion.current?.parrafo ?? primeroVisible();
      const destino = Math.min(parrafos.length - 1, Math.max(TITULO, actual + cuanto));
      posicion.current = { parrafo: destino, trozo: 0 };
      if (leyendo) leerDesde(destino);
      else marcar(destino);
    },
    [parrafos.length, leyendo, leerDesde, marcar, primeroVisible],
  );

  // Si se cambia la voz o la velocidad mientras lee, se retoma con la nueva.
  const cambiarVoz = (id: string) => {
    setVozId(id);
    guardar(VOZ, id);
  };
  const cambiarVelocidad = (v: number) => {
    setVelocidad(v);
    guardar(VELOCIDAD, String(v));
  };
  const ultimoAjuste = useRef({ vozId, velocidad });
  useEffect(() => {
    const antes = ultimoAjuste.current;
    ultimoAjuste.current = { vozId, velocidad };
    if ((antes.vozId !== vozId || antes.velocidad !== velocidad) && leyendo && posicion.current) {
      leerDesde(posicion.current.parrafo, posicion.current.trozo);
    }
  }, [vozId, velocidad, leyendo, leerDesde]);

  // Al abrir un capítulo al que se llegó leyendo en voz alta: seguir solo.
  useEffect(() => {
    if (!soportado || leerGuardado(SEGUIR, "session") !== "1") return;
    // La marca se borra hasta que de verdad empieza: React puede montar
    // la pantalla dos veces y la primera se cancela.
    const espera = setTimeout(() => {
      guardar(SEGUIR, null, "session");
      setAbierto(true);
      leerDesde(TITULO);
    }, 300);
    return () => clearTimeout(espera);
    // Solo al abrir el capítulo.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Si la pantalla vuelve a verse, se renueva el permiso de no apagarla.
  useEffect(() => {
    const alVolver = () => {
      if (document.visibilityState === "visible" && leyendo) void mantenerPantalla(true);
    };
    document.addEventListener("visibilitychange", alVolver);
    return () => document.removeEventListener("visibilitychange", alVolver);
  }, [leyendo, mantenerPantalla]);

  // Al salir del capítulo o del lector: callarse y quitar la marca.
  useEffect(
    () => () => {
      turno.current++;
      if ("speechSynthesis" in window) speechSynthesis.cancel();
      document.querySelectorAll("[data-leyendo]").forEach((e) => e.removeAttribute("data-leyendo"));
      void bloqueo.current?.release().catch(() => {});
    },
    [],
  );

  const cerrar = () => {
    detener();
    posicion.current = null;
    marcar(null);
    setAbierto(false);
  };

  return {
    soportado,
    abierto,
    leyendo,
    voces,
    vozElegida,
    velocidad,
    abrir: () => {
      setAbierto(true);
      if (!leyendo) reproducir();
    },
    cerrar,
    reproducir,
    detener,
    saltar,
    cambiarVoz,
    cambiarVelocidad,
  };
}

type Voz = ReturnType<typeof useLecturaEnVoz>;

const botonRedondo =
  "flex size-10 shrink-0 items-center justify-center rounded-full border border-orilla-borde text-orilla-texto transition-colors hover:border-naranja disabled:opacity-40";

// Botón de la barra de arriba. No aparece si el navegador no tiene voces.
export function BotonEscuchar({ voz }: { voz: Voz }) {
  if (!voz.soportado) return null;
  return (
    <button
      type="button"
      aria-label={voz.abierto ? "Cerrar lectura en voz alta" : "Escuchar el libro"}
      aria-pressed={voz.abierto}
      onClick={voz.abierto ? voz.cerrar : voz.abrir}
      className={`${botonRedondo} ${voz.abierto ? "border-naranja bg-naranja text-negro" : "text-naranja"}`}
    >
      <IconoAudifonos />
    </button>
  );
}

// Nombre corto de una voz: "Paulina (es-MX)".
const nombreVoz = (v: SpeechSynthesisVoice) =>
  `${v.name.replace(/^(Microsoft|Google)\s+/, "").replace(/\s+Online \(Natural\).*$/, " (natural)")} · ${v.lang}`;

export function PanelVoz({ voz, idioma = "es" }: { voz: Voz; idioma?: string }) {
  if (!voz.soportado || !voz.abierto) return null;

  // Primero las voces del idioma del libro, luego las demás.
  const pre = idioma.slice(0, 2).toLowerCase();
  const ordenadas = [...voz.voces].sort(
    (a, b) =>
      Number(!a.lang.toLowerCase().startsWith(pre)) - Number(!b.lang.toLowerCase().startsWith(pre)) ||
      a.lang.localeCompare(b.lang) ||
      a.name.localeCompare(b.name),
  );

  return (
    <div
      role="region"
      aria-label="Lectura en voz alta"
      className="fixed inset-x-0 bottom-[calc(6rem+env(safe-area-inset-bottom))] z-20 flex justify-center px-3 sm:bottom-[calc(5rem+env(safe-area-inset-bottom))]"
    >
      <div className="flex w-full max-w-2xl flex-wrap items-center gap-2 rounded-2xl border-2 border-naranja bg-orilla p-2 text-orilla-texto shadow-xl">
        <div className="flex items-center gap-2">
          <button
            type="button"
            aria-label="Párrafo anterior"
            onClick={() => voz.saltar(-1)}
            className={botonRedondo}
          >
            <svg viewBox="0 0 24 24" className="size-5" fill="currentColor" aria-hidden="true">
              <path d="M6 5h2v14H6zM20 5v14L9 12z" />
            </svg>
          </button>
          <button
            type="button"
            aria-label={voz.leyendo ? "Pausar" : "Leer en voz alta"}
            onClick={voz.leyendo ? voz.detener : voz.reproducir}
            className="flex size-12 shrink-0 items-center justify-center rounded-full bg-naranja text-negro transition-transform active:scale-95"
          >
            {voz.leyendo ? (
              <svg viewBox="0 0 24 24" className="size-6" fill="currentColor" aria-hidden="true">
                <path d="M6 5h4v14H6zM14 5h4v14h-4z" />
              </svg>
            ) : (
              <svg viewBox="0 0 24 24" className="ml-0.5 size-6" fill="currentColor" aria-hidden="true">
                <path d="M7 4v16l13-8z" />
              </svg>
            )}
          </button>
          <button
            type="button"
            aria-label="Párrafo siguiente"
            onClick={() => voz.saltar(1)}
            className={botonRedondo}
          >
            <svg viewBox="0 0 24 24" className="size-5" fill="currentColor" aria-hidden="true">
              <path d="M16 5h2v14h-2zM4 5v14l11-7z" />
            </svg>
          </button>
        </div>

        <label className="shrink-0">
          <span className="sr-only">Velocidad</span>
          <select
            value={voz.velocidad}
            onChange={(e) => voz.cambiarVelocidad(Number(e.target.value))}
            className="h-10 rounded-xl border border-orilla-borde bg-orilla px-2 text-sm"
          >
            {VELOCIDADES.map((v) => (
              <option key={v} value={v}>
                {v}×
              </option>
            ))}
          </select>
        </label>

        <label className="min-w-0 flex-1 basis-40">
          <span className="sr-only">Voz</span>
          <select
            value={voz.vozElegida?.voiceURI ?? ""}
            onChange={(e) => voz.cambiarVoz(e.target.value)}
            className="h-10 w-full truncate rounded-xl border border-orilla-borde bg-orilla px-2 text-sm"
          >
            {ordenadas.length === 0 && <option value="">Voz del sistema</option>}
            {ordenadas.map((v) => (
              <option key={v.voiceURI} value={v.voiceURI}>
                {nombreVoz(v)}
              </option>
            ))}
          </select>
        </label>

        <button
          type="button"
          aria-label="Cerrar lectura en voz alta"
          onClick={voz.cerrar}
          className={botonRedondo}
        >
          <IconoCerrar />
        </button>
      </div>
    </div>
  );
}
