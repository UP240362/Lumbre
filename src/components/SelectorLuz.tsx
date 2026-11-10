"use client";

// Los tres botones para elegir la luz: Amarilla, Blanca o Negra.
// "use client" significa que este componente corre en el navegador,
// porque necesita reaccionar a los clics.

import { LUCES } from "@/lib/luz";
import { guardarLuz, useLuz } from "@/lib/preferencias";

type Props = {
  // "lista": uno debajo de otro (barra lateral). "fila": en renglón.
  disposicion?: "lista" | "fila";
  // Dónde se dibuja: sobre una orilla negra o sobre el área de contenido.
  sobre?: "orilla" | "contenido";
};

export function SelectorLuz({ disposicion = "fila", sobre = "orilla" }: Props) {
  const luzActual = useLuz();

  const colores =
    sobre === "orilla"
      ? "bg-orilla text-orilla-texto"
      : "bg-superficie text-texto";
  const bordeInactivo =
    sobre === "orilla" ? "border-orilla-borde" : "border-borde";

  return (
    <div
      role="radiogroup"
      aria-label="Luz de lectura"
      className={
        disposicion === "lista" ? "flex flex-col gap-2" : "flex flex-wrap gap-2"
      }
    >
      {LUCES.map((luz) => {
        const activa = luz.id === luzActual;
        return (
          <button
            key={luz.id}
            type="button"
            role="radio"
            aria-checked={activa}
            onClick={() => guardarLuz(luz.id)}
            className={`flex min-h-11 items-center gap-3 rounded-xl border-2 px-4 text-sm font-medium transition-colors ${colores} ${
              activa ? "border-naranja" : `${bordeInactivo} hover:border-naranja/60`
            }`}
          >
            <span
              className="size-4 shrink-0 rounded-full border border-neutral-400"
              style={{ background: luz.muestra }}
            />
            {luz.nombre}
          </button>
        );
      })}
    </div>
  );
}
