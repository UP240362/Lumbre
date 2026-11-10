-- LUMBRE · Esquema inicial
-- Copia de lo que se aplicó en Supabase, para tenerlo documentado en el proyecto.
-- Cada tabla tiene Row Level Security (RLS): cada usuario solo ve y cambia lo suyo.

-- ───────────────────────── profiles ─────────────────────────
-- Un renglón por usuario. El id es el mismo que en auth.users.
create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  nombre text,
  luz_preferida text not null default 'amarilla'
    check (luz_preferida in ('amarilla', 'blanca', 'negra')),
  tamano_letra integer not null default 19
    check (tamano_letra between 15 and 27),
  -- Para saber si ya pasó (u omitió) la pantalla "Tus gustos".
  gustos_completados boolean not null default false,
  creado_en timestamptz not null default now()
);

alter table public.profiles enable row level security;

create policy "Ver mi perfil" on public.profiles
  for select to authenticated
  using ((select auth.uid()) = id);

create policy "Crear mi perfil" on public.profiles
  for insert to authenticated
  with check ((select auth.uid()) = id);

create policy "Editar mi perfil" on public.profiles
  for update to authenticated
  using ((select auth.uid()) = id)
  with check ((select auth.uid()) = id);

-- Cuando alguien crea su cuenta, se le crea su perfil automáticamente.
create function public.crear_perfil_de_usuario()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, nombre)
  values (
    new.id,
    coalesce(
      new.raw_user_meta_data ->> 'nombre',
      new.raw_user_meta_data ->> 'full_name',
      new.raw_user_meta_data ->> 'name'
    )
  );
  return new;
end;
$$;

-- Nadie puede llamar esta función desde la API; solo la usa el trigger.
revoke execute on function public.crear_perfil_de_usuario() from public, anon, authenticated;

create trigger al_crear_usuario
  after insert on auth.users
  for each row execute function public.crear_perfil_de_usuario();

-- ──────────────────── autores_preferidos ────────────────────
create table public.autores_preferidos (
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  nombre_autor text not null,
  creado_en timestamptz not null default now(),
  primary key (user_id, nombre_autor)
);

alter table public.autores_preferidos enable row level security;

create policy "Ver mis autores" on public.autores_preferidos
  for select to authenticated
  using ((select auth.uid()) = user_id);

create policy "Agregar mis autores" on public.autores_preferidos
  for insert to authenticated
  with check ((select auth.uid()) = user_id);

create policy "Quitar mis autores" on public.autores_preferidos
  for delete to authenticated
  using ((select auth.uid()) = user_id);

-- ───────────────────── libros_favoritos ─────────────────────
create table public.libros_favoritos (
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  book_id text not null,
  fuente text not null default 'gutendex',
  titulo text not null,
  autor text,
  creado_en timestamptz not null default now(),
  primary key (user_id, fuente, book_id)
);

alter table public.libros_favoritos enable row level security;

create policy "Ver mis favoritos" on public.libros_favoritos
  for select to authenticated
  using ((select auth.uid()) = user_id);

create policy "Agregar mis favoritos" on public.libros_favoritos
  for insert to authenticated
  with check ((select auth.uid()) = user_id);

create policy "Quitar mis favoritos" on public.libros_favoritos
  for delete to authenticated
  using ((select auth.uid()) = user_id);

-- ───────────────────── progreso_lectura ─────────────────────
create table public.progreso_lectura (
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  book_id text not null,
  fuente text not null default 'gutendex',
  -- Título y autor se guardan aquí para pintar "Seguir leyendo"
  -- sin tener que volver a pedir el libro a la API.
  titulo text not null,
  autor text,
  capitulo integer not null default 0 check (capitulo >= 0),
  porcentaje numeric(5, 2) not null default 0
    check (porcentaje between 0 and 100),
  actualizado_en timestamptz not null default now(),
  primary key (user_id, fuente, book_id)
);

alter table public.progreso_lectura enable row level security;

create policy "Ver mi progreso" on public.progreso_lectura
  for select to authenticated
  using ((select auth.uid()) = user_id);

create policy "Guardar mi progreso" on public.progreso_lectura
  for insert to authenticated
  with check ((select auth.uid()) = user_id);

create policy "Actualizar mi progreso" on public.progreso_lectura
  for update to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

create policy "Borrar mi progreso" on public.progreso_lectura
  for delete to authenticated
  using ((select auth.uid()) = user_id);

-- Para listar "Seguir leyendo" del más reciente al más antiguo.
create index progreso_lectura_recientes
  on public.progreso_lectura (user_id, actualizado_en desc);
