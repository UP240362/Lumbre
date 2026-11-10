// Caja de búsqueda por título o autor. Al enviar, lleva a /explorar?q=texto.
// <Form> es el formulario de Next.js: navega sin recargar toda la página.

import Form from "next/form";
import { IconoExplorar } from "./Iconos";

export function Buscador({ valorInicial = "" }: { valorInicial?: string }) {
  return (
    <Form action="/explorar" className="w-full">
      <label className="flex flex-col gap-2 text-sm text-tenue">
        Buscar título o autor
        <span className="flex gap-2">
          <input
            type="search"
            name="q"
            defaultValue={valorInicial}
            placeholder="Ej. Drácula"
            minLength={2}
            maxLength={80}
            required
            className="h-12 min-w-0 flex-1 rounded-xl border border-borde bg-superficie px-4 text-base text-texto placeholder:text-tenue/70"
          />
          <button
            type="submit"
            aria-label="Buscar"
            className="boton-primario size-12 shrink-0 px-0"
          >
            <IconoExplorar />
          </button>
        </span>
      </label>
    </Form>
  );
}
