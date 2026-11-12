-- CÓMICS EN "MIS LIBROS"
-- Un libro propio se lee de una de dos formas:
--   'texto': como siempre, en párrafos (con subrayados y voz).
--   'comic': página por página, como imágenes (cómics, manga, escaneos).
-- Se decide al subir el archivo (ver mis-libros/acciones.ts).

alter table public.libros_propios
  add column formato text not null default 'texto'
  check (formato in ('texto', 'comic'));

-- El almacén también acepta archivos CBZ (un ZIP con las páginas).
update storage.buckets
set allowed_mime_types = array[
  'application/pdf',
  'application/epub+zip',
  'application/vnd.comicbook+zip'
]
where id = 'libros';
