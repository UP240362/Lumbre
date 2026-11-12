"use client";

// Poner, cambiar o quitar la foto de perfil.
// La foto se recorta EN EL NAVEGADOR: la persona la acomoda dentro del
// círculo (arrastrando y con el control de acercar) y se manda solo un
// cuadro de 512 × 512. Al redibujarla se pierden los datos ocultos de la
// foto original (como la ubicación GPS).

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, useTransition } from "react";
import { quitarFoto, subirFoto } from "@/app/acciones-foto";
import { FotoPerfil } from "./FotoPerfil";

const VISOR = 256; // tamaño del círculo para acomodar, en px
const SALIDA = 512; // tamaño de la foto guardada

type Recorte = { img: HTMLImageElement; url: string; zoom: number; x: number; y: number };

// Tamaño en pantalla de la imagen para un zoom (cubre siempre el círculo).
function medidas(img: HTMLImageElement, zoom: number) {
  const base = VISOR / Math.min(img.naturalWidth, img.naturalHeight);
  return { w: img.naturalWidth * base * zoom, h: img.naturalHeight * base * zoom };
}

// Que la imagen nunca deje huecos dentro del círculo.
function acotar(r: Recorte): Recorte {
  const { w, h } = medidas(r.img, r.zoom);
  const mx = (w - VISOR) / 2;
  const my = (h - VISOR) / 2;
  return { ...r, x: Math.max(-mx, Math.min(mx, r.x)), y: Math.max(-my, Math.min(my, r.y)) };
}

async function exportar(r: Recorte): Promise<Blob> {
  const lienzo = document.createElement("canvas");
  lienzo.width = SALIDA;
  lienzo.height = SALIDA;
  const ctx = lienzo.getContext("2d");
  if (!ctx) throw new Error("sin canvas");
  const k = SALIDA / VISOR;
  const { w, h } = medidas(r.img, r.zoom);
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(r.img, (VISOR / 2 + r.x - w / 2) * k, (VISOR / 2 + r.y - h / 2) * k, w * k, h * k);
  const comoBlob = (tipo: string, calidad: number) =>
    new Promise<Blob | null>((ok) => lienzo.toBlob(ok, tipo, calidad));
  // WebP pesa menos; algunos navegadores (Safari) no lo generan y dan PNG.
  const webp = await comoBlob("image/webp", 0.85);
  if (webp?.type === "image/webp") return webp;
  const jpeg = await comoBlob("image/jpeg", 0.88);
  if (!jpeg) throw new Error("sin imagen");
  return jpeg;
}

