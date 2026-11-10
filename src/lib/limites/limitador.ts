// LIMITADOR: lleva la cuenta de cuántas veces hace algo cada visitante en
// un periodo, y dice "no" cuando se pasa. Vive en la memoria del servidor
// (al reiniciar se borra), así que es para límites cortos: minutos u horas.
//
// Este archivo no depende de nada de Next.js para que también lo pueda
// usar el proxy.

type Regla = {
  maximo: number; // cuántas veces se permite…
  ventanaMs: number; // …en este periodo (en milisegundos)
};

// Para que un ataque con millones de IP distintas no llene la memoria:
// al pasar de este número se olvidan las más antiguas.
const MAX_VISITANTES = 20_000;

export function crearLimitador({ maximo, ventanaMs }: Regla) {
  // clave (normalmente la IP) → momentos en que lo hizo
  const marcas = new Map<string, number[]>();

  // Devuelve true si se permite (y lo anota), false si ya se pasó.
  return function permitir(clave: string): boolean {
    const ahora = Date.now();
    const recientes = (marcas.get(clave) ?? []).filter((t) => ahora - t < ventanaMs);

    if (recientes.length >= maximo) {
      marcas.set(clave, recientes);
      return false;
    }

    recientes.push(ahora);
    // Se borra y se vuelve a poner para que quede como "el más reciente".
    marcas.delete(clave);
    marcas.set(clave, recientes);
    if (marcas.size > MAX_VISITANTES) {
      const masAntiguo = marcas.keys().next().value;
      if (masAntiguo !== undefined) marcas.delete(masAntiguo);
    }
    return true;
  };
}

// IP real de quien visita.
// Detrás de Cloudflare, la IP del visitante llega en CF-Connecting-IP.
// Cloudflare la escribe él mismo, así que nadie la puede falsificar al
// pasar por el túnel. Sin Cloudflare (pruebas en la laptop) queda "local".
export function ipDesdeEncabezados(encabezados: Headers): string {
  const deCloudflare = encabezados.get("cf-connecting-ip")?.trim();
  if (deCloudflare) return deCloudflare;
  const reenviada = encabezados.get("x-forwarded-for")?.split(",")[0]?.trim();
  return reenviada || "local";
}
