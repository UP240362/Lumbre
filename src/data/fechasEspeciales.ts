// CALENDARIO DEL "LIBRO DEL DÍA"
// Fechas especiales elegidas a mano: aniversarios de libros que cambiaron
// la forma de pensar y días internacionales. En esas fechas ganan a los
// cumpleaños de autores (que salen solos de src/data/autores.json).
//
// Para agregar una fecha: buscar el libro en Lumbre, copiar su fuente y su
// número de la dirección (/leer/elejandria/77 → fuente "elejandria", id
// "77") y escribir el motivo en una o dos frases. Solo dominio público.

import type { IdFuente } from "@/lib/fuentes/tipos";

export type FechaEspecial = {
  dia: string; // "MM-DD"
  titulo: string; // encabezado corto de la tarjeta
  motivo: string;
  libro: { fuente: IdFuente; id: string; titulo: string; autor: string; idioma: string };
};

const ele = (id: string, titulo: string, autor: string) =>
  ({ fuente: "elejandria", id, titulo, autor, idioma: "es" }) as const;
const gut = (id: string, titulo: string, autor: string) =>
  ({ fuente: "gutenberg", id, titulo, autor, idioma: "en" }) as const;

export const FECHAS_ESPECIALES: FechaEspecial[] = [
  {
    dia: "01-01",
    titulo: "Un día como hoy, en 1818",
    motivo: "Se publicó Frankenstein. Mary Shelley lo empezó a escribir a los 18 años y con él nació la ciencia ficción.",
    libro: ele("1739", "Frankenstein", "Mary Shelley"),
  },
  {
    dia: "01-05",
    titulo: "Un día como hoy, en 1886",
    motivo: "Se publicó El extraño caso del Dr. Jekyll y Mr. Hyde, la historia que convirtió el doble rostro de una persona en un mito.",
    libro: ele("1171", "El extraño caso del Dr. Jekyll y Mr. Hyde", "Robert Louis Stevenson"),
  },
  {
    dia: "01-10",
    titulo: "Un día como hoy, en 1776",
    motivo: "Thomas Paine publicó Sentido común. Este folleto convenció a miles de colonos de que Estados Unidos debía independizarse.",
    libro: ele("1533", "Sentido común", "Thomas Paine"),
  },
  {
    dia: "01-28",
    titulo: "Un día como hoy, en 1813",
    motivo: "Se publicó Orgullo y prejuicio, de Jane Austen, una de las novelas más leídas de la historia.",
    libro: ele("20", "Orgullo y prejuicio", "Jane Austen"),
  },
  {
    dia: "02-14",
    titulo: "Día del Amor y la Amistad",
    motivo: "La historia de amor más famosa del teatro.",
    libro: ele("909", "Romeo y Julieta", "William Shakespeare"),
  },
  {
    dia: "02-21",
    titulo: "Un día como hoy, en 1848",
    motivo: "Se publicó en Londres el Manifiesto comunista, de Marx y Engels. Pocos textos han influido tanto en la política del mundo.",
    libro: ele("1740", "Manifiesto comunista", "Karl Marx y Friedrich Engels"),
  },
  {
    dia: "03-08",
    titulo: "Día Internacional de la Mujer",
    motivo: "En 1792 Mary Wollstonecraft defendió que las mujeres tenían derecho a la misma educación que los hombres. Es uno de los textos fundadores del feminismo.",
    libro: ele("2550", "Vindicación de los derechos de la mujer", "Mary Wollstonecraft"),
  },
  {
    dia: "03-09",
    titulo: "Un día como hoy, en 1776",
    motivo: "Adam Smith publicó La riqueza de las naciones, el libro con el que nació la economía moderna.",
    libro: ele("432", "La riqueza de las naciones", "Adam Smith"),
  },
  {
    dia: "03-20",
    titulo: "Un día como hoy, en 1852",
    motivo: "Se publicó como libro La cabaña del tío Tom. Mostró a miles de lectores la crueldad de la esclavitud y avivó el movimiento para abolirla.",
    libro: ele("617", "La cabaña del tío Tom", "Harriet Beecher Stowe"),
  },
  {
    dia: "03-21",
    titulo: "Día Mundial de la Poesía",
    motivo: "Las Rimas de Bécquer, de los poemas de amor más recitados en español.",
    libro: ele("853", "Rimas", "Gustavo Adolfo Bécquer"),
  },
  {
    dia: "03-27",
    titulo: "Día Mundial del Teatro",
    motivo: "«¿Qué es la vida? Un frenesí.» La gran obra de Calderón sobre la libertad y el destino.",
    libro: ele("322", "La vida es sueño", "Pedro Calderón de la Barca"),
  },
  {
    dia: "04-22",
    titulo: "Día de la Tierra",
    motivo: "Thoreau vivió dos años en una cabaña junto a un lago para aprender a vivir con poco. Su libro sigue inspirando a quienes cuidan la naturaleza.",
    libro: ele("1081", "Walden", "Henry David Thoreau"),
  },
  {
    dia: "04-23",
    titulo: "Día Internacional del Libro",
    motivo: "Se celebra hoy porque un 23 de abril de 1616 murió Miguel de Cervantes. Nada mejor que su Quijote.",
    libro: ele("77", "Don Quijote de la Mancha", "Miguel de Cervantes"),
  },
  {
    dia: "04-30",
    titulo: "Día del Niño",
    motivo: "Las aventuras del muñeco de madera que quería ser un niño de verdad.",
    libro: ele("467", "Las aventuras de Pinocho", "Carlo Collodi"),
  },
  {
    dia: "05-01",
    titulo: "Día del Trabajo",
    motivo: "Zola retrató la vida y la huelga de los mineros franceses. Germinal se volvió un símbolo de la lucha obrera.",
    libro: ele("151", "Germinal", "Émile Zola"),
  },
  {
    dia: "05-15",
    titulo: "Día del Maestro",
    motivo: "El diario de un niño durante un año de escuela, y un homenaje a sus maestros.",
    libro: ele("2146", "Corazón", "Edmondo de Amicis"),
  },
  {
    dia: "05-26",
    titulo: "Un día como hoy, en 1897",
    motivo: "Se publicó Drácula, de Bram Stoker, la novela que creó al vampiro moderno.",
    libro: ele("143", "Drácula", "Bram Stoker"),
  },
  {
    dia: "07-04",
    titulo: "Un día como hoy, en 1776",
    motivo: "Se firmó la Declaración de Independencia de Estados Unidos: «todos los hombres son creados iguales». En 1971 fue el primer libro que se subió a Project Gutenberg.",
    libro: gut("1", "The Declaration of Independence of the United States of America", "Thomas Jefferson"),
  },
  {
    dia: "07-14",
    titulo: "Un día como hoy, en 1789",
    motivo: "Cayó la Bastilla y empezó la Revolución francesa. Dickens la contó en esta novela.",
    libro: ele("1729", "Historia de dos ciudades", "Charles Dickens"),
  },
  {
    dia: "09-16",
    titulo: "Independencia de México",
    motivo: "Fernández de Lizardi, periodista de los años de la Independencia, escribió la primera novela de Hispanoamérica.",
    libro: ele("1746", "El Periquillo Sarniento", "José Joaquín Fernández de Lizardi"),
  },
  {
    dia: "09-30",
    titulo: "Un día como hoy, en 1868",
    motivo: "Se publicó Mujercitas, la historia de las hermanas March.",
    libro: ele("87", "Mujercitas", "Louisa May Alcott"),
  },
  {
    dia: "10-12",
    titulo: "Día de la Nación Pluricultural",
    motivo: "El libro sagrado de los mayas k'iche': el origen del mundo según los pueblos de Mesoamérica.",
    libro: ele("1528", "Popol Vuh", "Anónimo"),
  },
  {
    dia: "10-16",
    titulo: "Un día como hoy, en 1847",
    motivo: "Se publicó Jane Eyre, de Charlotte Brontë: una heroína que exigía ser tratada como igual.",
    libro: ele("2383", "Jane Eyre", "Charlotte Brontë"),
  },
  {
    dia: "10-31",
    titulo: "Un día como hoy, en 1517",
    motivo: "Martín Lutero dio a conocer sus 95 tesis contra la venta de indulgencias. Así empezó la Reforma protestante.",
    libro: gut("274", "Disputation of Doctor Martin Luther on the Power and Efficacy of Indulgences", "Martín Lutero"),
  },
  {
    dia: "11-01",
    titulo: "Día de Todos los Santos",
    motivo: "Es tradición representar el Don Juan Tenorio en estas fechas, con su escena en el cementerio.",
    libro: ele("1680", "Don Juan Tenorio", "José Zorrilla"),
  },
  {
    dia: "11-12",
    titulo: "Día Nacional del Libro en México",
    motivo: "Se celebra hoy porque nació Sor Juana Inés de la Cruz. En esta carta defendió el derecho de las mujeres a estudiar.",
    libro: ele("1763", "Respuesta a Sor Filotea de la Cruz", "Sor Juana Inés de la Cruz"),
  },
  {
    dia: "11-14",
    titulo: "Un día como hoy, en 1851",
    motivo: "Se publicó en Estados Unidos Moby Dick, la persecución de la ballena blanca.",
    libro: ele("425", "Moby Dick", "Herman Melville"),
  },
  {
    dia: "11-24",
    titulo: "Un día como hoy, en 1859",
    motivo: "Darwin publicó El origen de las especies. Cambió para siempre la forma en que entendemos la vida.",
    libro: ele("53", "El origen de las especies", "Charles Darwin"),
  },
  {
    dia: "11-26",
    titulo: "Un día como hoy, en 1865",
    motivo: "Se publicó Alicia en el país de las maravillas, de Lewis Carroll.",
    libro: ele("1790", "Las aventuras de Alicia en el país de las maravillas", "Lewis Carroll"),
  },
  {
    dia: "12-10",
    titulo: "Un día como hoy, en 1884",
    motivo: "Se publicó Huckleberry Finn. Hemingway dijo que de ahí viene toda la literatura moderna de Estados Unidos.",
    libro: ele("2534", "Las aventuras de Huckleberry Finn", "Mark Twain"),
  },
  {
    dia: "12-19",
    titulo: "Un día como hoy, en 1843",
    motivo: "Dickens publicó Cuento de Navidad, la historia del avaro Scrooge y los tres fantasmas.",
    libro: gut("46", "A Christmas Carol", "Charles Dickens"),
  },
  {
    dia: "12-24",
    titulo: "Nochebuena",
    motivo: "Un cuento de Navidad mexicano: una Nochebuena en un pueblo de la sierra.",
    libro: ele("1491", "La Navidad en las montañas", "Ignacio Manuel Altamirano"),
  },
];

// Para los días sin fecha especial ni autor con libro disponible.
export const CLASICOS: FechaEspecial["libro"][] = [
  ele("77", "Don Quijote de la Mancha", "Miguel de Cervantes"),
  ele("20", "Orgullo y prejuicio", "Jane Austen"),
  ele("117", "La metamorfosis", "Franz Kafka"),
  ele("1855", "Ana Karenina", "León Tolstói"),
  ele("223", "Los miserables", "Victor Hugo"),
  ele("253", "Hamlet", "William Shakespeare"),
  ele("430", "El príncipe", "Nicolás Maquiavelo"),
];
