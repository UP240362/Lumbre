"use client";

// Para elegir, cambiar o quitar la meta de lectura semanal.

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { guardarMeta } from "@/app/acciones-meta";

const OPCIONES = [30, 60, 120, 180, 300, 420]; // minutos por semana

const nombre = (minutos: number) =>
  minutos < 60 ? `${minutos} min` : minutos % 60 === 0 ? `${minutos / 60} h` : `${(minutos / 60).toFixed(1)} h`;

export function EditorMeta({ meta }: { meta: number | null }) {
  const router = useRouter();
  const [abierto, setAbierto] = useState(false);
  const [elegida, setElegida] = useState<number | null>(meta);
  const [otra, setOtra] = useState(
    meta && !OPCIONES.includes(meta) ? String(meta) : "",
  );
  const [error, setError] = useState("");
  const [enviando, iniciar] = useTransition();

  if (!abierto) {
    return (
      <button
        type="button"
        onClick={() => setAbierto(true)}
        className="font-semibold text-acento underline underline-offset-4"
      >
        {meta ? "Cambiar mi meta" : "Ponerme una meta semanal"}
      </button>
    );
  }

  function guardar(valor: number | null) {
    setError("");
    iniciar(async () => {
      const r = await guardarMeta(valor).catch(() => ({ ok: false }));
      if (!r.ok) {
        setError("No se pudo guardar. Revisa tu conexión e intenta de nuevo.");
        return;
      }
      setAbierto(false);
      router.refresh();
    });
  }

  function guardarElegida() {
    const minutos = otra ? Number.parseInt(otra, 10) : elegida;
    if (!minutos || !Number.isInteger(minutos) || minutos < 10 || minutos > 10080) {
      setError("Elige una meta de 10 minutos a 168 horas.");
      return;
    }
    guardar(minutos);
  }

  return (
    <div className="rounded-xl border border-borde p-4">
      <p className="font-semibold">¿Cuánto quieres leer cada semana?</p>
      <div role="radiogroup" aria-label="Meta semanal" className="mt-3 flex flex-wrap gap-2">
        {OPCIONES.map((m) => {
          const activa = !otra && elegida === m;
          return (
            <button
              key={m}
              type="button"
              role="radio"
              aria-checked={activa}
              onClick={() => {
                setElegida(m);
                setOtra("");
              }}
              className={`min-h-10 rounded-full border-2 px-4 text-sm font-semibold transition-colors ${
                activa ? "border-naranja bg-naranja text-negro" : "border-borde hover:border-naranja"
              }`}
            >
              {nombre(m)}
            </button>
          );
        })}
      </div>
      <label className="mt-3 flex items-center gap-2 text-sm">
        <span className="text-tenue">Otra:</span>
        <input
          type="number"
          inputMode="numeric"
          min={10}
          max={10080}
          value={otra}
          onChange={(e) => setOtra(e.target.value)}
          className="h-10 w-24 rounded-lg border border-borde bg-superficie px-2"
        />
        <span className="text-tenue">minutos</span>
      </label>
      {error && (
        <p role="alert" className="mt-2 text-sm font-semibold text-acento">
          {error}
        </p>
      )}
      <div className="mt-4 flex flex-wrap gap-3">
        <button
          type="button"
          onClick={guardarElegida}
          disabled={enviando}
          className="boton-primario disabled:opacity-50"
        >
          {enviando ? "Guardando…" : "Guardar meta"}
        </button>
        {meta && (
          <button
            type="button"
            onClick={() => guardar(null)}
            disabled={enviando}
            className="min-h-11 rounded-xl border-2 border-borde px-4 font-semibold hover:border-naranja disabled:opacity-50"
          >
            Quitar meta
          </button>
        )}
        <button
          type="button"
          onClick={() => setAbierto(false)}
          className="min-h-11 px-2 text-tenue underline underline-offset-4"
        >
          Cancelar
        </button>
      </div>
    </div>
  );
}
