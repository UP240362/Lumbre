"use client";

// TARJETA DE CITA: dibuja en el navegador (con un <canvas>, sin servicios
// externos) la imagen de un fragmento subrayado para compartirla en redes.
// Mide 1080 × 1350, el formato vertical de Instagram, y también se ve bien
// en WhatsApp, Facebook y X.

export type Fondo = "blanca" | "amarilla" | "negra";

export const FONDOS: { id: Fondo; nombre: string; muestra: string }[] = [
  { id: "blanca", nombre: "Blanca", muestra: "#ffffff" },
  { id: "amarilla", nombre: "Amarilla", muestra: "#f6e7c1" },
  { id: "negra", nombre: "Negra", muestra: "#1c1c1c" },
];

const COLORES: Record<Fondo, { tarjeta: string; texto: string; tenue: string; linea: string; comillas: string }> = {
  blanca: { tarjeta: "#ffffff", texto: "#1a1a1a", tenue: "#6b6b6b", linea: "#e3e3e3", comillas: "#b34700" },
  amarilla: { tarjeta: "#f6e7c1", texto: "#2b2118", tenue: "#6e5d45", linea: "#e0cc98", comillas: "#a83f00" },
  negra: { tarjeta: "#1c1c1c", texto: "#f2f2f2", tenue: "#a3a3a3", linea: "#353535", comillas: "#f26b0f" },
};

const ANCHO = 1080;
const ALTO = 1350;
const NARANJA = "#f26b0f";
const ORILLA = "#0b0b0b";
export const MAX_LETRAS_CITA = 700;

// Las tipografías de la página (Literata e Inter, cargadas por Next).
function tipografias() {
  const estilo = getComputedStyle(document.documentElement);
  const leer = (variable: string, respaldo: string) =>
    estilo.getPropertyValue(variable).trim() || respaldo;
  return {
    serif: `${leer("--font-literata", "Georgia")}, Georgia, serif`,
    sans: `${leer("--font-inter", "system-ui")}, system-ui, sans-serif`,
  };
}

// Parte el texto en renglones que quepan en "ancho".
function renglones(ctx: CanvasRenderingContext2D, texto: string, ancho: number): string[] {
  const salida: string[] = [];
  for (const parrafo of texto.split(/\n+/)) {
    let actual = "";
    for (const palabra of parrafo.split(/\s+/).filter(Boolean)) {
      const prueba = actual ? `${actual} ${palabra}` : palabra;
      if (ctx.measureText(prueba).width <= ancho || !actual) actual = prueba;
      else {
        salida.push(actual);
        actual = palabra;
      }
    }
    if (actual) salida.push(actual);
  }
  return salida;
}

function rectanguloRedondo(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, r);
}

// Recorta una línea con "…" si no cabe.
function recortar(ctx: CanvasRenderingContext2D, texto: string, ancho: number) {
  if (ctx.measureText(texto).width <= ancho) return texto;
  let t = texto;
  while (t.length > 1 && ctx.measureText(`${t}…`).width > ancho) t = t.slice(0, -1);
  return `${t.trimEnd()}…`;
}

