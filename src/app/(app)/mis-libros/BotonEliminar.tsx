"use client";

// Botón para eliminar un libro propio. Pide confirmación porque borrar
// no se puede deshacer (se va también el archivo y el avance).

import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { eliminarLibroPropio } from "./acciones";

export function BotonEliminar({ id, titulo }: { id: string; titulo: string }) {
  const router = useRouter();
  const [borrando, iniciar] = useTransition();

  function eliminar() {
    const seguro = window.confirm(
      `¿Eliminar «${titulo}» de tus libros?\n\nSe borrarán también su archivo, tu avance y tus subrayados y notas. No se puede deshacer.`,
    );
    if (!seguro) return;
    iniciar(async () => {
      await eliminarLibroPropio(id);
      router.refresh();
    });
  }

  return (
    <button
      type="button"
      onClick={eliminar}
      disabled={borrando}
      className="mt-2 min-h-9 text-sm text-tenue underline underline-offset-4 hover:text-acento disabled:opacity-50"
    >
      {borrando ? "Eliminando…" : "Eliminar"}
    </button>
  );
}
