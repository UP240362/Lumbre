// Avance de la meta de lectura semanal: barra, cuánto falta y la racha de
// semanas seguidas cumpliéndola. Se usa en Mi perfil y en Inicio.

import { formatoDuracion, type Estadisticas } from "@/lib/estadisticasLectura";
import { BarraAvance } from "./BarraAvance";

export function AvanceMeta({
  e,
}: {
  e: Pick<Estadisticas, "semana" | "meta" | "racha" | "diasRestantes">;
}) {
  if (!e.meta) return null;
  const objetivo = e.meta * 60;
  const porcentaje = Math.min(100, (e.semana / objetivo) * 100);
  const falta = Math.max(0, objetivo - e.semana);
  const cumplida = falta === 0;
  // Cuánto habría que leer cada día que queda (redondeado al minuto).
  const porDia = Math.ceil(falta / 60 / Math.max(1, e.diasRestantes)) * 60;

  return (
    <div>
      <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
        <p className="font-semibold">Meta semanal: {formatoDuracion(objetivo)}</p>
        <p className="text-sm text-tenue">
          {formatoDuracion(e.semana)} · {Math.floor(porcentaje)} %
        </p>
      </div>
      <div className="mt-2">
        <BarraAvance porcentaje={porcentaje} etiqueta="Avance de la meta semanal" />
      </div>
      <p className="mt-2 text-sm">
        {cumplida ? (
          <span className="font-semibold">¡Cumpliste tu meta de esta semana!</span>
        ) : (
          <>
            Te faltan {formatoDuracion(falta)}.{" "}
            <span className="text-tenue">
              {e.diasRestantes === 1
                ? "Hoy es el último día de la semana."
                : `Quedan ${e.diasRestantes} días: unos ${formatoDuracion(porDia)} al día.`}
            </span>
          </>
        )}
      </p>
      {e.racha > 0 && (
        <p className="mt-1 text-sm text-tenue">
          <span aria-hidden="true">🔥 </span>
          {e.racha === 1 ? "1 semana" : `${e.racha} semanas`} seguidas cumpliendo tu meta
        </p>
      )}
    </div>
  );
}
