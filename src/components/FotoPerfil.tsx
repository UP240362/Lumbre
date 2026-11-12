// Círculo con la foto de perfil. Si no hay foto, muestra la inicial del
// nombre (o un ícono de persona si tampoco hay nombre).

import { IconoPerfil } from "./Iconos";

export function FotoPerfil({
  version,
  nombre,
  de,
  className = "size-10",
  texto = "text-base",
}: {
  version: number | null;
  nombre: string | null;
  de?: string; // apodo de OTRO lector (sin esto, es la foto propia)
  className?: string; // tamaño del círculo
  texto?: string; // tamaño de la inicial
}) {
  if (version) {
    return (
      // eslint-disable-next-line @next/next/no-img-element -- foto privada servida por /api/foto
      <img
        src={de ? `/api/foto/${encodeURIComponent(de)}?v=${version}` : `/api/foto?v=${version}`}
        alt=""
        className={`${className} shrink-0 rounded-full object-cover ring-2 ring-naranja`}
      />
    );
  }
  const inicial = nombre?.trim().charAt(0).toUpperCase();
  return (
    <span
      aria-hidden="true"
      className={`${className} ${texto} flex shrink-0 items-center justify-center rounded-full bg-naranja font-semibold text-negro`}
    >
      {inicial || <IconoPerfil className="size-[60%]" />}
    </span>
  );
}
