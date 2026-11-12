"use client";

// UNA ILUSTRACIÓN DENTRO DEL TEXTO DEL LIBRO
// Centrada, del ancho de la columna como máximo. Su pie de foto, si tiene,
// es el párrafo que sigue (con otro estilo, en Anotaciones.tsx), así sigue
// contando como texto del libro: se subraya y se lee en voz alta.
// Al tocarla se abre en grande sobre fondo oscuro; tocarla otra vez la
// muestra a su tamaño real para ver los detalles.
// Las muy chicas (adornos, viñetas) se muestran a su tamaño, sin marco.
// Los colores según la luz (clase foto-libro) están en globals.css.

import { useEffect, useRef, useState } from "react";
import type { Imagen } from "@/lib/lectura/tipos";

const CHICA = 200; // px: menos que esto en ancho y alto es un adorno

export function Ilustracion({
  imagen,
  src,
  pie = "",
}: {
  imagen: Imagen;
  src: string;
  pie?: string; // texto de su pie de foto, para el visor
}) {
  const [estado, setEstado] = useState<"cargando" | "lista" | "fallo">("cargando");
  const [cerca, setCerca] = useState(false); // en el visor: tamaño real
  const visor = useRef<HTMLDialogElement>(null);
  const imagenRef = useRef<HTMLImageElement>(null);

  // Si la imagen terminó de cargar antes de que React tomara la página,
  // onLoad ya no llega: se revisa a mano.
  useEffect(() => {
    const img = imagenRef.current;
    if (img?.complete) setEstado(img.naturalWidth > 0 ? "lista" : "fallo");
  }, []);

  const { ancho, alto, alt } = imagen;
  const conMedidas = Boolean(ancho && alto);
  // Imágenes de relleno (1×1 px, separadores): no se muestran.
  if (conMedidas && ancho! < 24 && alto! < 24) return null;
  if (estado === "fallo") return null;
  const esAdorno = conMedidas && ancho! < CHICA && alto! < CHICA;
  const descripcion = alt || pie || "Ilustración del libro";

  const foto = (
    // eslint-disable-next-line @next/next/no-img-element -- viene de /api/imagen, no hace falta optimizarla
    <img
      ref={imagenRef}
      src={src}
      alt={alt || pie}
      width={ancho}
      height={alto}
      loading="lazy"
      decoding="async"
      onLoad={() => setEstado("lista")}
      onError={() => setEstado("fallo")}
      className={`foto-libro mx-auto block h-auto max-h-[80vh] w-auto max-w-full ${
        esAdorno ? "" : "rounded-xl shadow-[0_6px_24px_-8px_rgb(0_0_0/0.35)]"
      } ${estado === "cargando" ? "bg-superficie" : ""} ${
        // Sin medidas no se sabe cuánto lugar apartar: un hueco mientras carga.
        !conMedidas && estado === "cargando" ? "min-h-48 min-w-40 animate-pulse" : ""
      }`}
    />
  );

  return (
    <figure
      data-ilustracion=""
      // Con pie, el pie va pegado debajo (y él lleva el espacio de abajo).
      className={`select-none ${imagen.pie !== undefined ? "mb-3 mt-10" : "my-10"}`}
    >
      {esAdorno ? (
        foto
      ) : (
        <button
          type="button"
          onClick={() => {
            setCerca(false);
            visor.current?.showModal();
          }}
          aria-label={`Ver en grande: ${descripcion}`}
          className="block w-full cursor-zoom-in rounded-xl transition-transform hover:-translate-y-0.5"
        >
          {foto}
        </button>
      )}

      {!esAdorno && (
        <dialog
          ref={visor}
          aria-label={descripcion}
          className="visor-ilustracion m-0 h-dvh max-h-none w-screen max-w-none bg-transparent p-0"
        >
          <div
            className={`flex h-full w-full ${cerca ? "overflow-auto" : "items-center justify-center p-4 sm:p-10"}`}
            // Tocar el fondo (fuera de la imagen) cierra el visor.
            onClick={(e) => {
              if (e.target === e.currentTarget) visor.current?.close();
            }}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={src}
              alt={alt || pie}
              onClick={() => setCerca((c) => !c)}
              className={
                cerca
                  ? "m-auto max-w-none cursor-zoom-out"
                  : "max-h-full max-w-full cursor-zoom-in object-contain"
              }
            />
          </div>
          {pie && !cerca && (
            <p className="pointer-events-none absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/80 to-transparent px-6 pb-6 pt-12 text-center font-serif italic text-white/90">
              {pie}
            </p>
          )}
          <button
            type="button"
            onClick={() => visor.current?.close()}
            aria-label="Cerrar"
            className="absolute right-3 top-3 flex size-11 items-center justify-center rounded-full bg-black/60 text-2xl leading-none text-white hover:bg-black/80"
          >
            ×
          </button>
        </dialog>
      )}
    </figure>
  );
}