export async function dibujarTarjeta({
  texto,
  titulo,
  autor,
  fondo,
}: {
  texto: string;
  titulo: string;
  autor: string;
  fondo: Fondo;
}): Promise<Blob> {
  const { serif, sans } = tipografias();
  // Que las letras estén cargadas antes de dibujar.
  await Promise.all([
    document.fonts.load(`46px ${serif}`),
    document.fonts.load(`bold 56px ${serif}`),
    document.fonts.load(`600 34px ${sans}`),
    document.fonts.load(`30px ${sans}`),
  ]).catch(() => {});

  const lienzo = document.createElement("canvas");
  lienzo.width = ANCHO;
  lienzo.height = ALTO;
  const ctx = lienzo.getContext("2d");
  if (!ctx) throw new Error("Este navegador no puede dibujar la imagen.");
  const c = COLORES[fondo];

  // Fondo negro con marco naranja (como en la app).
  ctx.fillStyle = ORILLA;
  ctx.fillRect(0, 0, ANCHO, ALTO);
  ctx.strokeStyle = NARANJA;
  ctx.lineWidth = 8;
  rectanguloRedondo(ctx, 28, 28, ANCHO - 56, ALTO - 56, 48);
  ctx.stroke();

  // Medidas de la tarjeta.
  const margen = 96; // de la orilla de la imagen a la tarjeta
  const relleno = 64; // dentro de la tarjeta
  const anchoTarjeta = ANCHO - margen * 2;
  const anchoTexto = anchoTarjeta - relleno * 2;
  const alturaMarca = 120; // espacio para "Lumbre" debajo de la tarjeta
  const disponible = ALTO - margen * 2 - alturaMarca;

  // El tamaño de letra baja hasta que la cita cabe; si aun así no cabe,
  // se corta con "…".
  const limpio = texto.replace(/\s+/g, " ").trim().slice(0, MAX_LETRAS_CITA);
  let tamano = 50;
  let lineas: string[] = [];
  let alto = 0;
  const fijo = relleno * 2 + 110 + 50 + 2 + 50 + 44 + 40; // comillas, línea, título, autor
  for (; tamano >= 30; tamano -= 2) {
    ctx.font = `${tamano}px ${serif}`;
    lineas = renglones(ctx, limpio, anchoTexto);
    alto = fijo + lineas.length * tamano * 1.5;
    if (alto <= disponible) break;
  }
  if (alto > disponible) {
    const caben = Math.max(1, Math.floor((disponible - fijo) / (tamano * 1.5)));
    lineas = lineas.slice(0, caben);
    lineas[caben - 1] = recortar(ctx, `${lineas[caben - 1]}…`, anchoTexto);
    alto = fijo + lineas.length * tamano * 1.5;
  }

  // Todo centrado de arriba a abajo.
  const yTarjeta = Math.max(margen, (ALTO - alto - alturaMarca) / 2);
  ctx.fillStyle = c.tarjeta;
  rectanguloRedondo(ctx, margen, yTarjeta, anchoTarjeta, alto, 36);
  ctx.fill();
  if (fondo === "negra") {
    // Orilla sutil para que la tarjeta negra se distinga del marco.
    ctx.strokeStyle = "#3a3a3a";
    ctx.lineWidth = 3;
    ctx.stroke();
  }

  const x = margen + relleno;
  let y = yTarjeta + relleno;

  ctx.textBaseline = "top";
  ctx.fillStyle = c.comillas;
  ctx.font = `bold 110px ${serif}`;
  ctx.fillText("“", x - 6, y - 10);
  y += 110;

  ctx.fillStyle = c.texto;
  ctx.font = `${tamano}px ${serif}`;
  for (const linea of lineas) {
    ctx.fillText(linea, x, y + tamano * 0.18);
    y += tamano * 1.5;
  }

  y += 50;
  ctx.fillStyle = c.linea;
  ctx.fillRect(x, y, anchoTexto, 2);
  y += 2 + 34;

  ctx.fillStyle = c.texto;
  ctx.font = `600 34px ${sans}`;
  ctx.fillText(recortar(ctx, titulo, anchoTexto), x, y);
  y += 50;
  if (autor) {
    ctx.fillStyle = c.tenue;
    ctx.font = `30px ${sans}`;
    ctx.fillText(recortar(ctx, autor, anchoTexto), x, y);
  }

  // La marca debajo de la tarjeta.
  ctx.fillStyle = NARANJA;
  ctx.font = `bold 56px ${serif}`;
  ctx.fillText("Lumbre", margen, yTarjeta + alto + 44);

  return new Promise((listo, falla) =>
    lienzo.toBlob((b) => (b ? listo(b) : falla(new Error("No se pudo crear la imagen."))), "image/png"),
  );
}

// Texto para copiar o mandar junto a la imagen.
export function textoDeCita({
  texto,
  titulo,
  autor,
  maximo = MAX_LETRAS_CITA,
}: {
  texto: string;
  titulo: string;
  autor: string;
  maximo?: number;
}) {
  const limpio = texto.replace(/\s+/g, " ").trim();
  const cita = limpio.length > maximo ? `${limpio.slice(0, maximo - 1).trimEnd()}…` : limpio;
  return `“${cita}”\n— ${titulo}${autor ? `, ${autor}` : ""}\n\nLeído en Lumbre · https://lumbre.uk`;
}
