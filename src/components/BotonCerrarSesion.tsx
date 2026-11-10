"use client";

// Cierra la sesión y, antes, borra los libros guardados en este teléfono
// para leer sin internet (así nadie más los ve si el teléfono es compartido).

import { cerrarSesion } from "@/app/(acceso)/acciones";
import { borrarTodoSinConexion } from "@/lib/sinConexion";

export function BotonCerrarSesion() {
  return (
    <form
      action={async () => {
        await borrarTodoSinConexion();
        await cerrarSesion();
      }}
    >
      <button
        type="submit"
        className="min-h-11 rounded-xl border-2 border-borde px-5 font-semibold transition-colors hover:border-naranja"
      >
        Cerrar sesión
      </button>
    </form>
  );
}
