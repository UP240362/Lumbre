-- CALIFICACIONES Y RESEÑAS
-- Cada persona puede dejar una calificación (1 a 5 estrellas) y una reseña
-- breve por libro. Son públicas para todos los usuarios con sesión; cada
-- quien solo puede crear, cambiar o borrar la suya.
-- Los libros propios ("Mis libros") no se reseñan: son privados.

create table public.resenas (
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  fuente text not null check (fuente <> 'propio'),
  book_id text not null,
  titulo text not null check (char_length(titulo) <= 300),
  autor text check (char_length(autor) <= 300),
  -- Nombre que se muestra junto a la reseña (el del perfil al escribirla).
  nombre text check (char_length(nombre) <= 80),
  calificacion smallint not null check (calificacion between 1 and 5),
  texto text check (char_length(texto) <= 1000),
  creado_en timestamptz not null default now(),
  actualizado_en timestamptz not null default now(),
  primary key (user_id, fuente, book_id)
);

alter table public.resenas enable row level security;

create policy "Ver reseñas" on public.resenas
  for select to authenticated
  using (true);

create policy "Crear mi reseña" on public.resenas
  for insert to authenticated
  with check ((select auth.uid()) = user_id);

create policy "Editar mi reseña" on public.resenas
  for update to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

create policy "Borrar mi reseña" on public.resenas
  for delete to authenticated
  using ((select auth.uid()) = user_id);

-- Para traer rápido las reseñas de un libro, las más nuevas primero.
create index resenas_por_libro
  on public.resenas (fuente, book_id, actualizado_en desc);

-- Promedio y número de reseñas de cada libro (para las tarjetas).
-- security_invoker: respeta los permisos de quien consulta.
create view public.resenas_resumen
  with (security_invoker = true) as
  select
    fuente,
    book_id,
    round(avg(calificacion), 1)::float8 as promedio,
    count(*)::int as cantidad
  from public.resenas
  group by fuente, book_id;

revoke all on public.resenas_resumen from anon;
grant select on public.resenas_resumen to authenticated;
