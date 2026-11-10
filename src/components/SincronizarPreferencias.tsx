"use client";

// No dibuja nada. Al entrar a la aplicación, pone de acuerdo las preferencias
// del perfil (luz y tamaño de letra) con las de este navegador.

import { useEffect } from "react";
import type { Luz } from "@/lib/luz";
import { sincronizarConPerfil } from "@/lib/preferencias";

export function SincronizarPreferencias({
  luz,
  tamano,
}: {
  luz: Luz;
  tamano: number;
}) {
  useEffect(() => {
    sincronizarConPerfil(luz, tamano);
  }, [luz, tamano]);

  return null;
}
