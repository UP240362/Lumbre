"use client";

// VISOR DE CÓMICS: una página a la vez, ajustada a la pantalla.
//   - Tocar el lado derecho / izquierdo, deslizar o las flechas del
//     teclado: página siguiente / anterior.
//   - Tocar el centro: esconde o muestra las barras.
//   - Doble toque (o el botón de la lupa): acercar ese punto; ahí se mueve
//     con el dedo. Otro doble toque: volver.
//   - Modo manga: se lee de derecha a izquierda (se recuerda por libro).
// Lo usan el lector normal (LectorComic.tsx) y el de sin conexión.
// Las páginas son imágenes (CBZ, ePub) o páginas de un PDF que se dibujan
// aquí mismo con pdf.js.

import {
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  useSyncExternalStore,
  type ReactNode,
} from "react";
import { totalPaginas, type PaginasComic } from "@/lib/lectura/tipos";

const ZOOM = 2.5;
const DOBLE_TOQUE_MS = 280;

type Props = {
  clave: string; // "<fuente>:<id>", para recordar el modo manga
  titulo: string;
  paginas: PaginasComic;
  urlPagina: (ruta: string) => string; // para páginas que son imágenes
  urlPdf?: string; // para páginas de PDF
  inicial: number; // página donde abrir (desde 0)
  alCambiar: (pagina: number) => void;
  volver: ReactNode; // botón o enlace para salir
  nota?: string; // texto chiquito bajo el título ("Sin conexión", "Guardado")
};

type Documento = Awaited<ReturnType<typeof import("unpdf").getDocumentProxy>>;

// Modo manga (derecha a izquierda), guardado en el navegador por libro.
const EVENTO_MANGA = "lumbre:manga";
function suscribirManga(avisar: () => void) {
  window.addEventListener(EVENTO_MANGA, avisar);
  window.addEventListener("storage", avisar);
  return () => {
    window.removeEventListener(EVENTO_MANGA, avisar);
    window.removeEventListener("storage", avisar);
  };
}
function leerManga(clave: string): boolean {
  try {
    return localStorage.getItem(`lumbre-manga:${clave}`) === "1";
  } catch {
    return false;
  }
}

// Dibuja una página de PDF en una imagen (y la devuelve como dirección local).
async function dibujarPagina(pdf: Documento, numero: number): Promise<string> {
  const pagina = await pdf.getPage(numero + 1);
  const base = pagina.getViewport({ scale: 1 });
  // Bastante resolución para poder acercar, sin pasarse de memoria.
  const ancho = Math.min(2400, Math.max(1200, window.innerWidth * devicePixelRatio * 1.5));
  const viewport = pagina.getViewport({ scale: ancho / base.width });
  const lienzo = document.createElement("canvas");
  lienzo.width = Math.ceil(viewport.width);
  lienzo.height = Math.ceil(viewport.height);
  await pagina.render({ canvas: lienzo, viewport }).promise;
  const blob = await new Promise<Blob>((listo, falla) =>
    lienzo.toBlob((b) => (b ? listo(b) : falla(new Error("No se pudo dibujar"))), "image/jpeg", 0.88),
  );
  return URL.createObjectURL(blob);
}

