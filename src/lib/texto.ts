// Utilidades de texto compartidas (sirven en servidor y navegador).

// Quita acentos y mayúsculas para comparar: "Galdós" ≈ "galdos".
export function simplificar(texto: string): string {
  return texto
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase();
}

// Códigos con nombre que usa HTML para letras y signos (&aacute; = á).
const ENTIDADES: Record<string, string> = {
  lt: "<", gt: ">", quot: '"', apos: "'", nbsp: " ", amp: "&",
  aacute: "á", eacute: "é", iacute: "í", oacute: "ó", uacute: "ú",
  Aacute: "Á", Eacute: "É", Iacute: "Í", Oacute: "Ó", Uacute: "Ú",
  ntilde: "ñ", Ntilde: "Ñ", uuml: "ü", Uuml: "Ü", ccedil: "ç", Ccedil: "Ç",
  agrave: "à", egrave: "è", igrave: "ì", ograve: "ò", ugrave: "ù",
  acirc: "â", ecirc: "ê", icirc: "î", ocirc: "ô", ucirc: "û",
  auml: "ä", euml: "ë", iuml: "ï", ouml: "ö",
  iquest: "¿", iexcl: "¡", laquo: "«", raquo: "»",
  mdash: "—", ndash: "–", hellip: "…", middot: "·",
  ldquo: "“", rdquo: "”", lsquo: "‘", rsquo: "’",
  ordm: "º", ordf: "ª", deg: "°", copy: "©", sect: "§", shy: "",
};

function codigoALetra(codigo: number): string {
  return codigo > 0 && codigo <= 0x10ffff ? String.fromCodePoint(codigo) : "";
}

// Convierte &amp; y similares en sus letras reales y junta los espacios.
export function decodificarHtml(texto: string): string {
  return texto
    .replace(/&#(\d+);/g, (_, n) => codigoALetra(Number(n)))
    .replace(/&#x([0-9a-f]+);/gi, (_, n) => codigoALetra(parseInt(n, 16)))
    .replace(/&([a-zA-Z]+);/g, (todo, nombre) => ENTIDADES[nombre] ?? todo)
    .replace(/\s+/g, " ")
    .trim();
}

// "Cervantes Saavedra, Miguel de, 1547-1616" → "Miguel de Cervantes Saavedra"
// (los catálogos de bibliotecas escriben primero el apellido y a veces fechas).
export function ordenarNombre(nombre: string): string {
  const partes = nombre
    .split(",")
    .map((p) => p.trim())
    .filter((p) => p && !/\d{3,4}/.test(p) && !/^(tr|ed|comp)\.?$/i.test(p));
  if (partes.length < 2) return partes[0] ?? nombre.trim();
  const [apellido, ...resto] = partes;
  return `${resto.join(" ")} ${apellido}`;
}
