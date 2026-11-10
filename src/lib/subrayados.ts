// SUBRAYADOS Y NOTAS: tipos y cálculos compartidos entre el servidor y el
// navegador (este archivo no usa nada exclusivo de ninguno de los dos).

export const MAX_TEXTO = 10000; // letras que puede abarcar un subrayado
export const MAX_NOTA = 5000; // letras que puede tener una nota

// "fondo" es el color del subrayado: semitransparente, para que se lea bien
// sobre las tres luces. "muestra" es el color sólido de los botones.
export const COLORES = {
  amarillo: { nombre: "Amarillo", fondo: "rgba(250, 204, 21, 0.38)", muestra: "#FACC15" },
  naranja: { nombre: "Naranja", fondo: "rgba(242, 107, 15, 0.32)", muestra: "#F26B0F" },
  verde: { nombre: "Verde", fondo: "rgba(74, 222, 128, 0.32)", muestra: "#4ADE80" },
} as const;

export type Color = keyof typeof COLORES;

export function esColor(valor: unknown): valor is Color {
  return typeof valor === "string" && Object.hasOwn(COLORES, valor);
}

// Columnas que se piden a Supabase (las mismas que el tipo de abajo).
export const COLUMNAS_SUBRAYADO =
  "id, capitulo, inicio_parrafo, inicio_offset, fin_parrafo, fin_offset, texto, color, nota";

export type Subrayado = {
  id: string;
  capitulo: number;
  inicio_parrafo: number;
  inicio_offset: number;
  fin_parrafo: number;
  fin_offset: number;
  texto: string;
  color: Color;
  nota: string | null;
};

// Un punto del capítulo: número de párrafo y letra dentro de él.
export type Posicion = { parrafo: number; offset: number };

export type SubrayadoUbicado = {
  subrayado: Subrayado;
  inicio: Posicion;
  fin: Posicion;
};

// El texto que hay entre dos puntos del capítulo.
export function extraerTexto(
  parrafos: string[],
  inicio: Posicion,
  fin: Posicion,
): string {
  if (inicio.parrafo === fin.parrafo) {
    return parrafos[inicio.parrafo]?.slice(inicio.offset, fin.offset) ?? "";
  }
  const partes = [parrafos[inicio.parrafo]?.slice(inicio.offset) ?? ""];
  for (let i = inicio.parrafo + 1; i < fin.parrafo; i++) {
    partes.push(parrafos[i] ?? "");
  }
  partes.push(parrafos[fin.parrafo]?.slice(0, fin.offset) ?? "");
  return partes.filter(Boolean).join("\n\n");
}

// Dice dónde va un subrayado sobre el texto actual del capítulo.
// Normalmente es donde se guardó; pero si el texto del libro cambió (por
// ejemplo, la fuente corrigió una errata), se busca el texto subrayado en
// todo el capítulo. Si ya no aparece, devuelve null y no se pinta.
export function ubicar(
  subrayado: Subrayado,
  parrafos: string[],
): { inicio: Posicion; fin: Posicion } | null {
  const inicio = { parrafo: subrayado.inicio_parrafo, offset: subrayado.inicio_offset };
  const fin = { parrafo: subrayado.fin_parrafo, offset: subrayado.fin_offset };

  if (extraerTexto(parrafos, inicio, fin) === subrayado.texto) {
    return { inicio, fin };
  }
  // Solo se puede volver a buscar si el subrayado cabe en un párrafo.
  if (subrayado.texto.includes("\n\n")) return null;
  for (let i = 0; i < parrafos.length; i++) {
    const donde = parrafos[i].indexOf(subrayado.texto);
    if (donde >= 0) {
      return {
        inicio: { parrafo: i, offset: donde },
        fin: { parrafo: i, offset: donde + subrayado.texto.length },
      };
    }
  }
  return null;
}

export type Segmento = { texto: string; subrayado: Subrayado | null };

// Parte un párrafo en trozos: los que no están subrayados y los que sí
// (con su subrayado). Si dos subrayados se enciman, gana el más reciente.
export function segmentar(
  parrafo: string,
  indice: number,
  ubicados: SubrayadoUbicado[],
): Segmento[] {
  const tramos = ubicados.flatMap(({ subrayado, inicio, fin }) => {
    if (indice < inicio.parrafo || indice > fin.parrafo) return [];
    const desde = indice === inicio.parrafo ? inicio.offset : 0;
    const hasta = indice === fin.parrafo ? fin.offset : parrafo.length;
    const a = Math.max(0, Math.min(parrafo.length, desde));
    const b = Math.max(0, Math.min(parrafo.length, hasta));
    return a < b ? [{ subrayado, a, b }] : [];
  });
  if (tramos.length === 0) return [{ texto: parrafo, subrayado: null }];

  const cortes = [
    ...new Set([0, parrafo.length, ...tramos.flatMap((t) => [t.a, t.b])]),
  ].sort((x, y) => x - y);

  const segmentos: Segmento[] = [];
  for (let k = 0; k < cortes.length - 1; k++) {
    const a = cortes[k];
    const b = cortes[k + 1];
    const encima = tramos.filter((t) => t.a <= a && t.b >= b).at(-1);
    segmentos.push({ texto: parrafo.slice(a, b), subrayado: encima?.subrayado ?? null });
  }
  return segmentos;
}
