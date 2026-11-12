"use client";

// Apodo público y privacidad del perfil (en Mi perfil).

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { guardarApodo, guardarPrivacidad } from "@/app/acciones-social";
import type { Visibilidad } from "@/lib/sesion";

export function EditorApodo({ apodo }: { apodo: string | null }) {
  const router = useRouter();
  const [valor, setValor] = useState(apodo ?? "");
  const [mensaje, setMensaje] = useState<{ ok: boolean; texto: string } | null>(null);
  const [enviando, iniciar] = useTransition();
  const limpio = valor.trim().toLowerCase().replace(/^@/, "");

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        iniciar(async () => {
          const r = await guardarApodo(limpio).catch(() => ({ ok: false as const, error: "Sin conexión." }));
          setMensaje(r.ok ? { ok: true, texto: "Apodo guardado." } : { ok: false, texto: r.error });
          if (r.ok) router.refresh();
        });
      }}
    >
      <label htmlFor="apodo" className="font-semibold">
        Tu apodo
      </label>
      <p className="mb-2 text-sm text-tenue">
        Es lo que ven los demás lectores (en tu perfil, tus reseñas y al buscarte). Tu nombre real
        no se muestra a nadie.
      </p>
      <div className="flex flex-wrap items-center gap-2">
        <div className="flex h-11 items-center rounded-xl border border-borde bg-superficie pl-3 focus-within:border-naranja">
          <span className="text-tenue">@</span>
          <input
            id="apodo"
            value={valor}
            onChange={(e) => setValor(e.target.value.toLowerCase().replace(/\s/g, ""))}
            maxLength={21}
            autoComplete="off"
            autoCapitalize="none"
            spellCheck={false}
            placeholder="lector_nocturno"
            className="h-full w-48 bg-transparent px-1 outline-none"
          />
        </div>
        <button
          type="submit"
          disabled={enviando || !limpio || limpio === apodo}
          className="boton-primario disabled:opacity-50"
        >
          {enviando ? "Guardando…" : "Guardar apodo"}
        </button>
      </div>
      <p className="mt-1 text-xs text-tenue">3 a 20 letras minúsculas, números, punto o guion bajo.</p>
      {mensaje && (
        <p role="status" className={`mt-2 text-sm ${mensaje.ok ? "text-tenue" : "font-semibold text-acento"}`}>
          {mensaje.texto}
        </p>
      )}
      {apodo && (
        <Link
          href={`/lectores/${apodo}`}
          className="mt-3 inline-block text-sm font-semibold text-acento underline underline-offset-4"
        >
          Ver mi perfil como lo ven los demás
        </Link>
      )}
    </form>
  );
}

type Privacidad = {
  visibilidad: Visibilidad;
  mostrar_tiempo: boolean;
  mostrar_favoritos: boolean;
  mostrar_resenas: boolean;
  mostrar_gustos: boolean;
};

const OPCIONES: { id: Visibilidad; nombre: string; detalle: string }[] = [
  { id: "publico", nombre: "Público", detalle: "Cualquier lector de Lumbre ve tu perfil." },
  { id: "amigos", nombre: "Solo amigos", detalle: "Solo las personas que aceptaste como amigos." },
  { id: "privado", nombre: "Privado", detalle: "Nadie ve tu foto ni tus secciones; solo tu apodo." },
];

const SECCIONES: { id: keyof Omit<Privacidad, "visibilidad">; nombre: string }[] = [
  { id: "mostrar_tiempo", nombre: "Tiempo de lectura de la semana" },
  { id: "mostrar_favoritos", nombre: "Libros favoritos" },
  { id: "mostrar_resenas", nombre: "Mis reseñas" },
  { id: "mostrar_gustos", nombre: "Mis gustos (autores preferidos)" },
];

export function EditorPrivacidad({ inicial }: { inicial: Privacidad }) {
  const [p, setP] = useState(inicial);
  const [aviso, setAviso] = useState("");
  const [, iniciar] = useTransition();

  // Cada cambio se guarda al momento.
  function cambiar(nuevo: Privacidad) {
    const anterior = p;
    setP(nuevo);
    setAviso("Guardando…");
    iniciar(async () => {
      const r = await guardarPrivacidad(nuevo).catch(() => ({ ok: false as const, error: "Sin conexión." }));
      if (r.ok) setAviso("Guardado.");
      else {
        setP(anterior);
        setAviso(r.error);
      }
    });
  }

  return (
    <div className="flex flex-col gap-5">
      <fieldset>
        <legend className="font-semibold">¿Quién puede ver tu perfil?</legend>
        <div className="mt-2 grid gap-2 sm:grid-cols-3">
          {OPCIONES.map((o) => (
            <label
              key={o.id}
              className={`cursor-pointer rounded-xl border-2 p-3 transition-colors ${
                p.visibilidad === o.id ? "border-naranja bg-naranja/10" : "border-borde hover:border-naranja/60"
              }`}
            >
              <input
                type="radio"
                name="visibilidad"
                value={o.id}
                checked={p.visibilidad === o.id}
                onChange={() => cambiar({ ...p, visibilidad: o.id })}
                className="sr-only"
              />
              <span className="block font-semibold">{o.nombre}</span>
              <span className="block text-sm text-tenue">{o.detalle}</span>
            </label>
          ))}
        </div>
      </fieldset>

      <fieldset disabled={p.visibilidad === "privado"} className="disabled:opacity-50">
        <legend className="font-semibold">Qué se muestra en tu perfil</legend>
        <div className="mt-2 flex flex-col gap-2">
          {SECCIONES.map((s) => (
            <label key={s.id} className="flex min-h-11 cursor-pointer items-center justify-between gap-4 rounded-xl border border-borde px-4">
              <span>{s.nombre}</span>
              <input
                type="checkbox"
                role="switch"
                checked={p[s.id]}
                onChange={(e) => cambiar({ ...p, [s.id]: e.target.checked })}
                className="size-5 accent-naranja"
              />
            </label>
          ))}
        </div>
        <p className="mt-2 text-xs text-tenue">
          Tus reseñas siempre se ven en la página de cada libro, con tu apodo.
        </p>
      </fieldset>

      <p role="status" aria-live="polite" className="min-h-5 text-sm text-tenue">
        {aviso}
      </p>
    </div>
  );
}
