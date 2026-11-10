import { IconoLibro } from "@/components/Iconos";
import { SelectorLuz } from "@/components/SelectorLuz";

// Marco de las pantallas de acceso (login, crear cuenta, recuperar):
// todo negro con un marco naranja alrededor. A la izquierda va la
// presentación de Lumbre y a la derecha la tarjeta con el formulario.
export default function LayoutAcceso({ children }: LayoutProps<"/">) {
  return (
    <div className="flex min-h-dvh flex-col border-4 border-naranja bg-negro md:border-8">
      <div className="mx-auto flex w-full max-w-6xl flex-1 flex-col justify-center gap-10 px-5 py-10 lg:flex-row lg:items-center lg:gap-16 lg:px-12">
        <section className="flex-1">
          <p className="flex items-center gap-3 font-serif text-3xl font-bold text-naranja">
            <span className="flex size-11 items-center justify-center rounded-xl border-2 border-naranja">
              <IconoLibro className="size-6" />
            </span>
            Lumbre
          </p>
          <h1 className="mt-8 font-serif text-4xl font-semibold leading-tight text-orilla-texto sm:text-5xl lg:text-6xl">
            Lee libros libres, a tu luz.
          </h1>
          <p className="mt-6 max-w-md text-lg text-orilla-tenue">
            Miles de obras de dominio público, tus favoritos y tu avance
            guardado en cada libro.
          </p>
          <div className="mt-8">
            <p className="mb-3 text-xs font-semibold tracking-widest text-orilla-tenue">
              ELIGE TU LUZ DE LECTURA
            </p>
            <SelectorLuz />
          </div>
        </section>

        <section className="w-full rounded-3xl border border-t-4 border-orilla-borde border-t-naranja bg-orilla-superficie p-6 sm:p-10 lg:max-w-md">
          {children}
        </section>
      </div>
    </div>
  );
}
