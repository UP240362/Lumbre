// Descarga un archivo de una fuente, con tiempo límite y tamaño máximo,
// para que un libro gigante o un sitio lento no tumben la página.

const AGENTE = "Lumbre/0.1 (lector de libros de dominio publico)";
const TAMANO_MAXIMO = 40 * 1024 * 1024; // 40 MB

// Devuelve null si el archivo no existe (404).
export async function descargar(url: string): Promise<Uint8Array | null> {
  const respuesta = await fetch(url, {
    headers: { "User-Agent": AGENTE },
    signal: AbortSignal.timeout(30000),
  });
  if (respuesta.status === 404) return null;
  if (!respuesta.ok) throw new Error(`${url} respondió ${respuesta.status}`);

  const datos = new Uint8Array(await respuesta.arrayBuffer());
  if (datos.byteLength > TAMANO_MAXIMO) {
    throw new Error("El libro es demasiado grande");
  }
  return datos;
}

export function comoTexto(datos: Uint8Array): string {
  return new TextDecoder("utf-8").decode(datos);
}
