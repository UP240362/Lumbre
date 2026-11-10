-- La fuente inicial pasó de Gutendex al catálogo oficial de Project Gutenberg
-- (mismos libros y mismos números, pero responde mucho más rápido).
alter table public.libros_favoritos alter column fuente set default 'gutenberg';
alter table public.progreso_lectura alter column fuente set default 'gutenberg';
