// FUENTE: "Mis libros", los que cada usuario agregó por su cuenta.
// A diferencia de las otras fuentes, esta es privada: los datos están en la
// tabla libros_propios de Supabase y las reglas RLS hacen que cada quien
// solo pueda ver (y por tanto abrir) los suyos.

import { archivoACapitulos } from "../lectura/detectar";
import { crearClienteServidor } from "../supabase/servidor";
import { descargarExterno } from "./descargarExterno";
import type { FuenteLibros } from "./tipos";

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
      .select("id, titulo, autor, tipo, url, ruta_archivo")
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
    };
  },

  async leer(libro) {
    if (!libro.urlTexto) throw new Error("Este libro no tiene contenido");

    // Archivo subido: se baja del almacén privado con la sesión del usuario.
    if (libro.urlTexto.startsWith(PREFIJO_ARCHIVO)) {
      const ruta = libro.urlTexto.slice(PREFIJO_ARCHIVO.length);
      const supabase = await crearClienteServidor();
      const { data, error } = await supabase.storage.from(ALMACEN).download(ruta);
      if (error || !data) throw new Error("No se pudo abrir el archivo guardado");
      return archivoACapitulos(new Uint8Array(await data.arrayBuffer()), data.type);
    }

    // Enlace: se descarga de internet (con las revisiones de seguridad).
    const { datos, tipo } = await descargarExterno(libro.urlTexto);
    return archivoACapitulos(datos, tipo);
  },
};
