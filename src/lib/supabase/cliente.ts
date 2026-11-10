// Cliente de Supabase para usar en el NAVEGADOR (componentes "use client").

import { createBrowserClient } from "@supabase/ssr";
import { SUPABASE_CLAVE, SUPABASE_URL } from "./config";

export function crearClienteNavegador() {
  return createBrowserClient(SUPABASE_URL, SUPABASE_CLAVE);
}
