// Cliente de Supabase para usar en el SERVIDOR (páginas, acciones y rutas).
// La sesión del usuario viaja en cookies; aquí le enseñamos a Supabase
// cómo leerlas y escribirlas con las herramientas de Next.js.

import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { connection } from "next/server";
import { SUPABASE_CLAVE, SUPABASE_URL } from "./config";

export async function crearClienteServidor() {
  const almacen = await cookies();
  // Le avisa a Next.js que esto depende de la visita actual y no se puede
  // preparar por adelantado (Supabase consulta la hora para ver si la
  // sesión ya venció).
  await connection();

  return createServerClient(SUPABASE_URL, SUPABASE_CLAVE, {
    cookies: {
      getAll() {
        return almacen.getAll();
      },
      setAll(lista) {
        try {
          for (const { name, value, options } of lista) {
            almacen.set(name, value, options);
          }
        } catch {
          // Las páginas (a diferencia de las acciones) no pueden escribir
          // cookies. No pasa nada: el proxy se encarga de renovar la sesión.
        }
      },
    },
  });
}
