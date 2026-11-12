"use client";

// Borra una reseña propia desde "Mis reseñas" (Mi perfil).

import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { borrarResena } from "@/app/leer/acciones-resenas";

export function BotonBorrarResena({
  fuente,
  id,
  titulo,
}: {
  fuente: string;
  id: string;
  titulo: string;
}) {
  const router = useRouter();
  const [borrando, iniciar] = useTransition();

  return (
    <button
      type="button"
      disabled={borrando}
      onClick={() => {
        if (!confirm(`¿Borrar tu reseña de “${titulo}”?`)) return;
        iniciar(async () => {
          const r = await borrarResena(fuente, id).catch(() => ({ ok: false as const }));
          if (r.ok) router.refresh();
          else alert("No se pudo borrar. Revisa tu conexión e intenta de nuevo.");
        });
      }}
      className="text-tenue underline underline-offset-4 hover:text-acento disabled:opacity-50"
    >
      {borrando ? "Borrando…" : "Borrar"}
    </button>
  );
}
