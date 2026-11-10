// Ajustes finales a la lista de capítulos, comunes a todos los formatos.

import type { Capitulo } from "./tipos";

const MAXIMO = 45000; // letras: más que esto es demasiado para una pantalla
const IDEAL = 15000; // tamaño de cada parte al dividir

export function largoDe(capitulo: Capitulo): number {
  return capitulo.parrafos.reduce((suma, p) => suma + p.length, 0);
}

// - Quita capítulos vacíos.
// - Divide en partes los capítulos enormes (o el libro entero, cuando no se
//   detectó ningún capítulo), cortando siempre entre párrafos.
export function repartir(capitulos: Capitulo[]): Capitulo[] {
  const conTexto = capitulos.filter((c) => c.parrafos.length > 0);
  const resultado: Capitulo[] = [];

  for (const capitulo of conTexto) {
    if (largoDe(capitulo) <= MAXIMO) {
      resultado.push(capitulo);
      continue;
    }

    const partes: string[][] = [[]];
    let llevado = 0;
    for (const parrafo of capitulo.parrafos) {
      if (llevado >= IDEAL) {
        partes.push([]);
        llevado = 0;
      }
      partes[partes.length - 1].push(parrafo);
      llevado += parrafo.length;
    }

    partes.forEach((parrafos, i) => {
      const base = capitulo.titulo || "Parte";
      resultado.push({
        titulo: partes.length > 1 ? `${base} (${i + 1} de ${partes.length})` : base,
        parrafos,
      });
    });
  }

  // Los capítulos sin título reciben uno genérico.
  return resultado.map((c, i) => ({
    ...c,
    titulo: c.titulo || (i === 0 ? "Inicio" : `Parte ${i + 1}`),
  }));
}
