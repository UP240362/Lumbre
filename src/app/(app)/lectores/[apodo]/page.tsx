import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import type { Relacion } from "@/app/acciones-social";
import { BotonesAmistad } from "@/components/Amistad";
import { Estrellas } from "@/components/Estrellas";
import { FotoPerfil } from "@/components/FotoPerfil";
import { RejillaLibros, rutaLibro, type DatosTarjeta } from "@/components/TarjetaLibro";
import { formatoDuracion } from "@/lib/estadisticasLectura";
import { obtenerClavesFavoritas } from "@/lib/favoritos";
import { esFuente } from "@/lib/fuentes";
import { crearClienteServidor } from "@/lib/supabase/servidor";

// PERFIL DE UN LECTOR (lo que ven los demás).
// Todo viene de la función perfil_lector de la base de datos, que solo
// devuelve lo que la privacidad de ese lector permite ver a quien pregunta.

type PerfilLector = {
  apodo: string;
  relacion: Relacion | "yo";
  visible: boolean;
  visibilidad: "publico" | "amigos" | "privado";
  foto_version: number | null;
  amigos: number;
  tiempo_semana?: number;
  favoritos?: { fuente: string; id: string; titulo: string; autor: string | null }[];
  resenas?: {
    fuente: string;
    id: string;
    titulo: string;
    autor: string | null;
    calificacion: number;
    texto: string | null;
    fecha: string;
  }[];
  gustos?: string[];
};

export async function generateMetadata({ params }: PageProps<"/lectores/[apodo]">) {
  const { apodo } = await params;
  return { title: `@${decodeURIComponent(apodo)} · Lumbre` };
}

const NOMBRE_VISIBILIDAD = {
  publico: "Perfil público",
  amigos: "Visible solo para amigos",
  privado: "Perfil privado",
};

function Seccion({ titulo, children }: { titulo: string; children: React.ReactNode }) {
  return (
    <section>
      <h2 className="mb-4 text-xl font-semibold">{titulo}</h2>
      {children}
    </section>
  );
}

