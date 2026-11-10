"use client";

// El corazón de favorito. Al tocarlo cambia al instante (sin esperar al
// servidor) y, si el guardado falla, regresa a como estaba.

import { useState, useTransition } from "react";
import { marcarFavorito } from "@/app/acciones-favoritos";
import { IconoCorazon } from "./Iconos";

type Props = {
  fuente: string;
  id: string;
  titulo: string;
  inicial: boolean; // ¿ya era favorito al cargar la página?
  // Dónde se dibuja: sobre el área de contenido o sobre una orilla negra.
  sobre?: "contenido" | "orilla";
};

export function BotonFavorito({
  fuente,
  id,
  titulo,
  inicial,
  sobre = "contenido",
}: Props) {
  const [activo, setActivo] = useState(inicial);
  const [guardando, iniciar] = useTransition();

  function alternar() {
    const nuevo = !activo;
    setActivo(nuevo);
    iniciar(async () => {
      const { ok } = await marcarFavorito(fuente, id, nuevo);
      if (!ok) setActivo(!nuevo);
    });
  }

  const colores =
    sobre === "orilla"
      ? "size-10 border-orilla-borde text-naranja"
      : "size-11 border-borde bg-superficie text-acento";

  return (
    <button
      type="button"
      aria-pressed={activo}
      aria-label={
        activo ? `Quitar ${titulo} de favoritos` : `Agregar ${titulo} a favoritos`
      }
      disabled={guardando}
      onClick={alternar}
      className={`flex shrink-0 items-center justify-center rounded-full border transition-colors hover:border-naranja ${colores}`}
    >
      <IconoCorazon relleno={activo} />
    </button>
  );
}
