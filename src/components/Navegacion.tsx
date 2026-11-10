"use client";

// Las "orillas" de la aplicación, siempre en negro y naranja:
// - BarraLateral: se ve en pantallas medianas y grandes.
// - BarraSuperiorMovil y BarraInferior: la reemplazan en celular.

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  IconoCorazon,
  IconoExplorar,
  IconoInicio,
  IconoLibro,
  IconoPerfil,
} from "./Iconos";
import { SelectorLuz } from "./SelectorLuz";

const ENLACES = [
  { href: "/", nombre: "Inicio", Icono: IconoInicio },
  { href: "/explorar", nombre: "Explorar", Icono: IconoExplorar },
  { href: "/favoritos", nombre: "Favoritos", Icono: IconoCorazon },
  { href: "/mis-libros", nombre: "Mis libros", Icono: IconoLibro },
  { href: "/perfil", nombre: "Mi perfil", Icono: IconoPerfil },
];

// Devuelve una función que dice si un enlace es la página actual.
function useEsActivo() {
  const ruta = usePathname();
  return (href: string) =>
    href === "/" ? ruta === "/" : ruta === href || ruta.startsWith(`${href}/`);
}

export function BarraLateral() {
  const esActivo = useEsActivo();

  return (
    <aside className="sticky top-0 hidden h-dvh w-64 shrink-0 flex-col overflow-y-auto border-r-4 border-naranja bg-orilla p-6 md:flex">
      <Link href="/" className="font-serif text-3xl font-bold text-naranja">
        Lumbre
      </Link>

      <nav aria-label="Principal" className="mt-8 flex flex-col gap-1">
        {ENLACES.map(({ href, nombre }) => {
          const activo = esActivo(href);
          return (
            <Link
              key={href}
              href={href}
              aria-current={activo ? "page" : undefined}
              className={`flex min-h-11 items-center rounded-xl px-4 font-medium transition-colors ${
                activo
                  ? "bg-naranja text-negro"
                  : "text-orilla-texto hover:bg-orilla-superficie"
              }`}
            >
              {nombre}
            </Link>
          );
        })}
      </nav>

      <p className="mb-3 mt-10 text-xs font-semibold tracking-widest text-orilla-tenue">
        LUZ
      </p>
      <SelectorLuz disposicion="lista" />
    </aside>
  );
}

export function BarraSuperiorMovil() {
  return (
    <header className="sticky top-0 z-10 flex h-14 items-center border-b-2 border-naranja bg-orilla px-5 md:hidden">
      <Link href="/" className="font-serif text-2xl font-bold text-naranja">
        Lumbre
      </Link>
    </header>
  );
}

export function BarraInferior() {
  const esActivo = useEsActivo();

  return (
    <nav
      aria-label="Principal"
      className="fixed inset-x-0 bottom-0 z-10 flex border-t-2 border-naranja bg-orilla pb-[env(safe-area-inset-bottom)] md:hidden"
    >
      {ENLACES.map(({ href, nombre, Icono }) => {
        const activo = esActivo(href);
        return (
          <Link
            key={href}
            href={href}
            aria-current={activo ? "page" : undefined}
            className={`flex h-16 flex-1 flex-col items-center justify-center gap-1 text-xs font-medium ${
              activo ? "text-naranja" : "text-orilla-tenue"
            }`}
          >
            <Icono className="size-6" />
            {nombre}
          </Link>
        );
      })}
    </nav>
  );
}