export function EditorFoto({ version, nombre }: { version: number | null; nombre: string | null }) {
  const router = useRouter();
  const entrada = useRef<HTMLInputElement>(null);
  const [recorte, setRecorte] = useState<Recorte | null>(null);
  const [error, setError] = useState("");
  const [enviando, iniciar] = useTransition();
  const arrastre = useRef<{ x: number; y: number; ox: number; oy: number } | null>(null);

  // Libera la imagen elegida cuando se cierra el editor o se elige otra
  // (depende de la dirección, no del recorte, que cambia al arrastrar).
  const urlElegida = recorte?.url;
  useEffect(() => () => {
    if (urlElegida) URL.revokeObjectURL(urlElegida);
  }, [urlElegida]);

  function elegir(archivo: File | undefined) {
    setError("");
    if (!archivo) return;
    if (!archivo.type.startsWith("image/")) {
      setError("Elige una imagen (JPG, PNG o WebP).");
      return;
    }
    if (archivo.size > 25 * 1024 * 1024) {
      setError("La imagen pesa demasiado (máximo 25 MB).");
      return;
    }
    const url = URL.createObjectURL(archivo);
    const img = new Image();
    img.onload = () => setRecorte({ img, url, zoom: 1, x: 0, y: 0 });
    img.onerror = () => {
      URL.revokeObjectURL(url);
      setError("No se pudo abrir esa imagen. Prueba con otra (JPG o PNG).");
    };
    img.src = url;
  }

  function guardar() {
    if (!recorte) return;
    iniciar(async () => {
      try {
        const blob = await exportar(recorte);
        const datos = new FormData();
        datos.append("foto", blob, "foto");
        const r = await subirFoto(datos);
        if (!r.ok) {
          setError(r.error);
          return;
        }
        setRecorte(null);
        router.refresh();
      } catch {
        setError("No se pudo guardar. Revisa tu conexión e intenta de nuevo.");
      }
    });
  }

  function quitar() {
    if (!confirm("¿Quitar tu foto de perfil?")) return;
    iniciar(async () => {
      const r = await quitarFoto().catch(() => ({ ok: false as const, error: "Sin conexión." }));
      if (r.ok) router.refresh();
      else setError(r.error);
    });
  }

  const tam = recorte ? medidas(recorte.img, recorte.zoom) : null;

  return (
    <div className="flex flex-wrap items-center gap-5">
      <FotoPerfil version={version} nombre={nombre} className="size-24" texto="text-4xl" />
      <div className="flex flex-col items-start gap-2">
        <button
          type="button"
          onClick={() => entrada.current?.click()}
          className="boton-primario"
        >
          {version ? "Cambiar foto" : "Agregar foto"}
        </button>
        {version && (
          <button
            type="button"
            onClick={quitar}
            disabled={enviando}
            className="text-sm text-tenue underline underline-offset-4 disabled:opacity-50"
          >
            Quitar foto
          </button>
        )}
        <input
          ref={entrada}
          type="file"
          accept="image/*"
          className="sr-only"
          tabIndex={-1}
          aria-hidden="true"
          onChange={(e) => {
            elegir(e.target.files?.[0]);
            e.target.value = ""; // para poder elegir la misma imagen otra vez
          }}
        />
        {error && !recorte && (
          <p role="alert" className="text-sm font-semibold text-acento">
            {error}
          </p>
        )}
      </div>

      {/* Editor para acomodar la foto dentro del círculo */}
      {recorte && tam && (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/70 p-4">
          <div
            role="dialog"
            aria-modal="true"
            aria-label="Acomodar foto de perfil"
            className="w-full max-w-sm rounded-2xl border-2 border-naranja bg-orilla p-5 text-orilla-texto"
          >
            <h2 className="font-serif text-2xl font-semibold">Acomoda tu foto</h2>
            <p className="mt-1 text-sm text-orilla-tenue">Arrástrala y acércala para elegir qué se ve.</p>

            <div
              className="relative mx-auto mt-5 cursor-grab touch-none select-none overflow-hidden rounded-full ring-4 ring-naranja active:cursor-grabbing"
              style={{ width: VISOR, height: VISOR }}
              onPointerDown={(e) => {
                e.currentTarget.setPointerCapture(e.pointerId);
                arrastre.current = { x: e.clientX, y: e.clientY, ox: recorte.x, oy: recorte.y };
              }}
              onPointerMove={(e) => {
                const a = arrastre.current;
                if (!a) return;
                setRecorte((r) =>
                  r && acotar({ ...r, x: a.ox + e.clientX - a.x, y: a.oy + e.clientY - a.y }),
                );
              }}
              onPointerUp={() => (arrastre.current = null)}
              onPointerCancel={() => (arrastre.current = null)}
              onWheel={(e) =>
                setRecorte((r) =>
                  r && acotar({ ...r, zoom: Math.min(4, Math.max(1, r.zoom - e.deltaY * 0.002)) }),
                )
              }
            >
              {/* eslint-disable-next-line @next/next/no-img-element -- imagen local elegida por la persona */}
              <img
                src={recorte.url}
                alt="Tu foto"
                draggable={false}
                className="pointer-events-none absolute left-1/2 top-1/2 max-w-none"
                style={{
                  width: tam.w,
                  height: tam.h,
                  transform: `translate(-50%, -50%) translate(${recorte.x}px, ${recorte.y}px)`,
                }}
              />
            </div>

            <label className="mt-5 flex items-center gap-3 text-sm">
              <span className="text-orilla-tenue">Acercar</span>
              <input
                type="range"
                min={1}
                max={4}
                step={0.01}
                value={recorte.zoom}
                onChange={(e) =>
                  setRecorte((r) => r && acotar({ ...r, zoom: Number(e.target.value) }))
                }
                className="flex-1 accent-naranja"
              />
            </label>

            {error && (
              <p role="alert" className="mt-3 text-sm font-semibold text-naranja">
                {error}
              </p>
            )}

            <div className="mt-5 grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => {
                  setRecorte(null);
                  setError("");
                }}
                className="min-h-11 rounded-xl border-2 border-orilla-borde font-semibold hover:border-naranja"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={guardar}
                disabled={enviando}
                className="boton-primario disabled:opacity-50"
              >
                {enviando ? "Guardando…" : "Guardar foto"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
