// Iconos dibujados como SVG, para no instalar una librería de iconos.

type Props = { className?: string };

function Base({ className, children }: Props & { children: React.ReactNode }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      className={className ?? "size-5"}
    >
      {children}
    </svg>
  );
}

export function IconoInicio(p: Props) {
  return (
    <Base {...p}>
      <path d="M3 11l9-7 9 7" />
      <path d="M5 10v10h14V10" />
    </Base>
  );
}

export function IconoExplorar(p: Props) {
  return (
    <Base {...p}>
      <circle cx="11" cy="11" r="7" />
      <path d="M20 20l-3.5-3.5" />
    </Base>
  );
}

export function IconoCorazon({
  className,
  relleno = false,
}: Props & { relleno?: boolean }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill={relleno ? "currentColor" : "none"}
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      className={className ?? "size-5"}
    >
      <path d="M12 20s-7-4.4-7-10a4 4 0 0 1 7-2.6A4 4 0 0 1 19 10c0 5.600-7 10-7 10z" />
    </svg>
  );
}

export function IconoPerfil(p: Props) {
  return (
    <Base {...p}>
      <circle cx="12" cy="8" r="4" />
      <path d="M4 20c1.500-4 4.500-6 8-6s6.500 2 8 6" />
    </Base>
  );
}

export function IconoAtras(p: Props) {
  return (
    <Base {...p}>
      <path d="M15 5l-7 7 7 7" />
    </Base>
  );
}

export function IconoNota(p: Props) {
  return (
    <Base {...p}>
      <path d="M4 20h4L18.5 9.5a2.1 2.1 0 0 0-4-4L4 16v4z" />
      <path d="M13.5 6.5l4 4" />
    </Base>
  );
}

export function IconoBasura(p: Props) {
  return (
    <Base {...p}>
      <path d="M4 7h16" />
      <path d="M10 11v6M14 11v6" />
      <path d="M6 7l1 12a2 2 0 0 0 2 2h6a2 2 0 0 0 2-2l1-12" />
      <path d="M9 7V4h6v3" />
    </Base>
  );
}

export function IconoCerrar(p: Props) {
  return (
    <Base {...p}>
      <path d="M6 6l12 12M18 6L6 18" />
    </Base>
  );
}

export function IconoAudifonos(p: Props) {
  return (
    <Base {...p}>
      <path d="M4 15v-3a8 8 0 0 1 16 0v3" />
      <rect x="3" y="14" width="4" height="6" rx="1.5" />
      <rect x="17" y="14" width="4" height="6" rx="1.5" />
    </Base>
  );
}

export function IconoLibro(p: Props) {
  return (
    <Base {...p}>
      <path d="M12 7v12" />
      <path d="M4 5h5a3 3 0 0 1 3 3 3 3 0 0 1 3-3h5v13h-5a3 3 0 0 0-3 2 3 3 0 0 0-3-2H4z" />
    </Base>
  );
}
