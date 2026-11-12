"use client";

// Lector de cómics (libros propios que se leen por páginas). El visor está
// en components/VisorComic.tsx; aquí se guarda el avance en la cuenta, se
// cuenta el tiempo de lectura y se deja el cómic en el teléfono para
// leerlo sin internet.

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { IconoAtras } from "@/components/Iconos";
import { VisorComic } from "@/components/VisorComic";
import { totalPaginas, urlArchivo, urlImagen, type PaginasComic } from "@/lib/lectura/tipos";
import { anotarAvance, guardarComicEnTelefono } from "@/lib/sinConexion";
import { useTiempoLectura } from "@/lib/tiempoLectura";
import { guardarAvance } from "../../acciones";

type Props = {
  usuarioId: string;
  libro: { id: string; fuente: string; titulo: string; autor: string };
  paginas: PaginasComic;
  inicial: number;
};

export function LectorComic({ usuarioId, libro, paginas, inicial }: Props) {
  const total = totalPaginas(paginas);
  const porcentajeDe = (pagina: number) => (total > 1 ? (pagina / (total - 1)) * 100 : 100);
  const [nota, setNota] = useState<string | undefined>(undefined);
  const espera = useRef<ReturnType<typeof setTimeout>>(undefined);
  const pendiente = useRef<number | null>(null);

  useTiempoLectura({ dueno: usuarioId, fuente: libro.fuente, id: libro.id, escuchando: false });

  // Guarda en la cuenta; si no hay internet, en el teléfono (se sube después).
  async function guardar(pagina: number) {
    pendiente.current = null;
    const valor = porcentajeDe(pagina);
    const enviado = await guardarAvance(libro.fuente, libro.id, pagina, valor)
      .then(({ ok }) => (ok ? "ok" : "error"))
      .catch(() => "sin-red" as const);
    await anotarAvance(libro.fuente, libro.id, pagina, valor, enviado === "sin-red").catch(() => {});
    setNota(enviado === "sin-red" ? "Avance guardado en el teléfono" : undefined);
  }

  useEffect(() => {
    const primera = setTimeout(() => void guardar(inicial), 0);
    void guardarComicEnTelefono({
      dueno: usuarioId,
      fuente: libro.fuente,
      id: libro.id,
      titulo: libro.titulo,
      autor: libro.autor,
      paginas,
      pagina: inicial,
      porcentaje: porcentajeDe(inicial),
    }).catch(() => {});
    return () => {
      clearTimeout(primera);
      clearTimeout(espera.current);
      if (pendiente.current !== null) void guardar(pendiente.current);
    };
    // Solo al abrir.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const rutaBase = `/leer/${libro.fuente}/${encodeURIComponent(libro.id)}`;

  return (
    <VisorComic
      clave={`${libro.fuente}:${libro.id}`}
      titulo={libro.titulo}
      paginas={paginas}
      urlPagina={(ruta) => urlImagen(libro.fuente, libro.id, ruta)}
      urlPdf={urlArchivo(libro.fuente, libro.id)}
      inicial={inicial}
      nota={nota}
      alCambiar={(pagina) => {
        // La dirección lleva la página, para que al recargar se quede ahí.
        history.replaceState(history.state, "", `${rutaBase}?c=${pagina + 1}`);
        pendiente.current = pagina;
        clearTimeout(espera.current);
        espera.current = setTimeout(() => void guardar(pagina), 800);
      }}
      volver={
        <Link
          href="/mis-libros"
          aria-label="Volver a Mis libros"
          className="flex size-11 shrink-0 items-center justify-center rounded-full border border-orilla-borde text-naranja"
        >
          <IconoAtras />
        </Link>
      }
    />
  );
}
