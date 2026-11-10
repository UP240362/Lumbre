"use client";

// Los cuatro formularios de acceso. Cada uno llama a una acción del servidor
// (acciones.ts) y muestra el error o mensaje que esta le devuelve.

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useActionState } from "react";
import {
  cambiarContrasena,
  crearCuenta,
  iniciarSesion,
  pedirRecuperacion,
} from "./acciones";
import type { EstadoFormulario } from "./tipos";

const INICIAL: EstadoFormulario = {};

// ── Piezas compartidas ──────────────────────────────────────────────

function Campo({
  etiqueta,
  nombre,
  ...resto
}: {
  etiqueta: string;
  nombre: string;
} & React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <label className="flex flex-col gap-2 text-sm font-medium text-orilla-texto">
      {etiqueta}
      <input
        name={nombre}
        required
        className="h-12 rounded-xl border border-orilla-borde bg-negro px-4 text-base font-normal text-orilla-texto placeholder:text-orilla-tenue/60"
        {...resto}
      />
    </label>
  );
}

function Avisos({ estado }: { estado: EstadoFormulario }) {
  return (
    <div aria-live="polite">
      {estado.error && (
        <p className="rounded-xl border border-red-500/50 bg-red-500/10 px-4 py-3 text-sm text-red-200">
          {estado.error}
        </p>
      )}
      {estado.mensaje && (
        <p className="rounded-xl border border-naranja/50 bg-naranja/10 px-4 py-3 text-sm text-orilla-texto">
          {estado.mensaje}
        </p>
      )}
    </div>
  );
}

function BotonEnviar({
  enviando,
  children,
}: {
  enviando: boolean;
  children: React.ReactNode;
}) {
  return (
    <button
      type="submit"
      disabled={enviando}
      className="boton-primario h-13 w-full disabled:opacity-60"
    >
      {enviando ? "Un momento…" : children}
    </button>
  );
}

const enlace = "font-medium text-naranja underline underline-offset-4";

// ── Formularios ─────────────────────────────────────────────────────

export function FormularioLogin() {
  const [estado, accion, enviando] = useActionState(iniciarSesion, INICIAL);
  // Si un enlace de correo falló, /auth/callback nos manda aquí con ?aviso=enlace
  const enlaceFallido = useSearchParams().get("aviso") === "enlace";

  return (
    <form action={accion} className="flex flex-col gap-5">
      {enlaceFallido && !estado.error && (
        <p className="rounded-xl border border-orilla-borde px-4 py-3 text-sm text-orilla-tenue">
          No pudimos abrir ese enlace aquí. Si ya confirmaste tu correo, inicia
          sesión; si no, pide un enlace nuevo.
        </p>
      )}
      <Campo
        etiqueta="Correo electrónico"
        nombre="correo"
        type="email"
        autoComplete="email"
        placeholder="tu@correo.com"
        defaultValue={estado.correo}
      />
      <div className="flex flex-col gap-2">
        <Campo
          etiqueta="Contraseña"
          nombre="contrasena"
          type="password"
          autoComplete="current-password"
        />
        <Link href="/recuperar" className={`${enlace} self-end text-sm`}>
          ¿Olvidaste tu contraseña?
        </Link>
      </div>
      <Avisos estado={estado} />
      <BotonEnviar enviando={enviando}>Entrar</BotonEnviar>
      <p className="text-center text-sm text-orilla-tenue">
        ¿Aún no tienes cuenta?{" "}
        <Link href="/crear-cuenta" className={enlace}>
          Crear cuenta
        </Link>
      </p>
    </form>
  );
}

export function FormularioCrearCuenta() {
  const [estado, accion, enviando] = useActionState(crearCuenta, INICIAL);

  // Cuando la cuenta ya se creó, solo mostramos el mensaje.
  if (estado.mensaje) {
    return (
      <div className="flex flex-col gap-5">
        <Avisos estado={estado} />
        <Link href="/login" className={`${enlace} text-center text-sm`}>
          Ir a iniciar sesión
        </Link>
      </div>
    );
  }

  return (
    <form action={accion} className="flex flex-col gap-5">
      <Campo
        etiqueta="Nombre"
        nombre="nombre"
        autoComplete="given-name"
        placeholder="¿Cómo te llamas?"
        defaultValue={estado.nombre}
      />
      <Campo
        etiqueta="Correo electrónico"
        nombre="correo"
        type="email"
        autoComplete="email"
        placeholder="tu@correo.com"
        defaultValue={estado.correo}
      />
      <Campo
        etiqueta="Contraseña"
        nombre="contrasena"
        type="password"
        autoComplete="new-password"
        minLength={8}
        placeholder="Mínimo 8 caracteres"
      />
      <Avisos estado={estado} />
      <BotonEnviar enviando={enviando}>Crear cuenta</BotonEnviar>
      <p className="text-center text-sm text-orilla-tenue">
        ¿Ya tienes cuenta?{" "}
        <Link href="/login" className={enlace}>
          Inicia sesión
        </Link>
      </p>
    </form>
  );
}

export function FormularioRecuperar() {
  const [estado, accion, enviando] = useActionState(pedirRecuperacion, INICIAL);

  return (
    <form action={accion} className="flex flex-col gap-5">
      <p className="text-sm text-orilla-tenue">
        Escribe tu correo y te enviaremos un enlace para elegir una contraseña
        nueva.
      </p>
      <Campo
        etiqueta="Correo electrónico"
        nombre="correo"
        type="email"
        autoComplete="email"
        placeholder="tu@correo.com"
        defaultValue={estado.correo}
      />
      <Avisos estado={estado} />
      <BotonEnviar enviando={enviando}>Enviar enlace</BotonEnviar>
      <Link href="/login" className={`${enlace} text-center text-sm`}>
        Volver a iniciar sesión
      </Link>
    </form>
  );
}

export function FormularioNuevaContrasena() {
  const [estado, accion, enviando] = useActionState(cambiarContrasena, INICIAL);

  return (
    <form action={accion} className="flex flex-col gap-5">
      <Campo
        etiqueta="Nueva contraseña"
        nombre="contrasena"
        type="password"
        autoComplete="new-password"
        minLength={8}
        placeholder="Mínimo 8 caracteres"
      />
      <Avisos estado={estado} />
      <BotonEnviar enviando={enviando}>Guardar contraseña</BotonEnviar>
    </form>
  );
}
