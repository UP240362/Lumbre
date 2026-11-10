// RECOMENDACIONES "para ti".
// Idea sencilla: se juntan los autores que te gustan (los que elegiste en
// "Tus gustos" y los de tus libros favoritos), se buscan libros de cada uno
// en las fuentes y se mezclan por turnos, quitando los que ya tienes en
// favoritos o ya empezaste a leer.

import type { DatosTarjeta } from "@/components/TarjetaLibro";
import { claveLibro } from "./favoritos";
import { buscarLibros, type Libro } from "./fuentes";
import { AUTORES_SUGERIDOS, LIBROS_SUGERIDOS } from "./sugerencias";
import { crearClienteServidor } from "./supabase/servidor";
import { simplificar } from "./texto";

const MAX_AUTORES = 5;
const MAX_LIBROS = 10;
const POR_AUTOR = 4;

// Con qué palabra buscar a un autor. Los sugeridos traen la suya; para los
// demás se usa el apellido (la última palabra del nombre).
function terminoDe(nombre: string): string {
  const sugerido = AUTORES_SUGERIDOS.find(
    (a) => simplificar(a.nombre) === simplificar(nombre),
  );
  if (sugerido) return sugerido.busqueda;
  return nombre.trim().split(/\s+/).at(-1) ?? "";
}

function aTarjeta(libro: Libro): DatosTarjeta {
  return {
    id: libro.id,
    fuente: libro.fuente,
    titulo: libro.titulo,
    autor: libro.autores.join(", "),
    idioma: libro.idiomas[0],
  };
}

export async function obtenerRecomendaciones(): Promise<{
  libros: DatosTarjeta[];
  personalizadas: boolean;
}> {
  const supabase = await crearClienteServidor();
  const [autores, favoritos, progreso] = await Promise.all([
    supabase
      .from("autores_preferidos")
      .select("nombre_autor")
      .order("creado_en", { ascending: false }),
    supabase
      .from("libros_favoritos")
      .select("book_id, fuente, autor")
      .order("creado_en", { ascending: false }),
    supabase.from("progreso_lectura").select("book_id, fuente"),
  ]);

  // Libros que no hay que recomendar porque el usuario ya los tiene.
  const yaTiene = new Set<string>();
  for (const fila of [...(favoritos.data ?? []), ...(progreso.data ?? [])]) {
    yaTiene.add(claveLibro({ fuente: fila.fuente, id: fila.book_id }));
  }

  // Lista de autores que le gustan, sin repetidos.
  const nombres = [
    ...(autores.data ?? []).map((a) => a.nombre_autor as string),
    ...(favoritos.data ?? []).flatMap((f) =>
      typeof f.autor === "string" ? f.autor.split(", ") : [],
    ),
  ];
  const terminos: string[] = [];
  for (const nombre of nombres) {
    const termino = terminoDe(nombre);
    const simple = simplificar(termino);
    if (simple.length < 3 || simple === "anonimo") continue;
    if (!terminos.some((t) => simplificar(t) === simple)) terminos.push(termino);
  }

  // Sin gustos todavía: se muestran los clásicos de siempre.
  if (terminos.length === 0) {
    return {
      libros: LIBROS_SUGERIDOS.filter((l) => !yaTiene.has(claveLibro(l))),
      personalizadas: false,
    };
  }

  // Se busca cada autor (todas las búsquedas a la vez).
  const porAutor = await Promise.all(
    terminos.slice(0, MAX_AUTORES).map(async (termino) => {
      const encontrados = await buscarLibros(termino).catch(() => []);
      const delAutor = encontrados.filter(
        (libro) =>
          // Que de verdad sea de ese autor, no una coincidencia en el título…
          simplificar(libro.autores.join(" ")).includes(simplificar(termino)) &&
          // …y sin Internet Archive, cuyo texto escaneado se lee peor.
          libro.fuente !== "archive" &&
          !yaTiene.has(claveLibro(libro)),
      );
      return delAutor;
    }),
  );

  // Si entre todos hay suficientes libros en español, se recomiendan solo
  // esos; si no, se aceptan también los que estén en otro idioma.
  const esEspanol = (libro: Libro) => libro.idiomas.includes("es");
  const hayEnEspanol = porAutor.flat().filter(esEspanol).length >= POR_AUTOR;
  const listas = porAutor.map((lista) =>
    (hayEnEspanol ? lista.filter(esEspanol) : lista).slice(0, POR_AUTOR),
  );

  // Se reparten por turnos (uno de cada autor) y sin títulos repetidos.
  const titulosVistos = new Set<string>();
  const libros: DatosTarjeta[] = [];
  for (let turno = 0; turno < POR_AUTOR && libros.length < MAX_LIBROS; turno++) {
    for (const lista of listas) {
      const libro = lista[turno];
      if (!libro || libros.length >= MAX_LIBROS) continue;
      const titulo = simplificar(libro.titulo);
      if (titulosVistos.has(titulo)) continue;
      titulosVistos.add(titulo);
      libros.push(aTarjeta(libro));
    }
  }

  // Si las fuentes no devolvieron nada, también se cae a los clásicos.
  if (libros.length === 0) {
    return {
      libros: LIBROS_SUGERIDOS.filter((l) => !yaTiene.has(claveLibro(l))),
      personalizadas: false,
    };
  }
  return { libros, personalizadas: true };
}
