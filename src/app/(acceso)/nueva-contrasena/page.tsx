import { FormularioNuevaContrasena } from "../FormulariosAcceso";

export const metadata = { title: "Nueva contraseña · Lumbre" };

// Se llega aquí desde el enlace del correo de recuperación.
// El proxy solo deja entrar si ese enlace ya inició la sesión.
export default function NuevaContrasena() {
  return (
    <>
      <h2 className="mb-8 font-serif text-3xl font-semibold text-orilla-texto">
        Elige una contraseña nueva
      </h2>
      <FormularioNuevaContrasena />
    </>
  );
}
