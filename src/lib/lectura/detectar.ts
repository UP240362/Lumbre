// Recibe los bytes de un archivo cualquiera, averigua qué formato es y lo
// convierte en capítulos con el convertidor que corresponda.
// Se usa para los libros propios (archivos subidos y enlaces), donde no se
// sabe de antemano qué va a llegar.

import { epubACapitulos } from "./epub";
import { htmlACapitulos } from "./html";
import { pdfACapitulos } from "./pdf";
import { textoACapitulos } from "./textoPlano";
import type { Capitulo } from "./tipos";

function empiezaCon(datos: Uint8Array, firma: string): boolean {
  return [...firma].every((letra, i) => datos[i] === letra.charCodeAt(0));
}

// Convierte bytes en texto respetando la codificación que declare la página
// (muchas páginas antiguas en español usan "latin1" en vez de UTF-8).
function comoTexto(datos: Uint8Array, tipo: string): string {
  const inicio = new TextDecoder("latin1").decode(datos.subarray(0, 2048));
  const declarada =
    tipo.match(/charset=([\w-]+)/i)?.[1] ??
    inicio.match(/<meta[^>]+charset=["']?([\w-]+)/i)?.[1] ??
    "utf-8";
  try {
    return new TextDecoder(declarada).decode(datos);
  } catch {
    return new TextDecoder("utf-8").decode(datos);
  }
}

// De una página web se intenta tomar solo el contenido principal, sin
// menús, barras laterales ni formularios.
function contenidoPrincipal(html: string): string {
  const sinAdornos = html.replace(
    /<(nav|aside|form|footer|header|noscript|iframe|button)\b[\s\S]*?<\/\1>/gi,
    "",
  );
  return (
    sinAdornos.match(/<article\b[^>]*>([\s\S]*)<\/article>/i)?.[1] ??
    sinAdornos.match(/<main\b[^>]*>([\s\S]*)<\/main>/i)?.[1] ??
    sinAdornos
  );
}

export async function archivoACapitulos(
  datos: Uint8Array,
  tipo = "", // el "Content-Type" que dijo el servidor, si se conoce
): Promise<Capitulo[]> {
  // Los primeros bytes delatan el formato: todo PDF empieza con "%PDF" y
  // todo ZIP (un ePub es un ZIP) con "PK".
  if (empiezaCon(datos, "%PDF")) return pdfACapitulos(datos);
  if (empiezaCon(datos, "PK")) return epubACapitulos(datos);

  const texto = comoTexto(datos, tipo);
  const esHtml = /html/i.test(tipo) || /<(html|body|p|div)\b/i.test(texto.slice(0, 5000));
  return esHtml
    ? htmlACapitulos(contenidoPrincipal(texto))
    : textoACapitulos(texto);
}
