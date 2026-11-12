"use client";

// TIEMPO DE LECTURA (lado del navegador)
// Cuenta el tiempo SOLO mientras hay un libro abierto, la pestaña está a la
// vista y la persona está leyendo: movió la página, tocó la pantalla o
// presionó una tecla en los últimos 3 minutos, o está escuchando la voz.
// Si deja el teléfono sobre la mesa, el conteo se detiene solo.
//
// Los segundos se juntan en localStorage y se mandan al servidor cada
// minuto, al ocultar la pestaña y al salir del libro. Si no hay internet
// se quedan guardados y se mandan después (también desde la lectura sin
// conexión). Cada entrada lleva el dueño, para no sumarle tiempo a otra
// cuenta si alguien más inicia sesión en el mismo teléfono.

import { useEffect, useRef } from "react";

const PENDIENTE = "lumbre-tiempo-pendiente";
const PASO_MS = 5_000; // cada cuánto se revisa si se está leyendo
const ENVIAR_CADA_MS = 60_000;
const INACTIVO_MS = 3 * 60_000;

type Entrada = { dueno: string; dia: string; fuente: string; id: string; segundos: number };

// Fecha local "2026-11-12" (la semana y el mes se cuentan con ella).
export const diaLocal = (fecha = new Date()) =>
  `${fecha.getFullYear()}-${String(fecha.getMonth() + 1).padStart(2, "0")}-${String(fecha.getDate()).padStart(2, "0")}`;

function leer(): Entrada[] {
  try {
    const lista = JSON.parse(localStorage.getItem(PENDIENTE) ?? "[]");
    return Array.isArray(lista) ? lista : [];
  } catch {
    return [];
  }
}

function escribir(lista: Entrada[]) {
  try {
    if (lista.length === 0) localStorage.removeItem(PENDIENTE);
    else localStorage.setItem(PENDIENTE, JSON.stringify(lista.slice(-200)));
  } catch {}
}

function sumar(lista: Entrada[], nueva: Entrada): Entrada[] {
  const igual = lista.find(
    (e) =>
      e.dueno === nueva.dueno && e.dia === nueva.dia && e.fuente === nueva.fuente && e.id === nueva.id,
  );
  if (igual) igual.segundos += nueva.segundos;
  else lista.push({ ...nueva });
  return lista;
}

function anotar(entrada: Entrada) {
  escribir(sumar(leer(), entrada));
}

let enviando = false;

// Quita de la lista lo que ya se mandó (lo que se anotó mientras tanto se queda).
function restar(enviadas: Entrada[]) {
  const lista = leer();
  for (const e of enviadas) {
    const igual = lista.find(
      (x) => x.dueno === e.dueno && x.dia === e.dia && x.fuente === e.fuente && x.id === e.id,
    );
    if (igual) igual.segundos -= e.segundos;
  }
  escribir(lista.filter((x) => x.segundos > 0));
}

// Manda al servidor lo pendiente. La lista solo se descuenta cuando el
// servidor contesta; si falla, todo se queda para el siguiente intento.
export async function enviarTiempoPendiente(): Promise<void> {
  if (enviando) return;
  const lote = leer().slice(0, 50);
  if (lote.length === 0) return;
  enviando = true;
  try {
    const respuesta = await fetch("/api/tiempo", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ entradas: lote }),
    });
    // 5xx o 429: se reintenta luego. Otros errores (por ejemplo, la sesión
    // se cerró) no se arreglan reintentando, así que se descartan.
    if (respuesta.status < 500 && respuesta.status !== 429) restar(lote);
  } catch {
    // Sin internet: se queda en la lista.
  } finally {
    enviando = false;
  }
}

// Al salir o cerrar la página: sendBeacon entrega el aviso aunque la
// página ya no exista. Si el navegador lo acepta, se descuenta de la lista.
function enviarAlSalir() {
  if (enviando || !("sendBeacon" in navigator)) return;
  const lote = leer().slice(0, 50);
  if (lote.length === 0) return;
  const cuerpo = new Blob([JSON.stringify({ entradas: lote })], { type: "application/json" });
  if (navigator.sendBeacon("/api/tiempo", cuerpo)) restar(lote);
}

export function borrarTiempoPendiente() {
  escribir([]);
}

export function useTiempoLectura({
  dueno,
  fuente,
  id,
  escuchando,
}: {
  dueno: string;
  fuente: string;
  id: string;
  escuchando: boolean;
}) {
  const ultimaActividad = useRef(0);
  const oyendo = useRef(escuchando);

  useEffect(() => {
    oyendo.current = escuchando;
  }, [escuchando]);

  useEffect(() => {
    ultimaActividad.current = performance.now();
    const activo = () => (ultimaActividad.current = performance.now());
    const eventos = ["scroll", "pointerdown", "keydown", "wheel", "touchstart"] as const;
    eventos.forEach((e) => window.addEventListener(e, activo, { passive: true }));

    const reloj = setInterval(() => {
      const leyendo =
        document.visibilityState === "visible" &&
        (oyendo.current || performance.now() - ultimaActividad.current < INACTIVO_MS);
      if (leyendo) anotar({ dueno, dia: diaLocal(), fuente, id, segundos: PASO_MS / 1000 });
    }, PASO_MS);

    const envio = setInterval(() => void enviarTiempoPendiente(), ENVIAR_CADA_MS);
    const alOcultar = () => {
      if (document.visibilityState === "hidden") enviarAlSalir();
      else activo(); // volver a la pestaña cuenta como actividad
    };
    document.addEventListener("visibilitychange", alOcultar);
    window.addEventListener("pagehide", enviarAlSalir);

    return () => {
      eventos.forEach((e) => window.removeEventListener(e, activo));
      clearInterval(reloj);
      clearInterval(envio);
      document.removeEventListener("visibilitychange", alOcultar);
      window.removeEventListener("pagehide", enviarAlSalir);
      void enviarTiempoPendiente(); // cambio de capítulo o de página dentro del sitio
    };
  }, [dueno, fuente, id]);
}
