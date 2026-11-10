"use client";

// Guarda y lee las preferencias de lectura (luz y tamaño de letra).
// Viven en dos lugares: en el navegador (localStorage), para aplicarlas al
// instante, y en el perfil de Supabase, para que te sigan a otros dispositivos.

import { useSyncExternalStore } from "react";
import {
  CLAVE_LUZ,
  CLAVE_TAMANO,
  LUZ_INICIAL,
  TAMANO_INICIAL,
  esLuz,
  limitarTamano,
  type Luz,
} from "./luz";
import { crearClienteNavegador } from "./supabase/cliente";

const EVENTO = "lumbre:preferencias";
const CLAVE_PENDIENTE = "lumbre-pendiente";

function leerLuz(): Luz {
  try {
    const valor = localStorage.getItem(CLAVE_LUZ);
    return esLuz(valor) ? valor : LUZ_INICIAL;
  } catch {
    return LUZ_INICIAL;
  }
}

function leerTamano(): number {
  try {
    const valor = localStorage.getItem(CLAVE_TAMANO);
    return valor === null ? TAMANO_INICIAL : limitarTamano(Number(valor));
  } catch {
    return TAMANO_INICIAL;
  }
}

// Pasa las preferencias a <html>, que es de donde las lee el CSS.
function aplicar() {
  const raiz = document.documentElement;
  raiz.dataset.luz = leerLuz();
  raiz.style.setProperty("--tamano-lectura", `${leerTamano()}px`);
}

// React llama a esta función para enterarse de los cambios.
// "storage" avisa cuando la preferencia cambió en otra pestaña.
function suscribir(avisar: () => void) {
  const alCambiar = () => {
    aplicar();
    avisar();
  };
  window.addEventListener(EVENTO, alCambiar);
  window.addEventListener("storage", alCambiar);
  return () => {
    window.removeEventListener(EVENTO, alCambiar);
    window.removeEventListener("storage", alCambiar);
  };
}

// Guarda cambios en el perfil de Supabase. Si nadie ha iniciado sesión
// (por ejemplo, en la pantalla de login), deja una marca de "pendiente"
// para subirlos en cuanto la persona entre.
async function subirAlPerfil(cambios: {
  luz_preferida?: Luz;
  tamano_letra?: number;
}) {
  try {
    const supabase = crearClienteNavegador();
    const { data } = await supabase.auth.getSession();
    const usuario = data.session?.user;
    if (!usuario) {
      localStorage.setItem(CLAVE_PENDIENTE, "1");
      return;
    }
    await supabase.from("profiles").update(cambios).eq("id", usuario.id);
  } catch {}
}

export function guardarLuz(luz: Luz) {
  try {
    localStorage.setItem(CLAVE_LUZ, luz);
  } catch {}
  window.dispatchEvent(new Event(EVENTO));
  void subirAlPerfil({ luz_preferida: luz });
}

export function guardarTamano(tamano: number) {
  const valor = limitarTamano(tamano);
  try {
    localStorage.setItem(CLAVE_TAMANO, String(valor));
  } catch {}
  window.dispatchEvent(new Event(EVENTO));
  void subirAlPerfil({ tamano_letra: valor });
}

// Se llama al entrar a la aplicación, con lo que dice el perfil.
// - Si había cambios pendientes hechos sin sesión, esos ganan y se suben.
// - Si no, el perfil manda y se copia a este navegador.
export function sincronizarConPerfil(luz: Luz, tamano: number) {
  try {
    if (localStorage.getItem(CLAVE_PENDIENTE)) {
      localStorage.removeItem(CLAVE_PENDIENTE);
      void subirAlPerfil({
        luz_preferida: leerLuz(),
        tamano_letra: leerTamano(),
      });
      return;
    }
    localStorage.setItem(CLAVE_LUZ, luz);
    localStorage.setItem(CLAVE_TAMANO, String(limitarTamano(tamano)));
  } catch {}
  window.dispatchEvent(new Event(EVENTO));
}

// Hooks: los componentes los usan para saber la preferencia actual
// y volver a dibujarse cuando cambia.
export function useLuz(): Luz {
  return useSyncExternalStore(suscribir, leerLuz, () => LUZ_INICIAL);
}

export function useTamanoLetra(): number {
  return useSyncExternalStore(suscribir, leerTamano, () => TAMANO_INICIAL);
}
