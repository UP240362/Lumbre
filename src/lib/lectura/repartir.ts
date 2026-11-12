// Ajustes finales a la lista de capítulos, comunes a todos los formatos.

import type { Capitulo, Imagen } from "./tipos";

const MAXIMO = 45000; // letras: más que esto es demasiado para una pantalla
const IDEAL = 15000; // tamaño de cada parte al dividir

export function largoDe(capitulo: Capitulo): number {
  return capitulo.parrafos.reduce((suma, p) => suma + p.length, 0);
}

// Quita los capítulos sin texto. Si traían ilustraciones (una lámina
// suelta, por ejemplo), pasan al inicio del capítulo siguiente.
export function quitarVacios(capitulos: Capitulo[]): Capitulo[] {
  const salida: Capitulo[] = [];
  let sueltas: Imagen[] = [];
  for (const capitulo of capitulos) {
    if (capitulo.parrafos.length === 0) {
      sueltas.push(...(capitulo.imagenes ?? []).map((i) => ({ ...i, antes: 0, pie: undefined })));
      continue;
    }
    if (sueltas.length) {
      capitulo.imagenes = [...sueltas, ...(capitulo.imagenes ?? [])];
      sueltas = [];
    }
    salida.push(capitulo);
  }
  // Si sobran al final, van al final del último capítulo. Si no hay ninguno
  // (una página que solo trae una lámina), se entregan solas: quien llama
  // decide dónde ponerlas.
  const ultimo = salida.at(-1);
  if (sueltas.length && !ultimo) return [{ titulo: "", parrafos: [], imagenes: sueltas }];
  if (sueltas.length && ultimo) {
    ultimo.imagenes = [
      ...(ultimo.imagenes ?? []),
      ...sueltas.map((i) => ({ ...i, antes: ultimo.parrafos.length })),
    ];
  }
  return salida;
}

// - Quita capítulos vacíos.
// - Divide en partes los capítulos enormes (o el libro entero, cuando no se
//   detectó ningún capítulo), cortando siempre entre párrafos.
export function repartir(capitulos: Capitulo[]): Capitulo[] {
  const conTexto = quitarVacios(capitulos);
  const resultado: Capitulo[] = [];

  for (const capitulo of conTexto) {
    if (largoDe(capitulo) <= MAXIMO) {
      resultado.push(capitulo);
      continue;
    }

    // Cada parte recuerda en qué párrafo del capítulo original empieza.
    const partes: { desde: number; parrafos: string[] }[] = [{ desde: 0, parrafos: [] }];
    let llevado = 0;
    capitulo.parrafos.forEach((parrafo, i) => {
      if (llevado >= IDEAL) {
        partes.push({ desde: i, parrafos: [] });
        llevado = 0;
      }
      partes[partes.length - 1].parrafos.push(parrafo);
      llevado += parrafo.length;
    });

    partes.forEach(({ desde, parrafos }, i) => {
      const base = capitulo.titulo || "Parte";
      const hasta = desde + parrafos.length;
      const esUltima = i === partes.length - 1;
      // Cada imagen va en la parte donde está el párrafo que le sigue.
      const imagenes = (capitulo.imagenes ?? [])
        .filter((img) => img.antes >= desde && (img.antes < hasta || esUltima))
        .map((img) => ({
          ...img,
          antes: img.antes - desde,
          pie: img.pie !== undefined && img.pie < hasta ? img.pie - desde : undefined,
        }));
      resultado.push({
        titulo: partes.length > 1 ? `${base} (${i + 1} de ${partes.length})` : base,
        parrafos,
        ...(imagenes.length ? { imagenes } : {}),
      });
    });
  }

  // Los capítulos sin título reciben uno genérico.
  return resultado.map((c, i) => ({
    ...c,
    titulo: c.titulo || (i === 0 ? "Inicio" : `Parte ${i + 1}`),
  }));
}
