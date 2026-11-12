-- AYUDANTES FUERA DE LA API
-- El revisor de seguridad de Supabase avisó que son_amigos, puede_ver,
-- relacion_con y puede_ver_foto se podían llamar desde la API. Son solo
-- ayudantes internos: se mueven al esquema "interno", que la API no
-- expone. Como nada los usaba todavía, se borran y se vuelven a crear.

drop policy "Ver fotos de lectores visibles" on storage.objects;
drop function public.buscar_lectores(text);
drop function public.mis_amistades();
drop function public.perfil_lector(text);
drop function public.foto_de_lector(text);
drop function public.enviar_solicitud(text);
drop function public.responder_solicitud(text, boolean);
drop function public.quitar_amistad(text);
drop function public.son_amigos(uuid, uuid);
drop function public.puede_ver(uuid);
drop function public.relacion_con(uuid);
drop function public.puede_ver_foto(text);

create schema interno;
-- Quien tiene sesión puede USAR los ayudantes (la regla del bucket de
-- fotos los llama), pero no aparecen en la API.
grant usage on schema interno to authenticated;

create function interno.son_amigos(a uuid, b uuid)
returns boolean
language sql stable security definer set search_path = ''
as $$
  select exists (
    select 1 from public.amistades
    where estado = 'aceptada'
      and ((solicitante = a and destinatario = b) or (solicitante = b and destinatario = a))
  );
$$;

-- ¿Quien consulta puede ver el perfil (y la foto) de "dueno"?
create function interno.puede_ver(dueno uuid)
returns boolean
language sql stable security definer set search_path = ''
as $$
  select case
    when auth.uid() is null then false
    when dueno = auth.uid() then true
    else coalesce((
      select case p.visibilidad
        when 'publico' then true
        when 'amigos' then interno.son_amigos(dueno, auth.uid())
        else false
      end
      from public.profiles p where p.id = dueno
    ), false)
  end;
$$;

-- 'yo', 'amigo', 'enviada' (yo la pedí), 'recibida' (me la pidieron) o null.
create function interno.relacion_con(otro uuid)
returns text
language sql stable security definer set search_path = ''
as $$
  select case
    when otro = auth.uid() then 'yo'
    else (
      select case
        when a.estado = 'aceptada' then 'amigo'
        when a.solicitante = auth.uid() then 'enviada'
        else 'recibida'
      end
      from public.amistades a
      where (a.solicitante = auth.uid() and a.destinatario = otro)
         or (a.solicitante = otro and a.destinatario = auth.uid())
    )
  end;
$$;

-- Para la regla del bucket de fotos: el nombre del archivo es el id.
create function interno.puede_ver_foto(nombre text)
returns boolean
language plpgsql stable security definer set search_path = ''
as $$
begin
  if nombre !~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' then
    return false;
  end if;
  return interno.puede_ver(nombre::uuid);
end;
$$;

create policy "Ver fotos de lectores visibles" on storage.objects
  for select to authenticated
  using (bucket_id = 'fotos' and interno.puede_ver_foto(name));

-- ──────────────────────── Para la página ────────────────────────

-- Buscar lectores por apodo (solo los que tienen apodo).
create function public.buscar_lectores(p_texto text)
returns table (apodo text, foto_version bigint, relacion text)
language plpgsql stable security definer set search_path = ''
as $$
declare
  limpio text := lower(regexp_replace(coalesce(p_texto, ''), '[^a-zA-Z0-9_.]', '', 'g'));
begin
  if auth.uid() is null or char_length(limpio) < 2 then
    return;
  end if;
  return query
    select p.apodo,
           case when interno.puede_ver(p.id) then p.foto_version end,
           interno.relacion_con(p.id)
    from public.profiles p
    where p.apodo is not null
      and p.id <> auth.uid()
      and p.apodo like '%' || replace(limpio, '_', '\_') || '%'  -- "_" es comodín en LIKE
    order by (p.apodo like limpio || '%') desc, p.apodo
    limit 20;
end;
$$;

-- Solicitudes y amigos de quien consulta.
create function public.mis_amistades()
returns table (apodo text, foto_version bigint, relacion text, desde timestamptz)
language sql stable security definer set search_path = ''
as $$
  select p.apodo,
         case when interno.puede_ver(p.id) then p.foto_version end,
         interno.relacion_con(p.id),
         a.creado_en
  from public.amistades a
  join public.profiles p
    on p.id = case when a.solicitante = auth.uid() then a.destinatario else a.solicitante end
  where auth.uid() in (a.solicitante, a.destinatario)
    and p.apodo is not null
  order by a.creado_en desc;
$$;

-- El perfil de un lector, con solo lo que su privacidad permite.
create function public.perfil_lector(p_apodo text)
returns jsonb
language plpgsql stable security definer set search_path = ''
as $$
declare
  p public.profiles%rowtype;
  visible boolean;
  lunes date := date_trunc('week', now() at time zone 'America/Mexico_City')::date;
  r jsonb;
