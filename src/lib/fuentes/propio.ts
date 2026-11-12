// FUENTE: "Mis libros", los que cada usuario agregó por su cuenta.
// A diferencia de las otras fuentes, esta es privada: los datos están en la
// tabla libros_propios de Supabase y las reglas RLS hacen que cada quien
// solo pueda ver (y por tanto abrir) los suyos.

import { paginasDeArchivo } from "../lectura/comic";
import { archivoACapitulos } from "../lectura/detectar";
import type { PaginasComic } from "../lectura/tipos";
import { crearClienteServidor } from "../supabase/servidor";
import { descargarExterno } from "./descargarExterno";
import { archivoEnMemoria, imagenDeArchivo } from "./imagenesEpub";
import type { FuenteLibros, Libro } from "./tipos";

// Nombre del "bucket" de Supabase Storage donde van los archivos subidos.
export const ALMACEN = "libros";

// Para distinguir, dentro de urlTexto, un archivo subido de un enlace.
const PREFIJO_ARCHIVO = "almacen:";
const ES_UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export const propio: FuenteLibros = {
  id: "propio",
  nombre: "Mis libros",

  // Los libros propios no salen en la búsqueda general: tienen su página.
  async buscar() {
    return [];
  },

  async obtener(id) {
    if (!ES_UUID.test(id)) return null;

    const supabase = await crearClienteServidor();
    const { data } = await supabase
      .from("libros_propios")
      .select("id, titulo, autor, tipo, url, ruta_archivo, formato")
      .eq("id", id)
      .maybeSingle();
    if (!data) return null; // no existe, o es de otra persona

    return {
      id: data.id,
      fuente: "propio",
      titulo: data.titulo,
      autores: data.autor ? [data.autor] : [],
      idiomas: ["es"],
      urlTexto:
        data.tipo === "archivo"
          ? `${PREFIJO_ARCHIVO}${data.ruta_archivo}`
          : data.url,
      formato: data.formato === "comic" ? "comic" : "texto",
    };
  },

  async leer(libro) {
    const { datos, tipo } = await bajar(libro);
    return archivoACapitulos(datos, tipo);
  },

  // Solo los ePub traen ilustraciones (de un PDF o una página web no se sacan).
  // "obtener" ya revisó que el libro sea de quien lo pide.
  imagen(libro, ruta) {
    return imagenDeArchivo(`propio:${libro.id}`, async () => (await bajar(libro)).datos, ruta);
  },
};

// ── Cómics ──
// El archivo completo (de la memoria si se usó hace poco). Para el visor de
// cómics: de ahí salen las páginas, y los PDF se mandan tal cual.
export function archivoPropio(libro: Libro): Promise<Uint8Array> {
  return archivoEnMemoria(`propio:${libro.id}`, async () => (await bajar(libro)).datos);
}

const paginasGuardadas = new Map<string, Promise<PaginasComic>>();

// Las páginas de un cómic propio. Se recuerdan (el archivo no cambia).
export function paginasComic(libro: Libro): Promise<PaginasComic> {
  let paginas = paginasGuardadas.get(libro.id);
  if (!paginas) {
    paginas = archivoPropio(libro).then(paginasDeArchivo);
    paginasGuardadas.set(libro.id, paginas);
    paginas.catch(() => paginasGuardadas.delete(libro.id));
    if (paginasGuardadas.size > 200) {
      paginasGuardadas.delete(paginasGuardadas.keys().next().value!);
    }
  }
  return paginas;
}

async function bajar(libro: Libro): Promise<{ datos: Uint8Array; tipo: string }> {
  if (!libro.urlTexto) throw new Error("Este libro no tiene contenido");

  // Archivo subido: se baja del almacén privado con la sesión del usuario.
  if (libro.urlTexto.startsWith(PREFIJO_ARCHIVO)) {
    const ruta = libro.urlTexto.slice(PREFIJO_ARCHIVO.length);
    const supabase = await crearClienteServidor();
    const { data, error } = await supabase.storage.from(ALMACEN).download(ruta);
    if (error || !data) throw new Error("No se pudo abrir el archivo guardado");
    return { datos: new Uint8Array(await data.arrayBuffer()), tipo: data.type };
  }

  // Enlace: se descarga de internet (con las revisiones de seguridad).
  return descargarExterno(libro.urlTexto);
}
