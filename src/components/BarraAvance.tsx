// Barra de avance: recibe un porcentaje de 0 a 100.

export function BarraAvance({
  porcentaje,
  etiqueta = "Avance de lectura",
}: {
  porcentaje: number;
  etiqueta?: string;
}) {
  const valor = Math.min(100, Math.max(0, porcentaje));

  return (
    <div
      role="progressbar"
      aria-label={etiqueta}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={Math.round(valor)}
      className="h-2 w-full overflow-hidden rounded-full bg-pista"
    >
      <div
        className="h-full rounded-full bg-naranja"
        style={{ width: `${valor}%` }}
      />
    </div>
  );
}
