"use client";

// Botones para hacer más chica o más grande la letra de lectura.

import { TAMANO_MAX, TAMANO_MIN, TAMANO_PASO } from "@/lib/luz";
import { guardarTamano, useTamanoLetra } from "@/lib/preferencias";

export function SelectorTamano() {
  const tamano = useTamanoLetra();

  const boton =
    "flex size-11 items-center justify-center rounded-full border-2 border-borde bg-superficie font-serif text-texto transition-colors hover:border-naranja disabled:opacity-40 disabled:hover:border-borde";

  return (
    <div className="flex items-center gap-3">
      <button
        type="button"
        aria-label="Letra más chica"
        disabled={tamano <= TAMANO_MIN}
        onClick={() => guardarTamano(tamano - TAMANO_PASO)}
        className={`${boton} text-sm`}
      >
        A
      </button>
      <button
        type="button"
        aria-label="Letra más grande"
        disabled={tamano >= TAMANO_MAX}
        onClick={() => guardarTamano(tamano + TAMANO_PASO)}
        className={`${boton} text-xl`}
      >
        A
      </button>
      <span className="text-sm text-tenue" aria-live="polite">
        {tamano} px
      </span>
    </div>
  );
}
