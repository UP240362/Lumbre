import { FormularioRecuperar } from "../FormulariosAcceso";

export const metadata = { title: "Recuperar contraseña · Lumbre" };

export default function Recuperar() {
  return (
    <>
      <h2 className="mb-6 font-serif text-3xl font-semibold text-orilla-texto">
        Recupera tu contraseña
      </h2>
      <FormularioRecuperar />
    </>
  );
}
