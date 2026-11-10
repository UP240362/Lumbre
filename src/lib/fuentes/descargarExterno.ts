// Descarga un enlace que escribió un usuario.
//
// Esto es delicado: el servidor va a visitar una dirección que alguien más
// eligió. Sin cuidado, esa persona podría hacer que el servidor visite
// direcciones internas (la propia computadora o la red local) y leer cosas
// que no debe. Por eso se revisa que la dirección sea pública:
//
//   1. Antes de empezar (validarEnlace), para dar un mensaje claro.
//   2. Justo al conectarse (buscarDireccionSegura), que es la revisión que
//      de verdad protege. Hace falta porque un sitio malicioso puede dar
//      una dirección pública la primera vez que se pregunta por él y una
//      interna la segunda ("DNS rebinding"). Aquí se revisa la dirección
//      exacta a la que se va a conectar, sin volver a preguntar después.
//
// Lo mismo se hace en cada redirección.

import { lookup as buscarDns, type LookupAddress } from "node:dns";
import { lookup } from "node:dns/promises";
import http from "node:http";
import https from "node:https";
import { isIP, type LookupFunction } from "node:net";

const AGENTE = "Lumbre/0.1 (lector de libros de dominio publico)";
const TAMANO_MAXIMO = 40 * 1024 * 1024; // 40 MB
const TIEMPO_MAXIMO = 30_000; // 30 segundos por descarga
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
    (a === 198 && (b === 18 || b === 19)) ||
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

// Reemplaza la búsqueda de direcciones que hace Node al conectarse: busca
// la dirección del sitio y, si alguna es interna, cancela la conexión.
// La dirección revisada es exactamente la que se usa para conectarse.
const buscarDireccionSegura: LookupFunction = (sitio, opciones, responder) => {
  buscarDns(sitio, { ...opciones, all: true }, (error, direcciones) => {
    const lista = direcciones as LookupAddress[];
    if (error) {
      responder(error, "", 0);
      return;
    }
    if (lista.length === 0 || lista.some((d) => esPrivada(d.address))) {
      responder(
        new EnlaceNoPermitido("Ese enlace apunta a una dirección interna"),
        "",
        0,
      );
      return;
    }
    // Node a veces pide todas las direcciones y a veces solo una.
    if (opciones.all) {
      (responder as unknown as (e: null, d: LookupAddress[]) => void)(null, lista);
    } else {
      responder(null, lista[0].address, lista[0].family);
    }
  });
};

type Respuesta = {
  estado: number;
  ubicacion: string | null; // a dónde redirige, si redirige
  tipo: string; // "Content-Type"
  datos: Uint8Array;
};

// Hace una sola petición GET, con la búsqueda segura, tiempo límite y
// tamaño máximo. No sigue redirecciones: las devuelve para revisarlas.
export function pedirSeguro(url: URL): Promise<Respuesta> {
  return new Promise((resolver, rechazar) => {
    const modulo = url.protocol === "https:" ? https : http;
    let terminado = false;
    const terminar = (error: Error | null, respuesta?: Respuesta) => {
      if (terminado) return;
      terminado = true;
      clearTimeout(reloj);
      if (error) rechazar(error);
      else resolver(respuesta!);
    };

    const solicitud = modulo.request(
      url,
      {
        method: "GET",
        headers: { "User-Agent": AGENTE, Accept: "*/*" },
        lookup: buscarDireccionSegura,
      },
      (respuesta) => {
        const estado = respuesta.statusCode ?? 0;
        const ubicacion = respuesta.headers.location ?? null;
        const tipo = String(respuesta.headers["content-type"] ?? "");

        if (estado >= 300 && estado < 400) {
          respuesta.resume(); // se descarta el cuerpo de la redirección
          terminar(null, { estado, ubicacion, tipo, datos: new Uint8Array() });
          return;
        }
        if (Number(respuesta.headers["content-length"] ?? 0) > TAMANO_MAXIMO) {
          respuesta.destroy();
          terminar(new Error("El archivo es demasiado grande"));
          return;
        }

        const trozos: Buffer[] = [];
        let total = 0;
        respuesta.on("data", (trozo: Buffer) => {
          total += trozo.length;
          if (total > TAMANO_MAXIMO) {
            respuesta.destroy();
            terminar(new Error("El archivo es demasiado grande"));
            return;
          }
          trozos.push(trozo);
        });
        respuesta.on("end", () =>
          terminar(null, {
            estado,
            ubicacion,
            tipo,
            datos: new Uint8Array(Buffer.concat(trozos)),
          }),
        );
        respuesta.on("error", (error) => terminar(error));
      },
    );

    const reloj = setTimeout(() => {
      solicitud.destroy(new Error("El sitio tardó demasiado en responder"));
    }, TIEMPO_MAXIMO);
    solicitud.on("error", (error) => terminar(error));
    solicitud.end();
  });
}

export async function descargarExterno(
  direccion: string,
): Promise<{ datos: Uint8Array; tipo: string }> {
  let url = await validarEnlace(direccion);

  for (let salto = 0; salto <= MAX_REDIRECCIONES; salto++) {
    const respuesta = await pedirSeguro(url);

    // Las redirecciones se siguen a mano, para revisar cada destino.
    if (respuesta.estado >= 300 && respuesta.estado < 400 && respuesta.ubicacion) {
      url = await validarEnlace(new URL(respuesta.ubicacion, url).href);
      continue;
    }
    if (respuesta.estado < 200 || respuesta.estado >= 300) {
      throw new Error(`El sitio respondió ${respuesta.estado}`);
    }
    return { datos: respuesta.datos, tipo: respuesta.tipo };
  }
  throw new Error("Demasiadas redirecciones");
}
