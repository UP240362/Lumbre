-- META DE LECTURA SEMANAL
-- Minutos que la persona quiere leer cada semana (de lunes a domingo).
-- Vacío = sin meta. Se compara con la tabla tiempo_lectura.
-- Las reglas de "profiles" ya dejan que cada quien cambie solo su perfil.

alter table public.profiles
  add column meta_semanal_minutos integer
    check (meta_semanal_minutos between 10 and 10080);
