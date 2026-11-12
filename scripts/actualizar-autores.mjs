// Arma src/data/autores.json: escritores en dominio público que tienen
// libros en Project Gutenberg, con su día de nacimiento y de muerte.
// Lo usa el "Libro del día" de Explorar (src/lib/libroDelDia.ts).
//
// Los datos vienen de Wikidata (la base de datos abierta de Wikipedia).
// Preguntar por "quién nació hoy" directamente tarda más de un minuto, así
// que se descarga la lista una vez y se guarda en el proyecto.
//
// Uso (tarda uno o dos minutos):  node scripts/actualizar-autores.mjs

import { writeFile } from "node:fs/promises";

const URL_WIKIDATA = "https://query.wikidata.org/sparql";
const AGENTE = "Lumbre/0.1 (lector de libros de dominio publico)";
// Mismo criterio que en México: 100 años después de la muerte del autor.
const ULTIMO_ANIO = new Date().getFullYear() - 101;
// Cuántas Wikipedias tienen artículo sobre la persona: mide qué tan conocida es.
const FAMA_MINIMA = 20;

async function consultar(sparql) {
  for (let intento = 1; intento <= 3; intento++) {
    const respuesta = await fetch(URL_WIKIDATA, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        Accept: "application/sparql-results+json",
        "User-Agent": AGENTE,
      },
      body: new URLSearchParams({ query: sparql }),
    });
    const texto = await respuesta.text();
    if (respuesta.ok && texto.startsWith("{")) return JSON.parse(texto).results.bindings;
    console.warn(`Wikidata falló (intento ${intento}): ${respuesta.status}`);
  }
  throw new Error("Wikidata no respondió");
}

const qid = (url) => url.slice(url.lastIndexOf("/") + 1);

// 1) Personas con número de autor en Gutenberg, conocidas y muertas hace
//    más de 100 años.
console.log("Pidiendo autores…");
const filas = await consultar(`
SELECT ?p ?g ?enlaces ?es ?en WHERE {
  ?p wdt:P1938 ?g ; wdt:P570 ?muere ; wikibase:sitelinks ?enlaces .
  FILTER(?enlaces >= ${FAMA_MINIMA})
  FILTER(YEAR(?muere) <= ${ULTIMO_ANIO})
  OPTIONAL { ?p rdfs:label ?es FILTER(LANG(?es) = "es") }
  OPTIONAL { ?p rdfs:label ?en FILTER(LANG(?en) = "en") }
}`);

const autores = new Map();
for (const f of filas) {
  const id = qid(f.p.value);
  if (autores.has(id)) continue;
  autores.set(id, {
    nombre: f.es?.value ?? f.en?.value ?? null,
    gutenberg: f.g.value,
    fama: Number(f.enlaces.value),
  });
}
console.log(`${autores.size} personas`);

// 2) De esas, solo las que escribían (escritor, poeta, novelista,
//    dramaturgo, filósofo…), con fechas exactas al día y en calendario
//    gregoriano (las fechas antiguas en calendario juliano caerían en
//    otro día del que se celebra). También se marca quién escribió en
//    español, para darle preferencia.
const OFICIOS = [
  "Q36180", "Q49757", "Q6625963", "Q214917", "Q4964182",
  "Q11774202", "Q482980", "Q28389", "Q18844224", "Q1930187",
];
// España, Hispanoamérica y los reinos antiguos (Castilla, Nueva España…).
const PAISES_HISPANOS = [
  "Q29", "Q96", "Q414", "Q739", "Q298", "Q419", "Q241", "Q717", "Q77",
  "Q811", "Q774", "Q736", "Q750", "Q733", "Q783", "Q792", "Q800", "Q804",
  "Q786", "Q1183", "Q170603", "Q217196", "Q80702",
];
const fechas = new Map();
const ids = [...autores.keys()];
for (let i = 0; i < ids.length; i += 300) {
  const grupo = ids.slice(i, i + 300).map((id) => `wd:${id}`).join(" ");
  console.log(`Oficios y fechas ${i + 1}–${Math.min(i + 300, ids.length)}…`);
  const resultado = await consultar(`
SELECT ?p ?nace ?muere ?espanol WHERE {
  VALUES ?p { ${grupo} }
  VALUES ?oficio { ${OFICIOS.map((o) => `wd:${o}`).join(" ")} }
  FILTER EXISTS { ?p wdt:P106 ?oficio }
  BIND(EXISTS { ?p wdt:P1412|wdt:P6886 wd:Q1321 } ||
       EXISTS { VALUES ?pais { ${PAISES_HISPANOS.map((q) => `wd:${q}`).join(" ")} } ?p wdt:P27 ?pais }
       AS ?espanol)
  OPTIONAL { ?p p:P569/psv:P569 [ wikibase:timeValue ?nace ; wikibase:timePrecision 11 ;
             wikibase:timeCalendarModel wd:Q1985727 ] }
  OPTIONAL { ?p p:P570/psv:P570 [ wikibase:timeValue ?muere ; wikibase:timePrecision 11 ;
             wikibase:timeCalendarModel wd:Q1985727 ] }
}`);
  for (const f of resultado) {
    const id = qid(f.p.value);
    const anterior = fechas.get(id) ?? {};
    fechas.set(id, {
      nace: anterior.nace ?? f.nace?.value.slice(0, 10) ?? null,
      muere: anterior.muere ?? f.muere?.value.slice(0, 10) ?? null,
      espanol: f.espanol?.value === "true",
    });
  }
}

// 3) Sus obras más conocidas, con el título en español. Sirven para
//    elegir, entre sus libros, el que vale la pena recomendar.
const obras = new Map();
const escritores = [...fechas.keys()];
for (let i = 0; i < escritores.length; i += 300) {
  const grupo = escritores.slice(i, i + 300).map((id) => `wd:${id}`).join(" ");
  console.log(`Obras ${i + 1}–${Math.min(i + 300, escritores.length)}…`);
  const resultado = await consultar(`
SELECT ?p ?titulo WHERE {
  VALUES ?p { ${grupo} }
  ?p wdt:P800 ?obra .
  ?obra rdfs:label ?titulo FILTER(LANG(?titulo) = "es")
}`);
  for (const f of resultado) {
    const id = qid(f.p.value);
    const lista = obras.get(id) ?? [];
    if (lista.length < 5) lista.push(f.titulo.value);
    obras.set(id, lista);
  }
}

const lista = [];
for (const [id, f] of fechas) {
  const a = autores.get(id);
  if (!a.nombre || (!f.nace && !f.muere)) continue;
  lista.push({ id, ...a, ...f, obras: obras.get(id) ?? [] });
}
lista.sort((x, y) => y.fama - x.fama || x.id.localeCompare(y.id));

await writeFile(
  new URL("../src/data/autores.json", import.meta.url),
  JSON.stringify(lista, null, 0).replace(/\},\{/g, "},\n{") + "\n",
);
const dias = new Set(lista.flatMap((a) => [a.nace, a.muere]).filter(Boolean).map((d) => d.slice(5)));
console.log(`Listo: ${lista.length} escritores; cubren ${dias.size} de 366 días.`);
