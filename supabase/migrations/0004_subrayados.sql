-- SUBRAYADOS Y NOTAS
-- Cada renglón es un fragmento subrayado de un libro, con una nota opcional.
-- Para saber qué texto es, se guarda el capítulo y, dentro de él, en qué
-- párrafo y en qué letra empieza y termina. También se guarda el texto
-- mismo, para poder encontrarlo aunque el libro cambie un poco.

create table public.subrayados (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  fuente text not null,
  book_id text not null,
  capitulo integer not null check (capitulo >= 0),
  inicio_parrafo integer not null check (inicio_parrafo >= 0),
  inicio_offset integer not null check (inicio_offset >= 0),
  fin_parrafo integer not null,
  fin_offset integer not null,
  texto text not null check (char_length(texto) between 1 and 10000),
  color text not null default 'amarillo'
    check (color in ('amarillo', 'naranja', 'verde')),
  nota text check (char_length(nota) <= 5000),
  creado_en timestamptz not null default now(),
  actualizado_en timestamptz not null default now(),
  -- El final tiene que estar después del inicio.
  check ((fin_parrafo, fin_offset) > (inicio_parrafo, inicio_offset))
);

alter table public.subrayados enable row level security;

create policy "Ver mis subrayados" on public.subrayados
  for select to authenticated
  using ((select auth.uid()) = user_id);

create policy "Crear mis subrayados" on public.subrayados
  for insert to authenticated
  with check ((select auth.uid()) = user_id);

create policy "Editar mis subrayados" on public.subrayados
  for update to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

create policy "Borrar mis subrayados" on public.subrayados
  for delete to authenticated
  using ((select auth.uid()) = user_id);

-- Para traer rápido los subrayados de un libro.
create index subrayados_por_libro
  on public.subrayados (user_id, fuente, book_id);
