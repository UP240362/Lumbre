import { redirect } from "next/navigation";
import { Suspense } from "react";
import {
  BarraInferior,
  BarraLateral,
  BarraSuperiorMovil,
} from "@/components/Navegacion";
import { SincronizarPreferencias } from "@/components/SincronizarPreferencias";
import { obtenerPerfil } from "@/lib/sesion";

// Lee el perfil en el servidor y le pasa la luz y el tamaño de letra
// al componente que los aplica en el navegador.
async function PreferenciasDelPerfil() {
  const perfil = await obtenerPerfil();
  // Las cuentas nuevas pasan primero por la pantalla "Tus gustos".
  if (!perfil.gustos_completados) redirect("/gustos");
  return (
    <SincronizarPreferencias
      luz={perfil.luz_preferida}
      tamano={perfil.tamano_letra}
    />
  );
}

// Layout de las páginas "de adentro" (Inicio, Explorar, Favoritos, Perfil).
// La carpeta (app) lleva paréntesis: agrupa páginas para darles este marco,
// pero NO aparece en la dirección web.
export default function LayoutApp({ children }: LayoutProps<"/">) {
  return (
    <div className="flex min-h-dvh bg-orilla">
      {/* Suspense: todo lo que depende de quién inició sesión se carga
          aparte, para no detener el resto de la página. */}
      <Suspense>
        <PreferenciasDelPerfil />
      </Suspense>

      <BarraLateral />

      <div className="flex min-w-0 flex-1 flex-col">
        <BarraSuperiorMovil />
        {/* Área de contenido: aquí es donde se nota la luz elegida */}
        <main className="flex-1 bg-fondo pb-24 text-texto md:pb-0">
          <div className="mx-auto w-full max-w-6xl px-5 py-8 md:px-12 md:py-12">
            {children}
          </div>
        </main>
      </div>

      <BarraInferior />
    </div>
  );
}