async function Contenido({ params }: { params: PageProps<"/lectores/[apodo]">["params"] }) {
  const { apodo: crudo } = await params;
  const apodo = decodeURIComponent(crudo).toLowerCase();
  if (!/^[a-z0-9_.]{3,20}$/.test(apodo)) notFound();

  const supabase = await crearClienteServidor();
  const { data } = await supabase.rpc("perfil_lector", { p_apodo: apodo });
  if (!data) notFound();
  const p = data as PerfilLector;
  const esYo = p.relacion === "yo";

  const favoritos: DatosTarjeta[] = (p.favoritos ?? [])
    .filter((f) => esFuente(f.fuente))
    .map((f) => ({ id: f.id, fuente: f.fuente as DatosTarjeta["fuente"], titulo: f.titulo, autor: f.autor ?? "" }));
  const misFavoritos = favoritos.length > 0 ? await obtenerClavesFavoritas() : new Set<string>();
  const nada =
    p.visible &&
    p.tiempo_semana === undefined &&
    !p.favoritos &&
    !p.resenas &&
    !p.gustos;

  return (
    <div className="flex flex-col gap-10">
      <header className="flex flex-wrap items-center gap-5">
        <FotoPerfil
          version={p.foto_version}
          nombre={p.apodo}
          de={esYo ? undefined : p.apodo}
          className="size-24"
          texto="text-4xl"
        />
        <div className="min-w-0 flex-1">
          <h1 className="break-all font-serif text-3xl font-semibold md:text-4xl">@{p.apodo}</h1>
          <p className="mt-1 text-tenue">
            {p.amigos === 1 ? "1 amigo" : `${p.amigos} amigos`}
            {(esYo || p.visible) && <> · {NOMBRE_VISIBILIDAD[p.visibilidad]}</>}
          </p>
        </div>
        {esYo ? (
          <Link href="/perfil#publico" className="boton-primario">
            Editar privacidad
          </Link>
        ) : (
          <BotonesAmistad apodo={p.apodo} relacion={p.relacion as Relacion} />
        )}
      </header>

      {esYo && (
        <p className="rounded-xl border border-dashed border-borde p-4 text-sm text-tenue">
          Así ven tu perfil{" "}
          {p.visibilidad === "publico"
            ? "todos los lectores"
            : p.visibilidad === "amigos"
              ? "tus amigos (los demás solo ven tu apodo)"
              : "… nadie: es privado. Los demás solo ven tu apodo"}
          .
        </p>
      )}

      {!p.visible && (
        <div className="rounded-2xl border border-borde bg-superficie p-6 text-center">
          <p className="text-lg font-semibold">
            {p.visibilidad === "privado" ? "Este perfil es privado" : "Solo sus amigos ven este perfil"}
          </p>
          {p.visibilidad === "amigos" && p.relacion !== "amigo" && (
            <p className="mt-1 text-tenue">Mándale una solicitud de amistad para ver su lectura.</p>
          )}
        </div>
      )}

      {nada && <p className="text-tenue">Este lector no comparte nada en su perfil por ahora.</p>}

      {p.tiempo_semana !== undefined && (
        <Seccion titulo="Esta semana">
          <div className="rounded-2xl border border-borde bg-superficie p-5">
            <p className="text-sm text-tenue">Tiempo de lectura</p>
            <p className="font-serif text-4xl font-semibold">{formatoDuracion(p.tiempo_semana)}</p>
          </div>
        </Seccion>
      )}

      {p.gustos && (
        <Seccion titulo="Autores preferidos">
          {p.gustos.length === 0 ? (
            <p className="text-tenue">Aún no ha elegido autores.</p>
          ) : (
            <ul className="flex flex-wrap gap-2">
              {p.gustos.map((g) => (
                <li key={g}>
                  <Link
                    href={`/explorar?q=${encodeURIComponent(g)}`}
                    className="inline-flex min-h-10 items-center rounded-full border border-borde bg-superficie px-4 hover:border-naranja"
                  >
                    {g}
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </Seccion>
      )}

      {p.favoritos && (
        <Seccion titulo="Libros favoritos">
          {favoritos.length === 0 ? (
            <p className="text-tenue">Aún no tiene favoritos.</p>
          ) : (
            <RejillaLibros libros={favoritos} favoritos={misFavoritos} />
          )}
        </Seccion>
      )}

      {p.resenas && (
        <Seccion titulo="Reseñas">
          {p.resenas.length === 0 ? (
            <p className="text-tenue">Aún no ha escrito reseñas.</p>
          ) : (
            <ul className="flex flex-col gap-4">
              {p.resenas.map((r) => (
                <li key={`${r.fuente}:${r.id}`} className="rounded-2xl border border-borde bg-superficie p-5">
                  <div className="flex flex-wrap items-start justify-between gap-x-4 gap-y-2">
                    <div className="min-w-0">
                      <Link href={rutaLibro(r)} className="font-serif text-lg font-semibold hover:text-acento hover:underline">
                        {r.titulo}
                      </Link>
                      {r.autor && <p className="text-sm text-tenue">{r.autor}</p>}
                    </div>
                    <Estrellas valor={r.calificacion} className="size-5" />
                  </div>
                  {r.texto && <p className="mt-3 whitespace-pre-line break-words">{r.texto}</p>}
                  <p className="mt-3 text-sm text-tenue">
                    {new Date(r.fecha).toLocaleDateString("es-MX", { dateStyle: "long" })}
                  </p>
                </li>
              ))}
            </ul>
          )}
        </Seccion>
      )}
    </div>
  );
}

export default function PaginaLector(props: PageProps<"/lectores/[apodo]">) {
  return (
    <Suspense fallback={<p className="text-tenue">Cargando perfil…</p>}>
      <Contenido params={props.params} />
    </Suspense>
  );
}
