// Definiciones compartidas de las tres luces y del tamaño de letra.
// Este archivo no usa nada del navegador, así que sirve en servidor y cliente.

export type Luz = "amarilla" | "blanca" | "negra";

export const LUCES: { id: Luz; nombre: string; muestra: string }[] = [
  { id: "amarilla", nombre: "Amarilla", muestra: "#F6E7C1" },
  { id: "blanca", nombre: "Blanca", muestra: "#FFFFFF" },
  { id: "negra", nombre: "Negra", muestra: "#0E0E0E" },
];

export const LUZ_INICIAL: Luz = "amarilla";

export function esLuz(valor: unknown): valor is Luz {
  return valor === "amarilla" || valor === "blanca" || valor === "negra";
}

// Tamaño del texto de lectura, en píxeles.
export const TAMANO_INICIAL = 19;
export const TAMANO_MIN = 15;
export const TAMANO_MAX = 27;
export const TAMANO_PASO = 2;

export function limitarTamano(valor: number): number {
  if (!Number.isFinite(valor)) return TAMANO_INICIAL;
  return Math.min(TAMANO_MAX, Math.max(TAMANO_MIN, Math.round(valor)));
}

// Nombres con los que se guardan las preferencias en el navegador.
export const CLAVE_LUZ = "lumbre-luz";
export const CLAVE_TAMANO = "lumbre-tamano";

// Código que corre ANTES de que se pinte la página (ver layout.tsx).
// Lee las preferencias guardadas y las aplica a <html>, para que no se vea
// un parpadeo de luz amarilla si el usuario eligió otra.
export const SCRIPT_PREFERENCIAS = `(function(){try{var r=document.documentElement;var l=localStorage.getItem("${CLAVE_LUZ}");if(l==="amarilla"||l==="blanca"||l==="negra")r.dataset.luz=l;var t=parseInt(localStorage.getItem("${CLAVE_TAMANO}"),10);if(t>=${TAMANO_MIN}&&t<=${TAMANO_MAX})r.style.setProperty("--tamano-lectura",t+"px")}catch(e){}})()`;
