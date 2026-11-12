// Sección "Tiempo de lectura" de Mi perfil: cuánto has leído esta semana y
// este mes (solo con un libro abierto y leyendo, no el tiempo en la página),
// una barra por día de esta semana y los libros que más leíste en el mes.

import {
  estadisticasDeLectura,
  formatoDuracion,
  type Estadisticas,
} from "@/lib/estadisticasLectura";
import { obtenerUsuario } from "@/lib/sesion";
import { AvanceMeta } from "./AvanceMeta";
import { EditorMeta } from "./EditorMeta";

function Comparacion({ ahora, antes, periodo }: { ahora: number; antes: number; periodo: string }) {
  if (antes === 0) {
    return <p className="mt-1 text-sm text-tenue">Sin lectura {periodo}.</p>;
  }
  const diferencia = ahora - antes;
  return (
    <p className="mt-1 text-sm text-tenue">
      {formatoDuracion(antes)} {periodo}
      {Math.abs(diferencia) >= 60 && (
        <>
          {" · "}
          {diferencia > 0 ? "▲" : "▼"} {formatoDuracion(Math.abs(diferencia))}
        </>
      )}
    </p>
  );
}

function Grafica({ dias }: { dias: Estadisticas["dias"] }) {
  // La escala llega por lo menos a 30 min, para que un día de 2 minutos
  // no se vea como una barra llena.
  const tope = Math.max(30 * 60, ...dias.map((d) => d.segundos));
  const mayor = dias.reduce((m, d) => (d.segundos > m.segundos ? d : m), dias[0]);

  return (
    <figure className="mt-6">
      <figcaption className="mb-3 text-sm font-semibold">Minutos por día, esta semana</figcaption>
      {/* La gráfica es para la vista; los lectores de pantalla leen la tabla. */}
      <div aria-hidden="true" className="flex h-40 items-end gap-2 border-b border-borde sm:gap-4">
        {dias.map((d) => {
          const minutos = Math.floor(d.segundos / 60);
          // Rótulo solo en el día de hoy y en el de más lectura.
          const conRotulo = d.segundos > 0 && (d.esHoy || d === mayor);
          return (
            <div
              key={d.dia}
              title={`${d.nombre}: ${formatoDuracion(d.segundos)}`}
              className="group relative flex h-full flex-1 flex-col items-center justify-end"
            >
              {conRotulo && (
                <span className="mb-1 text-xs font-semibold text-texto">
                  {minutos < 1 ? "<1" : minutos} min
                </span>
              )}
              <span
                className="w-full max-w-8 rounded-t-[4px] bg-acento transition-opacity group-hover:opacity-80"
                style={{ height: d.segundos > 0 ? `max(${(d.segundos / tope) * 100}%, 3px)` : 0 }}
              />
              {/* Valor al pasar el mouse por cualquier barra */}
              <span className="pointer-events-none absolute -top-7 hidden whitespace-nowrap rounded-md border border-borde bg-superficie px-2 py-0.5 text-xs text-texto shadow group-hover:block">
                {formatoDuracion(d.segundos)}
              </span>
            </div>
          );
        })}
      </div>
      <div aria-hidden="true" className="mt-2 flex gap-2 sm:gap-4">
        {dias.map((d) => (
          <span
            key={d.dia}
            className={`flex-1 text-center text-xs ${d.esHoy ? "font-bold text-texto" : "text-tenue"}`}
          >
            {d.nombre}
          </span>
        ))}
      </div>
      <table className="sr-only">
        <caption>Tiempo de lectura por día de esta semana</caption>
        <tbody>
          {dias.map((d) => (
            <tr key={d.dia}>
              <th scope="row">
                {d.nombre}
                {d.esHoy ? " (hoy)" : ""}
              </th>
              <td>{formatoDuracion(d.segundos)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </figure>
  );
}

export async function TiempoDeLectura() {
  const usuario = await obtenerUsuario();
  if (!usuario) return null;
  const e = await estadisticasDeLectura(usuario.id);

  return (
    <div className="rounded-2xl border border-borde bg-superficie p-5">
      <div className="grid gap-5 sm:grid-cols-2">
        <div>
          <p className="text-sm text-tenue">Esta semana</p>
          <p className="font-serif text-4xl font-semibold">{formatoDuracion(e.semana)}</p>
          <Comparacion ahora={e.semana} antes={e.semanaPasada} periodo="la semana pasada" />
        </div>
        <div>
          <p className="text-sm text-tenue">En {e.nombreMes}</p>
          <p className="font-serif text-4xl font-semibold">{formatoDuracion(e.mes)}</p>
          <Comparacion ahora={e.mes} antes={e.mesPasado} periodo="el mes pasado" />
        </div>
      </div>

      {/* Meta semanal */}
      <div id="meta" className="mt-6 scroll-mt-24 border-t border-borde pt-5">
        {e.meta ? (
          <AvanceMeta e={e} />
        ) : (
          <p className="text-tenue">
            Ponte una meta de minutos por semana para leer con constancia.
          </p>
        )}
        <div className="mt-3">
          <EditorMeta meta={e.meta} />
        </div>
      </div>

      <Grafica dias={e.dias} />

      {e.masLeidos.length > 0 && (
        <div className="mt-6">
          <p className="mb-2 text-sm font-semibold">Lo que más leíste en {e.nombreMes}</p>
          <ol className="flex flex-col gap-1.5">
            {e.masLeidos.map((l, i) => (
              <li key={i} className="flex items-baseline justify-between gap-3">
                <span className="min-w-0 truncate">{l.titulo}</span>
                <span className="shrink-0 text-sm text-tenue">{formatoDuracion(l.segundos)}</span>
              </li>
            ))}
          </ol>
        </div>
      )}
    </div>
  );
}
