-- TIEMPO DE LECTURA
-- Segundos que cada persona pasa leyendo cada libro, por día. Solo cuenta
-- el tiempo con un libro abierto, la pantalla a la vista y alguien leyendo
-- de verdad (moviendo la página o escuchando la voz); eso lo mide el lector.
-- "dia" es la fecha local de quien lee (la manda su navegador).

create table public.tiempo_lectura (
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  dia date not null,
  fuente text not null check (char_length(fuente) <= 30),
  book_id text not null check (char_length(book_id) <= 200),
  segundos integer not null default 0 check (segundos between 0 and 86400),
  primary key (user_id, dia, fuente, book_id)
);

alter table public.tiempo_lectura enable row level security;

create policy "Ver mi tiempo" on public.tiempo_lectura
  for select to authenticated
  using ((select auth.uid()) = user_id);

create policy "Crear mi tiempo" on public.tiempo_lectura
  for insert to authenticated
  with check ((select auth.uid()) = user_id);

create policy "Sumar a mi tiempo" on public.tiempo_lectura
  for update to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

create policy "Borrar mi tiempo" on public.tiempo_lectura
  for delete to authenticated
  using ((select auth.uid()) = user_id);

-- Suma segundos al día y libro (crea el renglón si no existe). Corre con
-- los permisos de quien llama, así que las reglas de arriba siguen aplicando.
create function public.sumar_tiempo_lectura(
  p_dia date,
  p_fuente text,
  p_book_id text,
  p_segundos integer
) returns void
language sql
security invoker
set search_path = ''
as $$
  insert into public.tiempo_lectura (user_id, dia, fuente, book_id, segundos)
  values (auth.uid(), p_dia, p_fuente, p_book_id, least(greatest(p_segundos, 0), 86400))
  on conflict (user_id, dia, fuente, book_id) do update
    set segundos = least(public.tiempo_lectura.segundos + excluded.segundos, 86400);
$$;

revoke execute on function public.sumar_tiempo_lectura(date, text, text, integer) from public, anon;
grant execute on function public.sumar_tiempo_lectura(date, text, text, integer) to authenticated;
