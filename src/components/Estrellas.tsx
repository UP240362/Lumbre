// Estrellas de calificación (solo para mostrar). Redondea a media estrella.

import { useId } from "react";

function Estrella({ relleno, className }: { relleno: 0 | 0.5 | 1; className: string }) {
  const id = useId();
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className={className}>
      {relleno === 0.5 && (
        <defs>
          <linearGradient id={id}>
            <stop offset="50%" stopColor="currentColor" />
            <stop offset="50%" stopColor="transparent" />
          </linearGradient>
        </defs>
      )}
      <path
        d="M12 3.5l2.6 5.3 5.9.9-4.3 4.1 1 5.8L12 16.9l-5.2 2.7 1-5.8-4.3-4.1 5.9-.9z"
        fill={relleno === 1 ? "currentColor" : relleno === 0.5 ? `url(#${id})` : "none"}
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function Estrellas({
  valor,
  className = "size-4",
}: {
  valor: number; // de 0 a 5
  className?: string;
}) {
  const redondeado = Math.round(valor * 2) / 2;
  return (
    <span
      role="img"
      aria-label={`${valor.toLocaleString("es-MX", { maximumFractionDigits: 1 })} de 5 estrellas`}
      className="inline-flex shrink-0 text-naranja"
    >
      {[1, 2, 3, 4, 5].map((n) => (
        <Estrella
          key={n}
          className={className}
          relleno={redondeado >= n ? 1 : redondeado >= n - 0.5 ? 0.5 : 0}
        />
      ))}
    </span>
  );
}
