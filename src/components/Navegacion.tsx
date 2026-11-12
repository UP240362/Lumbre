"use client";

// Las "orillas" de la aplicación, siempre en negro y naranja:
// - BarraLateral: se ve en pantallas medianas y grandes.
// - BarraSuperiorMovil y BarraInferior: la reemplazan en celular.

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
import {
  IconoAmigos,
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
  { href: "/amigos", nombre: "Amigos", Icono: IconoAmigos },
  { href: "/perfil", nombre: "Mi perfil", Icono: IconoPerfil },
];

// ¿El enlace es la página actual? Sin ruta (mientras carga) ninguno lo es.
function esActivoEn(ruta: string | null, href: string) {
  if (!ruta) return false;
  return href === "/" ? ruta === "/" : ruta === href || ruta.startsWith(`${href}/`);
}

// "foto": el círculo con la foto de perfil. Lo arma el servidor (necesita
// saber quién inició sesión) y se pasa ya listo.
// "ruta": la dirección actual. Cada barra tiene dos versiones: la normal
// (lee la dirección) y "SinRuta", que el layout muestra mientras tanto en
// páginas con dirección variable, como /lectores/[apodo].
type PropsBarra = { foto?: ReactNode; ruta: string | null };

export function BarraLateral({ foto }: { foto?: ReactNode }) {
  return <Lateral foto={foto} ruta={usePathname()} />;
}
export function BarraLateralSinRuta({ foto }: { foto?: ReactNode }) {
  return <Lateral foto={foto} ruta={null} />;
}

function Lateral({ foto, ruta }: PropsBarra) {
  const esActivo = (href: string) => esActivoEn(ruta, href);

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
              className={`flex min-h-11 items-center gap-3 rounded-xl px-4 font-medium transition-colors ${
                activo
                  ? "bg-naranja text-negro"
                  : "text-orilla-texto hover:bg-orilla-superficie"
              }`}
            >
              {href === "/perfil" && foto}
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

export function BarraInferior({ foto }: { foto?: ReactNode }) {
  return <Inferior foto={foto} ruta={usePathname()} />;
}
export function BarraInferiorSinRuta({ foto }: { foto?: ReactNode }) {
  return <Inferior foto={foto} ruta={null} />;
}

function Inferior({ foto, ruta }: PropsBarra) {
  const esActivo = (href: string) => esActivoEn(ruta, href);

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
            className={`flex h-16 min-w-0 flex-1 flex-col items-center justify-center gap-1 text-[11px] font-medium leading-tight ${
              activo ? "text-naranja" : "text-orilla-tenue"
            }`}
          >
            {href === "/perfil" && foto ? (
              <span className={`rounded-full ${activo ? "ring-2 ring-naranja ring-offset-2 ring-offset-orilla" : ""}`}>
                {foto}
              </span>
            ) : (
              <Icono className="size-6" />
            )}
            {nombre}
          </Link>
        );
      })}
    </nav>
  );
}
