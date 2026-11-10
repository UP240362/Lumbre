// Portada generada: un rectángulo de color con el apellido del autor arriba
// y el título abajo. Así no dependemos de imágenes externas.

const PALETAS = [
  { fondo: "#F26B0F", texto: "#0B0B0B", etiqueta: "#0B0B0B" },
  { fondo: "#0B0B0B", texto: "#F26B0F", etiqueta: "#F26B0F" },
  { fondo: "#7A2C0B", texto: "#F6E7C1", etiqueta: "#F6E7C1" },
  { fondo: "#E8DDBF", texto: "#171717", etiqueta: "#171717" },
  { fondo: "#1F1F1F", texto: "#F4EFE8", etiqueta: "#F4EFE8" },
  { fondo: "#3B2A1A", texto: "#F6E7C1", etiqueta: "#F6E7C1" },
];

// Convierte el título en un número para elegir siempre la misma paleta
// para el mismo libro.
function elegirPaleta(texto: string) {
  let suma = 2166136261;
  for (const letra of texto) {
    suma = Math.imul(suma ^ (letra.codePointAt(0) ?? 0), 16777619) >>> 0;
  }
  return PALETAS[(suma >>> 8) % PALETAS.length];
}

type Props = {
  titulo: string;
  autor: string;
  // "chica" se usa en la tarjeta de "Seguir leyendo".
  talla?: "normal" | "chica";
};

export function PortadaLibro({ titulo, autor, talla = "normal" }: Props) {
  const paleta = elegirPaleta(titulo);
  const apellido = autor.trim().split(/\s+/).at(-1) ?? "";
  const chica = talla === "chica";

  return (
    <div
      className={`flex aspect-[3/4] w-full flex-col justify-between overflow-hidden rounded-lg border border-black/15 ${
        chica ? "p-3" : "p-4"
      }`}
      style={{ background: paleta.fondo, color: paleta.texto }}
    >
      <span
        className={`font-semibold uppercase tracking-widest ${
          chica ? "text-[9px]" : "text-[11px]"
        }`}
        style={{ color: paleta.etiqueta }}
      >
        {apellido}
      </span>
      <span
        className={`font-serif font-bold leading-tight ${
          chica ? "text-sm" : "text-xl"
        }`}
      >
        {titulo}
      </span>
    </div>
  );
}
