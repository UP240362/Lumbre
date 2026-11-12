import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { IconoAtras } from "@/components/Iconos";
import { claveLibro, obtenerClavesFavoritas } from "@/lib/favoritos";
import { esFuente, leerLibro, obtenerLibro } from "@/lib/fuentes";
import { NOMBRES_FUENTE } from "@/lib/fuentes/tipos";
import { largoDe } from "@/lib/lectura/repartir";
import { obtenerPerfil } from "@/lib/sesion";
import { COLUMNAS_SUBRAYADO, type Subrayado } from "@/lib/subrayados";
import { crearClienteServidor } from "@/lib/supabase/servidor";
import { VistaLector } from "./VistaLector";

// PÁGINA DEL LECTOR: /leer/<fuente>/<id>?c=<capítulo>
// Los corchetes en las carpetas [fuente] y [id] significan que esa parte de
// la dirección es variable. "?c=3" indica el capítulo; si no viene, se abre
// donde el usuario se quedó la última vez.

type Parametros = PageProps<"/leer/[fuente]/[id]">;

// Marco sencillo (barra negra + área de contenido) para mensajes.
function Marco({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-dvh flex-col bg-orilla">
      <header className="flex h-14 items-center gap-4 border-b-2 border-naranja px-3 sm:px-5">
        <Link
          href="/"
          aria-label="Volver a la biblioteca"
          className="flex size-10 items-center justify-center rounded-full border border-orilla-borde text-naranja"
        >
          <IconoAtras />
        </Link>
        <span className="font-serif text-2xl font-bold text-naranja">
          Lumbre
        </span>
      </header>
      <main className="flex-1 bg-fondo px-5 py-10 text-texto">
        <div className="lectura mx-auto font-sans text-base text-tenue">
          {children}
        </div>
      </main>
    </div>
  );
}

async function Lector({ params, searchParams }: Parametros) {
  const perfil = await obtenerPerfil(); // exige sesión iniciada
  const { fuente, id: idCrudo } = await params;
  const { c, s } = await searchParams;
  if (!esFuente(fuente)) notFound();
  const id = decodeURIComponent(idCrudo);

  // 1. Datos del libro (título, autor, dónde está su texto).
  const libro = await obtenerLibro(fuente, id).catch(() => undefined);
  if (libro === null) notFound();
  if (libro === undefined) {
    return (
      <Marco>
        <p role="alert">
          No pudimos consultar {NOMBRES_FUENTE[fuente]} en este momento.
          Intenta de nuevo en un minuto.
        </p>
      </Marco>
    );
  }

  // 2. El texto, ya separado en capítulos.
  const capitulos = await leerLibro(libro).catch(() => null);
  if (!capitulos || capitulos.length === 0) {
    return (
      <Marco>
        <p role="alert">
          No pudimos abrir el texto de «{libro.titulo}» desde{" "}
          {NOMBRES_FUENTE[fuente]}. Puede que esta edición no tenga texto
          disponible; prueba con otra edición desde Explorar.
        </p>
      </Marco>
    );
  }

  // 3. ¿Qué capítulo mostrar? El de la dirección o, si no viene, el guardado.
  const largos = capitulos.map(largoDe);
  const letrasTotal = largos.reduce((suma, largo) => suma + largo, 0);
  const letrasAntesDe = (n: number) =>
    largos.slice(0, n).reduce((suma, largo) => suma + largo, 0);
  const ultimo = capitulos.length - 1;

  // Subrayados y notas de este libro (de todos sus capítulos, para el panel).
  const supabase = await crearClienteServidor();
  const { data: filasSubrayados } = await supabase
    .from("subrayados")
    .select(COLUMNAS_SUBRAYADO)
    .eq("fuente", fuente)
    .eq("book_id", id)
    .order("creado_en");
  const subrayados = (filasSubrayados ?? []) as Subrayado[];
  // "?s=<id>" pide abrir el libro justo en ese subrayado.
  const objetivo =
    typeof s === "string" ? subrayados.find((x) => x.id === s) : undefined;

  let indice = 0;
  let fraccionInicial = 0;
  const pedido = typeof c === "string" ? Number.parseInt(c, 10) : Number.NaN;

  if (Number.isInteger(pedido)) {
    indice = Math.min(ultimo, Math.max(0, pedido - 1));
  } else if (objetivo) {
    indice = Math.min(ultimo, objetivo.capitulo);
  } else {
    const { data } = await supabase
      .from("progreso_lectura")
      .select("capitulo, porcentaje")
      .eq("fuente", fuente)
      .eq("book_id", id)
      .maybeSingle();

    if (data) {
      indice = Math.min(ultimo, Math.max(0, data.capitulo));
      // Del porcentaje del libro se despeja en qué punto del capítulo iba.
      const letrasLeidas = (Number(data.porcentaje) / 100) * letrasTotal;
      const dentro = letrasLeidas - letrasAntesDe(indice);
      fraccionInicial =
        largos[indice] > 0 ? Math.min(1, Math.max(0, dentro / largos[indice])) : 0;
    }
  }

  const favoritos = await obtenerClavesFavoritas();

  return (
    <VistaLector
      // "key" hace que el lector empiece de cero al cambiar de capítulo.
      key={indice}
      usuarioId={perfil.id}
      libro={{
        id: libro.id,
        fuente: libro.fuente,
        titulo: libro.titulo,
        autor: libro.autores.join(", "),
        idioma: libro.idiomas[0],
      }}
      rutaBase={`/leer/${fuente}/${encodeURIComponent(id)}`}
      indice={indice}
      titulos={capitulos.map((capitulo) => capitulo.titulo)}
      parrafos={capitulos[indice].parrafos}
      letrasAntes={letrasAntesDe(indice)}
      letrasCapitulo={largos[indice]}
      letrasTotal={letrasTotal}
      fraccionInicial={fraccionInicial}
      esFavorito={favoritos.has(claveLibro(libro))}
      subrayados={subrayados}
      subrayadoInicial={objetivo?.capitulo === indice ? objetivo.id : null}
    />
  );
}

export default function PaginaLector(props: Parametros) {
  return (
    <Suspense
      fallback={
        <Marco>
          <p>Abriendo el libro…</p>
        </Marco>
      }
    >
      <Lector {...props} />
    </Suspense>
  );
}
