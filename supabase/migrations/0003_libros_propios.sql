-- LIBROS PROPIOS: los que cada usuario agrega por su cuenta, ya sea pegando
-- un enlace o subiendo un archivo (PDF o ePub).

create table public.libros_propios (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  titulo text not null,
  autor text,
  -- 'enlace': solo se guarda la dirección. 'archivo': se guarda en Storage.
  tipo text not null check (tipo in ('enlace', 'archivo')),
  url text,
  ruta_archivo text,
  creado_en timestamptz not null default now(),
  check (
    (tipo = 'enlace' and url is not null)
    or (tipo = 'archivo' and ruta_archivo is not null)
  )
);

alter table public.libros_propios enable row level security;

create policy "Ver mis libros propios" on public.libros_propios
  for select to authenticated
  using ((select auth.uid()) = user_id);

create policy "Agregar mis libros propios" on public.libros_propios
  for insert to authenticated
  with check ((select auth.uid()) = user_id);

create policy "Quitar mis libros propios" on public.libros_propios
  for delete to authenticated
  using ((select auth.uid()) = user_id);

create index libros_propios_por_usuario
  on public.libros_propios (user_id, creado_en desc);

-- ALMACÉN DE ARCHIVOS (Supabase Storage)
-- Un "bucket" privado llamado 'libros'. Cada usuario guarda sus archivos en
-- una carpeta con su propio id: <id-del-usuario>/<archivo>.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'libros',
  'libros',
  false,
  52428800, -- 50 MB por archivo
  array['application/pdf', 'application/epub+zip']
);

-- Cada quien solo puede ver, subir y borrar dentro de su propia carpeta.
create policy "Ver mis archivos de libros" on storage.objects
  for select to authenticated
  using (
    bucket_id = 'libros'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );

create policy "Subir mis archivos de libros" on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'libros'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );

create policy "Borrar mis archivos de libros" on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'libros'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );
