-- FOTO DE PERFIL
-- Cada usuario puede tener una foto (ya recortada en su navegador a
-- 512 × 512). Se guarda en un bucket PRIVADO, en un archivo con el id del
-- usuario como nombre. La página la sirve con /api/foto, que pide sesión.

-- Cuándo se subió la foto (milisegundos). Vacío = sin foto. Sirve también
-- para que el navegador no muestre una foto vieja guardada en caché.
alter table public.profiles
  add column foto_version bigint;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'fotos',
  'fotos',
  false,
  524288, -- 512 KB
  array['image/jpeg', 'image/webp']
);

-- Cada quien solo ve, sube, reemplaza y borra su propia foto.
create policy "Ver mi foto" on storage.objects
  for select to authenticated
  using (bucket_id = 'fotos' and name = (select auth.uid())::text);

create policy "Subir mi foto" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'fotos' and name = (select auth.uid())::text);

create policy "Reemplazar mi foto" on storage.objects
  for update to authenticated
  using (bucket_id = 'fotos' and name = (select auth.uid())::text)
  with check (bucket_id = 'fotos' and name = (select auth.uid())::text);

create policy "Borrar mi foto" on storage.objects
  for delete to authenticated
  using (bucket_id = 'fotos' and name = (select auth.uid())::text);
