"use client";

// Formulario para agregar un libro propio, de dos maneras:
//  - "Subir archivo": el navegador manda el PDF o ePub directo al almacén
//    privado de Supabase y después avisa al servidor para que lo registre.
//  - "Pegar enlace": se manda la dirección al servidor, que la revisa.

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { crearClienteNavegador } from "@/lib/supabase/cliente";
import { agregarEnlace, registrarArchivo } from "./acciones";

const TAMANO_MAXIMO = 50 * 1024 * 1024; // el mismo límite que el almacén
const TIPOS: Record<string, string> = {
  pdf: "application/pdf",
  epub: "application/epub+zip",
  cbz: "application/vnd.comicbook+zip", // cómic: un ZIP con las páginas
};

const campo =
  "h-12 w-full rounded-xl border border-borde bg-superficie px-4 text-base text-texto placeholder:text-tenue/70";
const etiqueta = "flex flex-col gap-2 text-sm text-tenue";

export function FormularioAgregar() {
  const router = useRouter();
  const [modo, setModo] = useState<"archivo" | "enlace">("archivo");
  const [archivo, setArchivo] = useState<File | null>(null);
  const [url, setUrl] = useState("");
  const [titulo, setTitulo] = useState("");
  const [autor, setAutor] = useState("");
  const [porPaginas, setPorPaginas] = useState(false);
  const [aviso, setAviso] = useState<{ tipo: "error" | "listo"; texto: string } | null>(null);
  const [trabajando, iniciar] = useTransition();

  function elegirArchivo(elegido: File | null) {
    setArchivo(elegido);
    // Se propone como título el nombre del archivo, sin la extensión.
    if (elegido && !titulo) {
      setTitulo(elegido.name.replace(/\.(pdf|epub|cbz)$/i, "").replace(/[_-]+/g, " "));
    }
  }

  async function subirArchivo(): Promise<{ ok: boolean; error?: string }> {
    if (!archivo) return { ok: false, error: "Elige un archivo PDF, ePub o CBZ." };
    const extension = archivo.name.split(".").pop()?.toLowerCase() ?? "";
    if (!TIPOS[extension]) {
      return { ok: false, error: "Solo se aceptan archivos PDF, ePub o CBZ (cómic)." };
    }
    if (archivo.size > TAMANO_MAXIMO) {
      return { ok: false, error: "El archivo pesa más de 50 MB." };
    }

    const supabase = crearClienteNavegador();
    const { data } = await supabase.auth.getUser();
    if (!data.user) return { ok: false, error: "Tu sesión terminó. Vuelve a entrar." };

    // Cada archivo va en la carpeta del usuario, con un nombre al azar.
    const ruta = `${data.user.id}/${crypto.randomUUID()}.${extension}`;
    const subida = await supabase.storage
      .from("libros")
      .upload(ruta, archivo, { contentType: TIPOS[extension] });
    if (subida.error) return { ok: false, error: "No se pudo subir el archivo." };

    return registrarArchivo(ruta, titulo, autor, porPaginas);
  }

  function enviar(evento: React.FormEvent) {
    evento.preventDefault();
    setAviso(null);
    iniciar(async () => {
      const resultado =
        modo === "archivo"
          ? await subirArchivo()
          : await agregarEnlace(url, titulo, autor);

      if (!resultado.ok) {
        setAviso({ tipo: "error", texto: resultado.error ?? "Algo salió mal." });
        return;
      }
      setAviso({ tipo: "listo", texto: `«${titulo}» se agregó a tus libros.` });
      setArchivo(null);
      setUrl("");
      setTitulo("");
      setAutor("");
      setPorPaginas(false);
      router.refresh(); // vuelve a pedir la lista para que aparezca el nuevo
    });
  }

  const pestana = (activa: boolean) =>
    `min-h-11 flex-1 rounded-xl border-2 px-4 text-sm font-semibold transition-colors ${
      activa ? "border-naranja bg-naranja text-negro" : "border-borde text-texto hover:border-naranja"
    }`;

  return (
    <form
      onSubmit={enviar}
      className="flex flex-col gap-5 rounded-2xl border border-borde bg-superficie p-5 md:p-7"
    >
      <div role="tablist" aria-label="Cómo agregar el libro" className="flex gap-2">
        <button
          type="button"
          role="tab"
          aria-selected={modo === "archivo"}
          onClick={() => setModo("archivo")}
          className={pestana(modo === "archivo")}
        >
          Subir archivo
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={modo === "enlace"}
          onClick={() => setModo("enlace")}
          className={pestana(modo === "enlace")}
        >
          Pegar enlace
        </button>
      </div>

      {modo === "archivo" ? (
        <div className="flex flex-col gap-3">
          <label className={etiqueta}>
            Archivo PDF, ePub o CBZ (máximo 50 MB)
            <input
              // Al cambiar "key" el campo se vacía después de subir.
              key={archivo ? "con-archivo" : "sin-archivo"}
              type="file"
              accept=".pdf,.epub,.cbz,application/pdf,application/epub+zip,application/vnd.comicbook+zip"
              onChange={(e) => elegirArchivo(e.target.files?.[0] ?? null)}
              className="rounded-xl border border-dashed border-borde p-3 text-sm text-texto file:mr-4 file:rounded-lg file:border-0 file:bg-naranja file:px-4 file:py-2 file:font-semibold file:text-negro"
            />
            {archivo && (
              <span className="text-texto">
                {archivo.name} · {(archivo.size / 1024 / 1024).toFixed(1)} MB
              </span>
            )}
          </label>
          <label className="flex cursor-pointer items-start gap-3 text-sm text-texto">
            <input
              type="checkbox"
              checked={porPaginas}
              onChange={(e) => setPorPaginas(e.target.checked)}
              className="mt-0.5 size-5 shrink-0 accent-naranja"
            />
            <span>
              Leer por páginas, como cómic
              <span className="block text-tenue">
                Para cómics, manga o libros escaneados. Los CBZ y los PDF
                escaneados se abren así solos.
              </span>
            </span>
          </label>
        </div>
      ) : (
        <label className={etiqueta}>
          Dirección del libro (PDF, ePub o página con el texto)
          <input
            type="url"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder="https://…"
            required
            className={campo}
          />
        </label>
      )}

      <div className="grid gap-5 sm:grid-cols-2">
        <label className={etiqueta}>
          Título
          <input
            value={titulo}
            onChange={(e) => setTitulo(e.target.value)}
            required
            maxLength={300}
            className={campo}
          />
        </label>
        <label className={etiqueta}>
          Autor (opcional)
          <input
            value={autor}
            onChange={(e) => setAutor(e.target.value)}
            maxLength={200}
            className={campo}
          />
        </label>
      </div>

      {aviso && (
        <p
          role={aviso.tipo === "error" ? "alert" : "status"}
          className={`rounded-xl border px-4 py-3 text-sm ${
            aviso.tipo === "error"
              ? "border-red-500/60 bg-red-500/10 text-texto"
              : "border-naranja/60 bg-naranja/10 text-texto"
          }`}
        >
          {aviso.texto}
        </p>
      )}

      <button type="submit" disabled={trabajando} className="boton-primario self-start px-8 disabled:opacity-60">
        {trabajando ? "Agregando… puede tardar un momento" : "Agregar a mis libros"}
      </button>
    </form>
  );
}