begin
  if auth.uid() is null then
    return null;
  end if;
  select * into p from public.profiles where apodo = lower(p_apodo);
  if not found then
    return null;
  end if;

  visible := interno.puede_ver(p.id);
  r := jsonb_build_object(
    'apodo', p.apodo,
    'relacion', interno.relacion_con(p.id),
    'visible', visible,
    'visibilidad', p.visibilidad,
    'foto_version', case when visible then p.foto_version end,
    'amigos', (select count(*) from public.amistades a
               where a.estado = 'aceptada' and p.id in (a.solicitante, a.destinatario))
  );
  if not visible then
    return r;
  end if;

  if p.mostrar_tiempo then
    r := r || jsonb_build_object('tiempo_semana', coalesce((
      select sum(t.segundos) from public.tiempo_lectura t
      where t.user_id = p.id and t.dia >= lunes), 0));
  end if;

  if p.mostrar_favoritos then
    r := r || jsonb_build_object('favoritos', coalesce((
      select jsonb_agg(jsonb_build_object('fuente', f.fuente, 'id', f.book_id,
                                          'titulo', f.titulo, 'autor', f.autor)
                       order by f.creado_en desc)
      from (select * from public.libros_favoritos
            where user_id = p.id and fuente <> 'propio'   -- los libros propios son privados
            order by creado_en desc limit 24) f), '[]'::jsonb));
  end if;

  if p.mostrar_resenas then
    r := r || jsonb_build_object('resenas', coalesce((
      select jsonb_agg(jsonb_build_object('fuente', x.fuente, 'id', x.book_id,
                                          'titulo', x.titulo, 'autor', x.autor,
                                          'calificacion', x.calificacion, 'texto', x.texto,
                                          'fecha', x.actualizado_en)
                       order by x.actualizado_en desc)
      from (select * from public.resenas where user_id = p.id
            order by actualizado_en desc limit 20) x), '[]'::jsonb));
  end if;

  if p.mostrar_gustos then
    r := r || jsonb_build_object('gustos', coalesce((
      select jsonb_agg(g.nombre_autor order by g.nombre_autor)
      from public.autores_preferidos g where g.user_id = p.id), '[]'::jsonb));
  end if;

  return r;
end;
$$;

-- Id del archivo de foto de un lector, solo si quien consulta la puede ver.
create function public.foto_de_lector(p_apodo text)
returns text
language sql stable security definer set search_path = ''
as $$
  select p.id::text from public.profiles p
  where p.apodo = lower(p_apodo) and p.foto_version is not null and interno.puede_ver(p.id);
$$;

-- ──────────────────────── Acciones ────────────────────────

-- Mandar solicitud. Si la otra persona ya me había mandado una, se aceptan
-- las dos de una vez. Devuelve la relación resultante.
create function public.enviar_solicitud(p_apodo text)
returns text
language plpgsql volatile security definer set search_path = ''
as $$
declare
  yo uuid := auth.uid();
  otro uuid;
  existente public.amistades%rowtype;
begin
  if yo is null then raise exception 'sin sesión'; end if;
  if (select apodo from public.profiles where id = yo) is null then
    raise exception 'Primero elige tu apodo';
  end if;
  select id into otro from public.profiles where apodo = lower(p_apodo);
  if otro is null or otro = yo then raise exception 'Lector no encontrado'; end if;

  select * into existente from public.amistades
  where (solicitante = yo and destinatario = otro) or (solicitante = otro and destinatario = yo);
  if found then
    if existente.estado = 'pendiente' and existente.solicitante = otro then
      update public.amistades set estado = 'aceptada'
      where solicitante = otro and destinatario = yo;
    end if;
    return interno.relacion_con(otro);
  end if;

  -- Freno contra el abuso: hasta 30 solicitudes pendientes enviadas.
  if (select count(*) from public.amistades where solicitante = yo and estado = 'pendiente') >= 30 then
    raise exception 'Demasiadas solicitudes pendientes';
  end if;

  insert into public.amistades (solicitante, destinatario) values (yo, otro);
  return 'enviada';
end;
$$;

-- Aceptar o rechazar una solicitud recibida.
create function public.responder_solicitud(p_apodo text, p_aceptar boolean)
returns text
language plpgsql volatile security definer set search_path = ''
as $$
declare
  yo uuid := auth.uid();
  otro uuid;
begin
  if yo is null then raise exception 'sin sesión'; end if;
  select id into otro from public.profiles where apodo = lower(p_apodo);
  if otro is null then raise exception 'Lector no encontrado'; end if;
  if p_aceptar then
    update public.amistades set estado = 'aceptada'
    where solicitante = otro and destinatario = yo and estado = 'pendiente';
  else
    delete from public.amistades
    where solicitante = otro and destinatario = yo and estado = 'pendiente';
  end if;
  return interno.relacion_con(otro);
end;
$$;

-- Cancelar una solicitud enviada o dejar de ser amigos.
create function public.quitar_amistad(p_apodo text)
returns void
language plpgsql volatile security definer set search_path = ''
as $$
declare
  yo uuid := auth.uid();
  otro uuid;
begin
  if yo is null then raise exception 'sin sesión'; end if;
  select id into otro from public.profiles where apodo = lower(p_apodo);
  delete from public.amistades
  where (solicitante = yo and destinatario = otro) or (solicitante = otro and destinatario = yo);
end;
$$;

-- Nadie sin sesión puede usar estas funciones.
revoke execute on function public.buscar_lectores(text) from public, anon;
revoke execute on function public.mis_amistades() from public, anon;
revoke execute on function public.perfil_lector(text) from public, anon;
revoke execute on function public.foto_de_lector(text) from public, anon;
revoke execute on function public.enviar_solicitud(text) from public, anon;
revoke execute on function public.responder_solicitud(text, boolean) from public, anon;
revoke execute on function public.quitar_amistad(text) from public, anon;
grant execute on function public.buscar_lectores(text) to authenticated;
grant execute on function public.mis_amistades() to authenticated;
grant execute on function public.perfil_lector(text) to authenticated;
grant execute on function public.foto_de_lector(text) to authenticated;
grant execute on function public.enviar_solicitud(text) to authenticated;
grant execute on function public.responder_solicitud(text, boolean) to authenticated;
grant execute on function public.quitar_amistad(text) to authenticated;

revoke execute on all functions in schema interno from public, anon;
grant execute on all functions in schema interno to authenticated;