export function VisorComic({
  clave,
  titulo,
  paginas,
  urlPagina,
  urlPdf,
  inicial,
  alCambiar,
  volver,
  nota,
}: Props) {
  const total = totalPaginas(paginas);
  const [pagina, setPagina] = useState(() => Math.min(Math.max(0, inicial), total - 1));
  const [src, setSrc] = useState<string | null>(null);
  const [cargada, setCargada] = useState(false);
  const [error, setError] = useState(false);
  const [barras, setBarras] = useState(true);
  const [zoom, setZoom] = useState<{ ancho: number; fx: number; fy: number } | null>(null);

  const escenario = useRef<HTMLDivElement>(null);
  const imagen = useRef<HTMLImageElement>(null);
  const ultimoToque = useRef(0);
  const espera = useRef<ReturnType<typeof setTimeout>>(undefined);
  const arrastre = useRef<{ x: number; y: number; movido: boolean } | null>(null);

  // ── De dónde sale cada página ──
  const pdf = useRef<Promise<Documento> | null>(null);
  const dibujadas = useRef(new Map<number, Promise<string>>());

  function fuente(n: number): Promise<string> {
    if (paginas.tipo === "imagenes") return Promise.resolve(urlPagina(paginas.rutas[n]));
    let guardada = dibujadas.current.get(n);
    if (!guardada) {
      pdf.current ??= (async () => {
        const { getDocumentProxy, registerImageDecoders } = await import("unpdf");
        registerImageDecoders(); // escaneos en blanco y negro (JBIG2, JPX)
        const respuesta = await fetch(urlPdf!);
        if (!respuesta.ok) throw new Error("No se pudo bajar el PDF");
        return getDocumentProxy(new Uint8Array(await respuesta.arrayBuffer()));
      })();
      pdf.current.catch(() => (pdf.current = null));
      guardada = pdf.current.then((doc) => dibujarPagina(doc, n));
      guardada.catch(() => dibujadas.current.delete(n));
      dibujadas.current.set(n, guardada);
    }
    return guardada;
  }

  // Mostrar la página actual y adelantar las dos siguientes.
  useEffect(() => {
    let vigente = true;
    fuente(pagina).then(
      (url) => vigente && setSrc(url),
      () => vigente && setError(true),
    );
    for (const n of [pagina + 1, pagina + 2]) {
      if (n >= total) continue;
      if (paginas.tipo === "imagenes") new Image().src = urlPagina(paginas.rutas[n]);
      else void fuente(n).catch(() => {});
    }
    // Las páginas de PDF lejanas se sueltan de la memoria.
    for (const [n, url] of dibujadas.current) {
      if (Math.abs(n - pagina) > 4) {
        dibujadas.current.delete(n);
        void url.then(URL.revokeObjectURL, () => {});
      }
    }
    return () => {
      vigente = false;
    };
    // fuente y urlPagina dependen solo de props que no cambian.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pagina]);

  // Al salir se sueltan todas las páginas dibujadas.
  useEffect(() => {
    const mapa = dibujadas.current;
    return () => {
      mapa.forEach((url) => void url.then(URL.revokeObjectURL, () => {}));
      mapa.clear(); // si el visor vuelve a montarse, las dibuja de nuevo
    };
  }, []);

  // Modo manga, recordado por libro en este navegador.
  const manga = useSyncExternalStore(
    suscribirManga,
    () => leerManga(clave),
    () => false,
  );
  function cambiarSentido() {
    try {
      localStorage.setItem(`lumbre-manga:${clave}`, manga ? "0" : "1");
    } catch {}
    window.dispatchEvent(new Event(EVENTO_MANGA));
  }

  function ir(n: number) {
    if (n < 0 || n >= total || n === pagina) return;
    setPagina(n);
    setCargada(false);
    setError(false);
    setZoom(null);
    alCambiar(n);
  }
  const adelante = () => ir(pagina + 1);
  const atras = () => ir(pagina - 1);
  // En modo manga, la derecha es "atrás".
  const derecha = () => (manga ? atras() : adelante());
  const izquierda = () => (manga ? adelante() : atras());

  // Teclado.
  useEffect(() => {
    function alTeclear(e: KeyboardEvent) {
      if (e.target instanceof HTMLInputElement) return;
      if (e.key === "ArrowRight") derecha();
      else if (e.key === "ArrowLeft") izquierda();
      else if (e.key === " " || e.key === "PageDown") adelante();
      else if (e.key === "PageUp") atras();
      else if (e.key === "Escape") setZoom(null);
      else return;
      e.preventDefault();
    }
    window.addEventListener("keydown", alTeclear);
    return () => window.removeEventListener("keydown", alTeclear);
  });

  function acercar(x: number, y: number) {
    const img = imagen.current;
    if (!img) return;
    const caja = img.getBoundingClientRect();
    setZoom({
      ancho: caja.width * ZOOM,
      fx: Math.min(1, Math.max(0, (x - caja.left) / caja.width)),
      fy: Math.min(1, Math.max(0, (y - caja.top) / caja.height)),
    });
  }

  // Al acercar, se lleva la vista al punto tocado.
  useLayoutEffect(() => {
    const caja = escenario.current;
    const img = imagen.current;
    if (!zoom || !caja || !img) return;
    caja.scrollLeft = zoom.fx * img.offsetWidth - caja.clientWidth / 2;
    caja.scrollTop = zoom.fy * img.offsetHeight - caja.clientHeight / 2;
  }, [zoom]);

  function alTocar(e: React.MouseEvent) {
    if (arrastre.current?.movido) return; // fue un deslizamiento
    const ahora = Date.now();
    if (ahora - ultimoToque.current < DOBLE_TOQUE_MS) {
      clearTimeout(espera.current);
      ultimoToque.current = 0;
      if (zoom) setZoom(null);
      else acercar(e.clientX, e.clientY);
      return;
    }
    ultimoToque.current = ahora;
    if (zoom) return;
    const caja = e.currentTarget.getBoundingClientRect();
    const x = (e.clientX - caja.left) / caja.width;
    if (x < 0.3) izquierda();
    else if (x > 0.7) derecha();
    else espera.current = setTimeout(() => setBarras((b) => !b), DOBLE_TOQUE_MS);
  }

  const boton =
    "flex size-11 shrink-0 items-center justify-center rounded-full border border-orilla-borde text-orilla-texto transition-colors hover:border-naranja disabled:opacity-40";

  return (
    <div className="fixed inset-0 z-30 flex flex-col bg-black text-orilla-texto">
      {barras && (
        <header className="flex items-center gap-3 border-b-2 border-naranja bg-orilla px-3 py-2 sm:px-5">
          {volver}
          <div className="min-w-0 flex-1">
            <p className="truncate font-serif text-lg font-semibold">{titulo}</p>
            <p className="truncate text-sm text-orilla-tenue">
              Página {pagina + 1} de {total}
              {nota ? ` · ${nota}` : ""}
            </p>
          </div>
          <button
            type="button"
            onClick={cambiarSentido}
            aria-pressed={manga}
            title={manga ? "Se lee de derecha a izquierda (manga)" : "Se lee de izquierda a derecha"}
            className={`h-11 shrink-0 rounded-full border px-3 text-sm font-semibold transition-colors ${
              manga ? "border-naranja bg-naranja text-negro" : "border-orilla-borde hover:border-naranja"
            }`}
          >
            {manga ? "← Manga" : "Manga"}
          </button>
          <button
            type="button"
            onClick={() => {
              if (zoom) setZoom(null);
              else {
                const caja = imagen.current?.getBoundingClientRect();
                if (caja) acercar(caja.left + caja.width / 2, caja.top + caja.height / 3);
              }
            }}
            aria-label={zoom ? "Alejar" : "Acercar"}
            aria-pressed={Boolean(zoom)}
            className={`${boton} ${zoom ? "border-naranja text-naranja" : ""}`}
          >
            <svg aria-hidden="true" viewBox="0 0 24 24" className="size-5" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="11" cy="11" r="7" />
              <path d="m20 20-3.5-3.5" />
              {!zoom && <path d="M11 8v6" />}
              <path d="M8 11h6" />
            </svg>
          </button>
        </header>
      )}

      {/* ── La página ── */}
      <div
        ref={escenario}
        onClick={alTocar}
        onPointerDown={(e) => {
          arrastre.current = { x: e.clientX, y: e.clientY, movido: false };
        }}
        onPointerUp={(e) => {
          const a = arrastre.current;
          if (!a || zoom) return;
          const dx = e.clientX - a.x;
          const dy = e.clientY - a.y;
          if (Math.abs(dx) > 50 && Math.abs(dy) < 80) {
            a.movido = true;
            // Deslizar hacia la izquierda = pasar a la página de la derecha.
            if (dx < 0) derecha();
            else izquierda();
          }
        }}
        className={`relative min-h-0 flex-1 touch-manipulation select-none ${
          zoom ? "overflow-auto" : "flex items-center justify-center overflow-hidden p-1 sm:p-3"
        }`}
      >
        {src && !error && (
          // eslint-disable-next-line @next/next/no-img-element -- páginas locales o de /api/imagen
          <img
            key={src}
            ref={imagen}
            src={src}
            alt={`Página ${pagina + 1} de ${total}`}
            draggable={false}
            onLoad={() => setCargada(true)}
            onError={() => setError(true)}
            style={zoom ? { width: zoom.ancho, maxWidth: "none" } : undefined}
            className={
              zoom
                ? "m-auto block h-auto max-h-none"
                : `max-h-full max-w-full object-contain transition-opacity ${cargada ? "opacity-100" : "opacity-0"}`
            }
          />
        )}
        {!cargada && !error && (
          <p className="pointer-events-none absolute inset-0 flex items-center justify-center text-sm text-orilla-tenue">
            Cargando página…
          </p>
        )}
        {error && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 px-6 text-center">
            <p>No se pudo cargar esta página.</p>
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                dibujadas.current.delete(pagina);
                setError(false);
                fuente(pagina).then(setSrc, () => setError(true));
              }}
              className="boton-primario"
            >
              Intentar de nuevo
            </button>
          </div>
        )}
      </div>

      {barras && (
        <footer className="flex items-center gap-3 border-t-2 border-naranja bg-orilla px-3 py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] sm:gap-5 sm:px-5">
          <button
            type="button"
            onClick={izquierda}
            disabled={manga ? pagina >= total - 1 : pagina <= 0}
            aria-label={manga ? "Página siguiente" : "Página anterior"}
            className={boton}
          >
            ‹
          </button>
          <input
            type="range"
            min={1}
            max={total}
            value={pagina + 1}
            onChange={(e) => ir(Number(e.target.value) - 1)}
            aria-label="Ir a la página"
            // En modo manga la barra también va de derecha a izquierda.
            dir={manga ? "rtl" : "ltr"}
            className="h-11 min-w-0 flex-1 accent-naranja"
          />
          <span aria-live="polite" className="w-16 shrink-0 text-center text-sm tabular-nums text-orilla-tenue">
            {pagina + 1} / {total}
          </span>
          <button
            type="button"
            onClick={derecha}
            disabled={manga ? pagina <= 0 : pagina >= total - 1}
            aria-label={manga ? "Página anterior" : "Página siguiente"}
            className={boton}
          >
            ›
          </button>
        </footer>
      )}
    </div>
  );
}
