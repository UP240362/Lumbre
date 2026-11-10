// Descarga un enlace que escribió un usuario.
//
// Esto es delicado: el servidor va a visitar una dirección que alguien más
// eligió. Sin cuidado, esa persona podría hacer que el servidor visite
// direcciones internas (la propia computadora o la red local) y leer cosas
// que no debe. Por eso, antes de cada visita se revisa que la dirección
// sea pública, y lo mismo en cada redirección.

import { lookup } from "node:dns/promises";
import { isIP } from "node:net";

const AGENTE = "Lumbre/0.1 (lector de libros de dominio publico)";
const TAMANO_MAXIMO = 40 * 1024 * 1024; // 40 MB
const MAX_REDIRECCIONES = 5;

export class EnlaceNoPermitido extends Error {}

// ¿La dirección IP es interna (no pública)?
function esPrivada(ip: string): boolean {
  if (isIP(ip) === 6) {
    const v6 = ip.toLowerCase();
    if (v6.startsWith("::ffff:")) return esPrivada(v6.slice(7));
    return (
      v6 === "::1" || v6 === "::" ||
      v6.startsWith("fc") || v6.startsWith("fd") || // red local
      v6.startsWith("fe8") || v6.startsWith("fe9") ||
      v6.startsWith("fea") || v6.startsWith("feb")
    );
  }
  const [a, b] = ip.split(".").map(Number);
  return (
    a === 0 || a === 10 || a === 127 ||
    (a === 169 && b === 254) ||
    (a === 172 && b >= 16 && b <= 31) ||
    (a === 192 && b === 168) ||
    (a === 100 && b >= 64 && b <= 127) ||
    a >= 224
  );
}

// Revisa que la dirección sea http(s) y apunte a un servidor público.
export async function validarEnlace(direccion: string): Promise<URL> {
  let url: URL;
  try {
    url = new URL(direccion);
  } catch {
    throw new EnlaceNoPermitido("La dirección no es válida");
  }
  if (url.protocol !== "http:" && url.protocol !== "https:") {
    throw new EnlaceNoPermitido("Solo se aceptan enlaces http o https");
  }
  if (url.username || url.password) {
    throw new EnlaceNoPermitido("El enlace no puede llevar usuario ni contraseña");
  }

  const host = url.hostname.replace(/^\[|\]$/g, "");
  const ips = isIP(host)
    ? [host]
    : (await lookup(host, { all: true }).catch(() => [])).map((r) => r.address);
  if (ips.length === 0) {
    throw new EnlaceNoPermitido("No se encontró ese sitio");
  }
  if (ips.some(esPrivada)) {
    throw new EnlaceNoPermitido("Ese enlace apunta a una dirección interna");
  }
  return url;
}

export async function descargarExterno(
  direccion: string,
): Promise<{ datos: Uint8Array; tipo: string }> {
  let url = await validarEnlace(direccion);

  for (let salto = 0; salto <= MAX_REDIRECCIONES; salto++) {
    const respuesta = await fetch(url, {
      headers: { "User-Agent": AGENTE },
      // Las redirecciones se siguen a mano, para revisar cada destino.
      redirect: "manual",
      signal: AbortSignal.timeout(30000),
    });

    const destino = respuesta.headers.get("location");
    if (respuesta.status >= 300 && respuesta.status < 400 && destino) {
      url = await validarEnlace(new URL(destino, url).href);
      continue;
    }
    if (!respuesta.ok) {
      throw new Error(`El sitio respondió ${respuesta.status}`);
    }

    const declarado = Number(respuesta.headers.get("content-length") ?? 0);
    if (declarado > TAMANO_MAXIMO) throw new Error("El archivo es demasiado grande");

    const datos = new Uint8Array(await respuesta.arrayBuffer());
    if (datos.byteLength > TAMANO_MAXIMO) {
      throw new Error("El archivo es demasiado grande");
    }
    return { datos, tipo: respuesta.headers.get("content-type") ?? "" };
  }
  throw new Error("Demasiadas redirecciones");
}
