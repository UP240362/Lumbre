import { FormularioCrearCuenta } from "../FormulariosAcceso";

export const metadata = { title: "Crear cuenta · Lumbre" };

export default function CrearCuenta() {
  return (
    <>
      <h2 className="mb-8 font-serif text-3xl font-semibold text-orilla-texto">
        Crea tu cuenta
      </h2>
      <FormularioCrearCuenta />
    </>
  );
}
