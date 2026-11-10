import { Suspense } from "react";
import { FormularioLogin } from "../FormulariosAcceso";

export const metadata = { title: "Inicia sesión · Lumbre" };

export default function Login() {
  return (
    <>
      <h2 className="mb-8 font-serif text-3xl font-semibold text-orilla-texto">
        Inicia sesión
      </h2>
      {/* Suspense: el formulario lee la dirección (?aviso=...) y eso
          solo se sabe en el momento de la visita. */}
      <Suspense>
        <FormularioLogin />
      </Suspense>
    </>
  );
}
