"use client";

// PANTALLA "COMPARTIR SUBRAYADO"
// Muestra la imagen de la cita (src/lib/tarjetaCita.ts), deja elegir el
// fondo y la comparte. Lo que permite cada red desde una página web:
//   - WhatsApp y X: abren su app/sitio con el texto de la cita ya escrito.
//   - Facebook e Instagram: no aceptan texto ni imágenes desde un enlace.
//     En el teléfono se abre el menú de compartir del sistema con la
//     imagen (ahí aparecen Instagram y Facebook). En la computadora:
//     Facebook abre su ventana y la cita queda copiada para pegarla;
//     Instagram guarda la imagen para subirla desde la app.

import { useEffect, useState } from "react";
import { IconoAtras } from "@/components/Iconos";
import {
  FONDOS,
  dibujarTarjeta,
  textoDeCita,
  type Fondo,
} from "@/lib/tarjetaCita";

const FONDO_GUARDADO = "lumbre-fondo-cita";

type Cita = { texto: string; titulo: string; autor: string };

function leerFondo(): Fondo {
  try {
    const f = localStorage.getItem(FONDO_GUARDADO);
    if (f === "blanca" || f === "amarilla" || f === "negra") return f;
  } catch {}
  return "blanca";
}

export function CompartirCita({ cita, alCerrar }: { cita: Cita; alCerrar: () => void }) {
  const [fondo, setFondo] = useState<Fondo>(leerFondo);
  const [imagen, setImagen] = useState<{ blob: Blob; url: string } | null>(null);
  const [aviso, setAviso] = useState("");

  // Dibuja la imagen cada vez que cambia el fondo.
  useEffect(() => {
    let vigente = true;
    let url = "";
    dibujarTarjeta({ ...cita, fondo })
      .then((blob) => {
        if (!vigente) return;
        url = URL.createObjectURL(blob);
        setImagen({ blob, url });
      })
      .catch(() => vigente && setAviso("No se pudo crear la imagen en este navegador."));
    return () => {
      vigente = false;
      if (url) URL.revokeObjectURL(url);
    };
  }, [cita, fondo]);

  // Esc cierra la pantalla.
  useEffect(() => {
    const alTecla = (e: KeyboardEvent) => e.key === "Escape" && alCerrar();
    window.addEventListener("keydown", alTecla);
    return () => window.removeEventListener("keydown", alTecla);
  }, [alCerrar]);

  const texto = textoDeCita(cita);
  const archivo = () =>
    imagen ? new File([imagen.blob], "lumbre-cita.png", { type: "image/png" }) : null;

  function elegirFondo(f: Fondo) {
    setFondo(f);
    try {
      localStorage.setItem(FONDO_GUARDADO, f);
    } catch {}
  }

  async function copiar(mensaje = "Cita copiada.") {
    try {
      await navigator.clipboard.writeText(texto);
      setAviso(mensaje);
      return;
    } catch {}
    // Respaldo para navegadores que no dejan usar el portapapeles moderno.
    const area = document.createElement("textarea");
    area.value = texto;
    area.setAttribute("readonly", "");
    area.style.position = "fixed";
    area.style.opacity = "0";
    document.body.appendChild(area);
    area.select();
    const ok = document.execCommand("copy");
    area.remove();
    setAviso(ok ? mensaje : "No se pudo copiar en este navegador.");
  }

  function guardar(mensaje = "Imagen guardada.") {
    if (!imagen) return;
    const enlace = document.createElement("a");
    enlace.href = imagen.url;
    enlace.download = "lumbre-cita.png";
    enlace.click();
    setAviso(mensaje);
  }

  // Menú de compartir del teléfono, con la imagen. Devuelve false si el
  // navegador no lo tiene (computadora) para usar otra salida.
  async function compartirImagen(): Promise<boolean> {
    const f = archivo();
    if (!f || !navigator.canShare?.({ files: [f] })) return false;
    try {
      await navigator.share({ files: [f], text: texto });
    } catch {
      // La persona cerró el menú: no es un error.
    }
    return true;
  }

  function abrir(url: string) {
    window.open(url, "_blank", "noopener,noreferrer");
  }

  async function enFacebook() {
    if (await compartirImagen()) return;
    abrir(`https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent("https://lumbre.uk")}`);
    await copiar("Copiamos la cita: pégala en tu publicación de Facebook.");
  }

  async function enInstagram() {
    if (await compartirImagen()) return;
    guardar("Guardamos la imagen. Súbela desde la app de Instagram en tu teléfono.");
  }

  function enX() {
    // X permite 280 caracteres; el enlace cuenta como 23.
    const corto = textoDeCita({ ...cita, maximo: 170 });
    abrir(`https://x.com/intent/post?text=${encodeURIComponent(corto)}`);
  }

  function enWhatsApp() {
    abrir(`https://wa.me/?text=${encodeURIComponent(texto)}`);
  }

  const botonRed =
    "min-h-12 rounded-xl border border-orilla-borde bg-orilla-superficie font-semibold text-orilla-texto transition-colors hover:border-naranja disabled:opacity-50";
  const etiqueta = "mb-2 text-xs font-semibold uppercase tracking-widest text-orilla-tenue";

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Compartir subrayado"
      // Los clics no deben llegar al fondo del panel de notas (lo cerraría).
      onClick={(e) => e.stopPropagation()}
      className="fixed inset-0 z-40 flex flex-col bg-orilla text-orilla-texto"
    >
      <header className="flex items-center gap-3 border-b border-orilla-borde px-4 py-3">
        <button
          type="button"
          onClick={alCerrar}
          aria-label="Volver"
          className="flex size-11 shrink-0 items-center justify-center rounded-full border border-orilla-borde text-naranja hover:border-naranja"
        >
          <IconoAtras />
        </button>
        <h2 className="font-serif text-2xl font-semibold">Compartir subrayado</h2>
      </header>

      <div className="flex-1 overflow-y-auto px-4 py-5">
        <div className="mx-auto flex max-w-md flex-col gap-6">
          {/* Vista previa: es la misma imagen que se comparte */}
          <div className="flex aspect-[4/5] items-center justify-center overflow-hidden rounded-3xl bg-negro">
            {imagen ? (
              // eslint-disable-next-line @next/next/no-img-element -- es una imagen generada en el navegador
              <img
                src={imagen.url}
                alt={`Tarjeta con la cita: “${cita.texto.slice(0, 120)}”`}
                className="h-full w-full object-contain"
              />
            ) : (
              <p className="text-orilla-tenue">Preparando la imagen…</p>
            )}
          </div>

          <div>
            <p className={etiqueta}>Fondo de la tarjeta</p>
            <div role="radiogroup" aria-label="Fondo de la tarjeta" className="grid grid-cols-3 gap-2">
              {FONDOS.map((f) => (
                <button
                  key={f.id}
                  type="button"
                  role="radio"
                  aria-checked={fondo === f.id}
                  onClick={() => elegirFondo(f.id)}
                  className={`flex min-h-12 items-center justify-center gap-2 rounded-xl border-2 text-sm font-semibold transition-colors ${
                    fondo === f.id
                      ? "border-naranja bg-naranja/15"
                      : "border-orilla-borde hover:border-naranja/60"
                  }`}
                >
                  <span
                    className="size-4 rounded-full border border-neutral-400"
                    style={{ background: f.muestra }}
                  />
                  {f.nombre}
                </button>
              ))}
            </div>
          </div>

          <div>
            <p className={etiqueta}>Compartir en</p>
            <div className="grid grid-cols-2 gap-2">
              <button type="button" onClick={enFacebook} disabled={!imagen} className={botonRed}>
                Facebook
              </button>
              <button type="button" onClick={enInstagram} disabled={!imagen} className={botonRed}>
                Instagram
              </button>
              <button type="button" onClick={enX} className={botonRed}>
                X
              </button>
              <button type="button" onClick={enWhatsApp} className={botonRed}>
                WhatsApp
              </button>
            </div>
          </div>

          <p role="status" aria-live="polite" className="min-h-5 text-sm text-orilla-tenue">
            {aviso}
          </p>
        </div>
      </div>

      <footer className="grid grid-cols-2 gap-3 border-t border-orilla-borde px-4 py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
        <button
          type="button"
          onClick={() => void copiar()}
          className="min-h-12 rounded-xl border-2 border-naranja font-semibold text-naranja transition-colors hover:bg-naranja/10"
        >
          Copiar texto
        </button>
        <button
          type="button"
          onClick={() => guardar()}
          disabled={!imagen}
          className="boton-primario min-h-12 disabled:opacity-50"
        >
          Guardar imagen
        </button>
      </footer>
    </div>
  );
}
