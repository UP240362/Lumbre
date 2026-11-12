"use client";

// Piezas de la página de Amigos: los botones de amistad y el buscador.

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState, useTransition } from "react";
import { buscarLectores, cambiarAmistad, type Lector, type Relacion } from "@/app/acciones-social";
import { FotoPerfil } from "./FotoPerfil";

export function BotonesAmistad({ apodo, relacion }: { apodo: string; relacion: Relacion }) {
  const router = useRouter();
  const [rel, setRel] = useState(relacion);
  const [error, setError] = useState("");
  const [enviando, iniciar] = useTransition();

  function hacer(accion: "pedir" | "aceptar" | "rechazar" | "quitar") {
    if (accion === "quitar" && rel === "amigo" && !confirm(`¿Quitar a @${apodo} de tus amigos?`)) return;
    setError("");
    iniciar(async () => {
      const r = await cambiarAmistad(apodo, accion).catch(() => ({ ok: false as const, error: "Sin conexión." }));
      if (r.ok) {
        setRel(r.relacion);
        router.refresh();
      } else setError(r.error);
    });
  }

  const primario = "boton-primario min-h-10 px-4 text-sm disabled:opacity-50";
  const secundario =
    "min-h-10 rounded-xl border-2 border-borde px-3 text-sm font-semibold hover:border-naranja disabled:opacity-50";

  return (
    <div className="flex flex-wrap items-center justify-end gap-2">
      {rel === null && (
        <button type="button" disabled={enviando} onClick={() => hacer("pedir")} className={primario}>
          Agregar
        </button>
      )}
      {rel === "enviada" && (
        <>
          <span className="text-sm text-tenue">Solicitud enviada</span>
          <button type="button" disabled={enviando} onClick={() => hacer("quitar")} className={secundario}>
            Cancelar
          </button>
        </>
      )}
      {rel === "recibida" && (
        <>
          <button type="button" disabled={enviando} onClick={() => hacer("aceptar")} className={primario}>
            Aceptar
          </button>
          <button type="button" disabled={enviando} onClick={() => hacer("rechazar")} className={secundario}>
            Rechazar
          </button>
        </>
      )}
      {rel === "amigo" && (
        <>
          <span className="text-sm text-tenue">Amigos ✓</span>
          <button type="button" disabled={enviando} onClick={() => hacer("quitar")} className={secundario}>
            Quitar
          </button>
        </>
      )}
      {error && (
        <p role="alert" className="w-full text-right text-sm font-semibold text-acento">
          {error}
        </p>
      )}
    </div>
  );
}

// Un renglón con foto, apodo (enlace a su perfil) y los botones.
export function FilaLector({ lector }: { lector: Lector }) {
  return (
    <li className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-borde bg-superficie p-4">
      <Link href={`/lectores/${lector.apodo}`} className="flex min-w-0 items-center gap-3 hover:text-acento">
        <FotoPerfil version={lector.foto_version} nombre={lector.apodo} de={lector.apodo} className="size-12" />
        <span className="truncate font-semibold">@{lector.apodo}</span>
      </Link>
      <BotonesAmistad apodo={lector.apodo} relacion={lector.relacion} />
    </li>
  );
}

export function BuscadorLectores() {
  const [texto, setTexto] = useState("");
  const [resultados, setResultados] = useState<Lector[] | null>(null);
  const [, iniciar] = useTransition();

  // Busca 300 ms después de dejar de escribir.
  useEffect(() => {
    const limpio = texto.trim();
    if (limpio.length < 2) return;
    const espera = setTimeout(() => {
      iniciar(async () => setResultados(await buscarLectores(limpio).catch(() => [])));
    }, 300);
    return () => clearTimeout(espera);
  }, [texto]);

  const mostrados = texto.trim().length < 2 ? null : resultados;

  return (
    <div>
      <label htmlFor="buscar-lectores" className="sr-only">
        Buscar lectores por apodo
      </label>
      <div className="flex h-12 items-center rounded-xl border border-borde bg-superficie pl-4 focus-within:border-naranja">
        <span className="text-tenue">@</span>
        <input
          id="buscar-lectores"
          type="search"
          value={texto}
          onChange={(e) => setTexto(e.target.value)}
          placeholder="Busca un apodo"
          autoComplete="off"
          autoCapitalize="none"
          spellCheck={false}
          className="h-full flex-1 bg-transparent px-1 outline-none"
        />
      </div>
      {mostrados && (
        <div className="mt-4">
          {mostrados.length === 0 ? (
            <p className="text-tenue">Nadie con ese apodo.</p>
          ) : (
            <ul className="flex flex-col gap-3">
              {mostrados.map((l) => (
                <FilaLector key={l.apodo} lector={l} />
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
