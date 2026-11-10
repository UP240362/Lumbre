// LÍMITES POR IP para que nadie abuse del sitio ni lo tumbe.
//
// 1. Límites cortos (en memoria): cuántas veces se puede intentar algo
//    por minuto u hora desde una misma IP.
// 2. Límite de cuentas nuevas (guardado en un archivo): cuántas cuentas se
//    pueden crear desde una misma IP en 24 horas. Se guarda en disco para
//    que no se reinicie el conteo al reiniciar el servidor. Las IP no se
//    guardan tal cual, sino como una "huella" (hash) que no se puede
//    revertir.

import { createHash } from "node:crypto";
import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import path from "node:path";
import { headers } from "next/headers";
import { crearLimitador, ipDesdeEncabezados } from "./limitador";

const MINUTO = 60_000;
const HORA = 60 * MINUTO;

export const limites = {
  // Intentos de iniciar sesión (frena a quien prueba contraseñas).
  login: crearLimitador({ maximo: 10, ventanaMs: 10 * MINUTO }),
  // Intentos de crear cuenta (incluye los que fallan).
  registro: crearLimitador({ maximo: 10, ventanaMs: HORA }),
  // Correos de recuperar contraseña.
  recuperacion: crearLimitador({ maximo: 5, ventanaMs: HORA }),
  // Libros propios agregados (descargar y leer un PDF cuesta trabajo).
  libros: crearLimitador({ maximo: 20, ventanaMs: HORA }),
  // Búsquedas en el catálogo (cada una consulta tres sitios).
  busqueda: crearLimitador({ maximo: 60, ventanaMs: MINUTO }),
};

export async function ipDelVisitante(): Promise<string> {
  return ipDesdeEncabezados(await headers());
}

// ── Cuentas nuevas por IP ────────────────────────────────────────────

export const MAX_CUENTAS_POR_IP = 3;
const VENTANA_CUENTAS = 24 * HORA;

// En Docker, /app/datos es un volumen que sobrevive a los reinicios.
// En la laptop (npm run dev) es la carpeta "datos" del proyecto.
const CARPETA = process.env.LUMBRE_DATOS ?? path.join(process.cwd(), "datos");
const ARCHIVO = path.join(CARPETA, "cuentas-por-ip.json");

// huella de la IP → momentos en que se creó una cuenta
let cuentas: Map<string, number[]> | null = null;

function huella(ip: string): string {
  return createHash("sha256").update(`lumbre:${ip}`).digest("hex");
}

async function cargar(): Promise<Map<string, number[]>> {
  if (cuentas) return cuentas;
  try {
    const guardado: Record<string, number[]> = JSON.parse(await readFile(ARCHIVO, "utf8"));
    cuentas = new Map(Object.entries(guardado));
  } catch {
    cuentas = new Map(); // primera vez, o archivo dañado
  }
  return cuentas;
}

async function guardar(mapa: Map<string, number[]>) {
  // Se escribe en un archivo temporal y luego se renombra, para que un
  // apagón a media escritura no deje el archivo roto.
  await mkdir(CARPETA, { recursive: true });
  const temporal = `${ARCHIVO}.tmp`;
  await writeFile(temporal, JSON.stringify(Object.fromEntries(mapa)));
  await rename(temporal, ARCHIVO);
}

// Aparta un lugar para crear una cuenta desde esta IP.
// Devuelve false si ya se crearon MAX_CUENTAS_POR_IP en 24 horas.
export async function reservarCuenta(ip: string): Promise<boolean> {
  const mapa = await cargar();
  const ahora = Date.now();
  const clave = huella(ip);
  const recientes = (mapa.get(clave) ?? []).filter((t) => ahora - t < VENTANA_CUENTAS);
  if (recientes.length >= MAX_CUENTAS_POR_IP) return false;

  recientes.push(ahora);
  mapa.set(clave, recientes);
  // De paso se olvidan las IP que ya no tienen cuentas recientes.
  for (const [otra, marcas] of mapa) {
    if (marcas.every((t) => ahora - t >= VENTANA_CUENTAS)) mapa.delete(otra);
  }
  await guardar(mapa).catch(() => {});
  return true;
}

// Devuelve el lugar apartado si al final la cuenta no se creó.
export async function liberarCuenta(ip: string): Promise<void> {
  const mapa = await cargar();
  const clave = huella(ip);
  const marcas = mapa.get(clave);
  if (!marcas?.length) return;
  marcas.pop();
  if (marcas.length === 0) mapa.delete(clave);
  await guardar(mapa).catch(() => {});
}
