// Aviso sencillo para las páginas que se construyen en una etapa posterior.

export function PaginaPendiente({
  titulo,
  mensaje,
}: {
  titulo: string;
  mensaje: string;
}) {
  return (
    <div className="flex flex-col gap-4">
      <h1 className="font-serif text-4xl font-semibold md:text-5xl">
        {titulo}
      </h1>
      <p className="max-w-prose text-tenue">{mensaje}</p>
    </div>
  );
}
