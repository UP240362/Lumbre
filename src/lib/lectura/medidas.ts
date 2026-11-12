// Lee el ancho y alto de una imagen mirando solo sus primeros bytes, sin
// abrirla completa. Sirve para apartar su lugar en la página antes de que
// cargue (así el texto no brinca). Entiende PNG, JPEG, GIF y WebP.

export function medidasImagen(
  datos: Uint8Array,
): { ancho: number; alto: number } | null {
  const v = new DataView(datos.buffer, datos.byteOffset, datos.byteLength);
  const largo = datos.length;
  const ok = (ancho: number, alto: number) =>
    ancho > 0 && alto > 0 ? { ancho, alto } : null;

  // PNG: firma de 8 bytes y el bloque IHDR con el tamaño.
  if (largo >= 24 && v.getUint32(0) === 0x89504e47) {
    return ok(v.getUint32(16), v.getUint32(20));
  }
  // GIF: "GIF8" y el tamaño en los bytes 6-9.
  if (largo >= 10 && v.getUint32(0) === 0x47494638) {
    return ok(v.getUint16(6, true), v.getUint16(8, true));
  }
  // WebP: "RIFF....WEBP" y uno de sus tres formatos.
  if (largo >= 30 && v.getUint32(0) === 0x52494646 && v.getUint32(8) === 0x57454250) {
    const formato = v.getUint32(12);
    if (formato === 0x56503820) {
      // "VP8 "
      return ok(v.getUint16(26, true) & 0x3fff, v.getUint16(28, true) & 0x3fff);
    }
    if (formato === 0x5650384c) {
      // "VP8L"
      const bits = v.getUint32(21, true);
      return ok((bits & 0x3fff) + 1, ((bits >> 14) & 0x3fff) + 1);
    }
    if (formato === 0x56503858) {
      // "VP8X"
      const ancho = 1 + (datos[24] | (datos[25] << 8) | (datos[26] << 16));
      const alto = 1 + (datos[27] | (datos[28] << 8) | (datos[29] << 16));
      return ok(ancho, alto);
    }
    return null;
  }
  // JPEG: se recorren sus bloques hasta el que trae el tamaño (SOFn).
  if (largo >= 4 && v.getUint16(0) === 0xffd8) {
    let i = 2;
    while (i + 9 < largo) {
      if (datos[i] !== 0xff) {
        i++;
        continue;
      }
      const marca = datos[i + 1];
      if (marca === 0xff) {
        i++;
        continue;
      }
      const esTamano =
        marca >= 0xc0 && marca <= 0xcf && marca !== 0xc4 && marca !== 0xc8 && marca !== 0xcc;
      if (esTamano) return ok(v.getUint16(i + 7), v.getUint16(i + 5));
      i += 2 + v.getUint16(i + 2);
    }
  }
  return null;
}
