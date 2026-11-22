-- Operaciones de flujo: cada una es una transacción que valida permiso y
-- estatus, aplica el cambio y escribe la bitácora. Errores de regla de
-- negocio salen con SQLSTATE P0001 y su mensaje llega tal cual al toast.

create function app.exigir(p_accion text) returns public.usuarios
language plpgsql stable security definer set search_path = '' as $$
declare
  u public.usuarios;
begin
  select * into u from public.usuarios where id = (select auth.uid()) and activo;
  if u.id is null then
    raise exception 'Sesión expirada' using errcode = '28000';
  end if;
  if not app.puede(p_accion) then
    raise exception 'No tienes permiso para esta acción' using errcode = '42501';
  end if;
  return u;
end $$;

create function app.bloquear_inspeccion(p_id uuid, p_tenant uuid) returns public.inspecciones
language plpgsql security definer set search_path = '' as $$
declare
  x public.inspecciones;
begin
  select * into x from public.inspecciones where id = p_id and tenant_id = p_tenant for update;
  if x.id is null then
    raise exception 'La inspección no existe';
  end if;
  return x;
end $$;

/* ---------- Agenda ---------- */

create function public.reprogramar_inspeccion(p_id uuid, p_fecha timestamptz) returns void
language plpgsql security definer set search_path = '' as $$
declare
  u public.usuarios := app.exigir('agenda.editar');
  x public.inspecciones := app.bloquear_inspeccion(p_id, u.tenant_id);
  v_tz text;
begin
  if x.estatus <> 'programada' then
    raise exception 'Solo se reprograman citas programadas';
  end if;
  select zona_horaria into v_tz from public.tenants where id = u.tenant_id;
  update public.inspecciones set fecha = p_fecha where id = p_id;
  perform app.registrar(u.tenant_id, 'inspeccion', p_id, 'actualizar',
    'Reprogramada a ' || to_char(p_fecha at time zone v_tz, 'DD/MM/YYYY HH24:MI'));
end $$;

create function public.cancelar_inspeccion(p_id uuid) returns void
language plpgsql security definer set search_path = '' as $$
declare
  u public.usuarios := app.exigir('agenda.editar');
  x public.inspecciones := app.bloquear_inspeccion(p_id, u.tenant_id);
begin
  if x.estatus = 'dictaminada' then
    raise exception 'Una inspección dictaminada no se cancela';
  end if;
  if x.estatus = 'cancelada' then
    raise exception 'La cita ya estaba cancelada';
  end if;
  update public.inspecciones set estatus = 'cancelada' where id = p_id;
  perform app.registrar(u.tenant_id, 'inspeccion', p_id, 'cambiar_estatus', 'Cancelada');
end $$;

/* ---------- Campo ---------- */

-- p_captura: { respuestas, observaciones, evidencias: [{ tipo, nombre, ruta, lat, lng, tomadaEn, hash }],
--              firmaCliente, firmaInspector, nombreFirmaCliente, finalizar }
-- Las evidencias ya deben estar en Storage (bucket evidencias, {tenant}/{inspeccion}/…).
create function public.sincronizar_captura(p_id uuid, p_captura jsonb) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  u public.usuarios := app.exigir('campo.capturar');
  x public.inspecciones := app.bloquear_inspeccion(p_id, u.tenant_id);
  v_finalizar boolean := coalesce((p_captura ->> 'finalizar')::boolean, false);
  v_prefijo text := u.tenant_id::text || '/' || p_id::text || '/';
  v_ev jsonb;
  v_n int;
  v_nuevas int := 0;
  v_estatus public.estatus_inspeccion;
begin
  if u.rol = 'inspector' and x.inspector_id <> u.id then
    raise exception 'La inspección está asignada a otro inspector';
  end if;
  if x.estatus not in ('programada', 'en_curso') then
    raise exception 'La inspección ya no admite captura de campo';
  end if;
  if jsonb_typeof(p_captura -> 'respuestas') is distinct from 'array' then
    raise exception 'Respuestas inválidas';
  end if;

  for v_ev in select * from jsonb_array_elements(coalesce(p_captura -> 'evidencias', '[]'::jsonb)) loop
    if left(coalesce(v_ev ->> 'ruta', ''), length(v_prefijo)) <> v_prefijo
      or not exists (select 1 from storage.objects o where o.bucket_id = 'evidencias' and o.name = v_ev ->> 'ruta') then
      raise exception 'La evidencia «%» no se ha subido', coalesce(v_ev ->> 'nombre', 'sin nombre');
    end if;
    insert into public.evidencias (tenant_id, inspeccion_id, tipo, nombre, ruta, lat, lng, tomada_en, hash)
    values (
      u.tenant_id, p_id,
      coalesce(v_ev ->> 'tipo', 'foto')::public.tipo_evidencia,
      v_ev ->> 'nombre', v_ev ->> 'ruta',
      (v_ev ->> 'lat')::double precision, (v_ev ->> 'lng')::double precision,
      (v_ev ->> 'tomadaEn')::timestamptz, v_ev ->> 'hash'
    )
    on conflict (ruta) do nothing;
    get diagnostics v_n = row_count;
    v_nuevas := v_nuevas + v_n;
  end loop;

  v_estatus := case when v_finalizar then 'en_revision' else 'en_curso' end;
  update public.inspecciones set
    respuestas = p_captura -> 'respuestas',
    observaciones = coalesce(p_captura ->> 'observaciones', ''),
    iniciada_en = coalesce(iniciada_en, now()),
    sincronizada_en = now(),
    version = version + 1,
    estatus = v_estatus,
    enviada_revision_en = case when v_finalizar then now() else enviada_revision_en end
  where id = p_id;

  if coalesce(p_captura ->> 'firmaCliente', p_captura ->> 'firmaInspector') is not null then
    insert into public.actas (tenant_id, inspeccion_id, version, firma_cliente, firma_inspector, nombre_firma_cliente, generada_en)
    values (u.tenant_id, p_id, 1, p_captura ->> 'firmaCliente', p_captura ->> 'firmaInspector',
            nullif(p_captura ->> 'nombreFirmaCliente', ''), now())
    on conflict (inspeccion_id) do update set
      version = public.actas.version + 1,
      firma_cliente = excluded.firma_cliente,
      firma_inspector = excluded.firma_inspector,
      nombre_firma_cliente = excluded.nombre_firma_cliente,
      generada_en = excluded.generada_en;
  end if;

  perform app.registrar(u.tenant_id, 'inspeccion', p_id, 'sincronizar', format(
    'Sincronizado desde campo (%s respuestas, %s evidencias nuevas)%s',
    jsonb_array_length(p_captura -> 'respuestas'), v_nuevas,
    case when v_finalizar then ' y enviado a revisión' else '' end));

  return jsonb_build_object('estatus', v_estatus, 'evidenciasNuevas', v_nuevas);
end $$;

/* ---------- Revisión y dictamen ---------- */

create function public.devolver_a_campo(p_id uuid, p_motivo text) returns void
language plpgsql security definer set search_path = '' as $$
declare
  u public.usuarios := app.exigir('inspecciones.revisar');
  x public.inspecciones := app.bloquear_inspeccion(p_id, u.tenant_id);
begin
  if length(trim(coalesce(p_motivo, ''))) < 5 then
    raise exception 'Indica el motivo';
  end if;
  if x.estatus <> 'en_revision' then
    raise exception 'Solo se devuelven inspecciones en revisión';
  end if;
  update public.inspecciones set estatus = 'en_curso' where id = p_id;
  perform app.registrar(u.tenant_id, 'inspeccion', p_id, 'cambiar_estatus', 'Devuelta a campo: ' || trim(p_motivo));
end $$;

-- Folio consecutivo sin huecos: la fila (tenant, año) de folios se bloquea con
-- FOR UPDATE, así que dos aprobaciones simultáneas se serializan; si algo falla
-- la transacción completa se revierte y el consecutivo no se consume.
create function public.aprobar_y_emitir(p_id uuid) returns public.dictamenes
language plpgsql security definer set search_path = '' as $$
declare
  u public.usuarios := app.exigir('dictamen.aprobar');
  x public.inspecciones := app.bloquear_inspeccion(p_id, u.tenant_id);
  t public.tenants;
  d public.dictamenes;
  v_ahora timestamptz := now();
  v_anio int;
  v_consecutivo int;
  v_resultado public.resultado_dictamen;
begin
  if x.estatus <> 'en_revision' then
    raise exception 'Solo se aprueban inspecciones en revisión';
  end if;
  if exists (select 1 from public.dictamenes where inspeccion_id = p_id) then
    raise exception 'Ya tiene dictamen';
  end if;

  select * into t from public.tenants where id = u.tenant_id;
  v_anio := extract(year from v_ahora at time zone t.zona_horaria)::int;

  insert into public.folios (tenant_id, anio) values (t.id, v_anio) on conflict do nothing;
  update public.folios set ultimo = ultimo + 1
  where tenant_id = t.id and anio = v_anio
  returning ultimo into v_consecutivo;

  v_resultado := case
    when exists (select 1 from jsonb_array_elements(x.respuestas) r where r ->> 'valor' = 'no_cumple') then 'no_cumple'
    else 'cumple'
  end;

  insert into public.dictamenes (tenant_id, inspeccion_id, folio, resultado, token_qr, aprobado_por, emitido_en, vigente_hasta)
  values (
    t.id, p_id,
    t.serie_folio || '-' || v_anio || '-' || lpad(v_consecutivo::text, 4, '0'),
    v_resultado,
    replace(gen_random_uuid()::text, '-', ''),
    u.id, v_ahora,
    case when v_resultado = 'cumple' then v_ahora + make_interval(months => t.vigencia_dictamen_meses) end
  )
  returning * into d;

  update public.inspecciones set estatus = 'dictaminada' where id = p_id;
  if d.vigente_hasta is not null then
    update public.instalaciones set vencimiento = d.vigente_hasta where id = x.instalacion_id;
  end if;

  perform app.registrar(t.id, 'inspeccion', p_id, 'aprobar', 'Aprobada por el responsable técnico');
  perform app.registrar(t.id, 'inspeccion', p_id, 'emitir_dictamen', 'Dictamen ' || d.folio || ' emitido');
  return d;
end $$;

/* ---------- Lecturas públicas (sin sesión) ---------- */

-- Verificación por QR: expone solo lo mínimo.
create function public.verificar_dictamen(p_token text) returns jsonb
language sql stable security definer set search_path = '' as $$
  select jsonb_build_object(
    'folio', d.folio,
    'resultado', d.resultado,
    'emitidoEn', d.emitido_en,
    'vigenteHasta', d.vigente_hasta,
    'cliente', c.razon_social,
    'instalacion', i.nombre || ' · ' || i.municipio,
    'norma', n.clave,
    'unidad', t.razon_social,
    'acreditacion', t.acreditacion_ema
  )
  from public.dictamenes d
  join public.inspecciones x on x.id = d.inspeccion_id
  join public.instalaciones i on i.id = x.instalacion_id
  join public.clientes c on c.id = i.cliente_id
  join public.normas n on n.id = x.norma_id
  join public.tenants t on t.id = d.tenant_id
  where d.token_qr = p_token and length(p_token) <= 64
$$;

-- Branding del tenant para la pantalla de login.
create function public.tenant_publico(p_slug text) returns jsonb
language sql stable security definer set search_path = '' as $$
  select to_jsonb(t) from public.tenants t where t.slug = p_slug
$$;

/* ---------- Dashboard (SECURITY INVOKER: respeta RLS) ---------- */

create function public.dashboard(p_desde timestamptz, p_hoy_inicio timestamptz, p_hoy_fin timestamptz, p_limite_vencimiento timestamptz)
returns jsonb
language sql stable security invoker set search_path = '' as $$
  with tz as (select zona_horaria from public.tenants where id = (select app.tenant_id()))
  select jsonb_build_object(
    'porEstatus', (
      select coalesce(jsonb_object_agg(estatus, total), '{}'::jsonb)
      from (select estatus, count(*) as total from public.inspecciones group by estatus) s
    ),
    'meses', (
      select coalesce(jsonb_agg(jsonb_build_object('mes', mes, 'cumple', cumple, 'noCumple', no_cumple)), '[]'::jsonb)
      from (
        select to_char(d.emitido_en at time zone (select zona_horaria from tz), 'YYYY-MM') as mes,
               count(*) filter (where d.resultado = 'cumple') as cumple,
               count(*) filter (where d.resultado = 'no_cumple') as no_cumple
        from public.dictamenes d
        where d.emitido_en >= p_desde
        group by 1
      ) m
    ),
    'productividad', (
      select coalesce(jsonb_agg(jsonb_build_object(
        'inspector', u.nombre,
        'dictaminadas', (select count(*) from public.inspecciones x where x.inspector_id = u.id and x.estatus = 'dictaminada'),
        'pendientes', (select count(*) from public.inspecciones x where x.inspector_id = u.id and x.estatus in ('programada', 'en_curso', 'en_revision'))
      ) order by u.nombre), '[]'::jsonb)
      from public.usuarios u
      where u.rol = 'inspector' and u.activo
    ),
    'promedioHoras', (
      select coalesce(avg(h), 0)
      from (
        select extract(epoch from d.emitido_en - x.fecha) / 3600 as h
        from public.dictamenes d join public.inspecciones x on x.id = d.inspeccion_id
      ) t
      where h > 0
    ),
    'ncFrecuentes', (
      select coalesce(jsonb_agg(jsonb_build_object('reactivoId', rid, 'total', total) order by total desc, rid), '[]'::jsonb)
      from (
        select r ->> 'reactivoId' as rid, count(*) as total
        from public.inspecciones x, jsonb_array_elements(x.respuestas) r
        where r ->> 'valor' = 'no_cumple'
        group by 1
        order by 2 desc, 1
        limit 5
      ) n
    ),
    'vencimientos', (
      select coalesce(jsonb_agg(to_jsonb(v) order by v.vencimiento), '[]'::jsonb)
      from (
        select i.*, c.razon_social as cliente
        from public.instalaciones i join public.clientes c on c.id = i.cliente_id
        where i.vencimiento is not null and i.vencimiento <= p_limite_vencimiento
        order by i.vencimiento
        limit 8
      ) v
    ),
    'citasHoy', (
      select count(*) from public.inspecciones
      where fecha >= p_hoy_inicio and fecha < p_hoy_fin and estatus <> 'cancelada'
    ),
    'totalClientes', (select count(*) from public.clientes)
  )
$$;

/* ---------- Mantenimiento (solo service_role) ---------- */

-- Borra los datos operativos de un tenant (reinicio de la demo / pnpm seed).
-- Conserva el tenant y sus usuarios.
create function public.purgar_datos_tenant(p_tenant uuid) returns void
language plpgsql security definer set search_path = '' as $$
begin
  perform set_config('app.purga', 'on', true);
  delete from public.bitacora where tenant_id = p_tenant;
  delete from public.dictamenes where tenant_id = p_tenant;
  delete from public.evidencias where tenant_id = p_tenant;
  delete from public.actas where tenant_id = p_tenant;
  delete from public.inspecciones where tenant_id = p_tenant;
  delete from public.instalaciones where tenant_id = p_tenant;
  delete from public.clientes where tenant_id = p_tenant;
  delete from public.plantillas where tenant_id = p_tenant;
  delete from public.checklists where tenant_id = p_tenant;
  delete from public.normas where tenant_id = p_tenant;
  delete from public.folios where tenant_id = p_tenant;
  perform set_config('app.purga', 'off', true);
end $$;

/* ---------- Privilegios de funciones ---------- */

revoke all on all functions in schema public from public, anon, authenticated;
revoke all on all functions in schema app from public, anon, authenticated;

grant execute on function app.tenant_id(), app.rol(), app.puede(text) to authenticated;

grant execute on function
  public.reprogramar_inspeccion(uuid, timestamptz),
  public.cancelar_inspeccion(uuid),
  public.sincronizar_captura(uuid, jsonb),
  public.devolver_a_campo(uuid, text),
  public.aprobar_y_emitir(uuid),
  public.dashboard(timestamptz, timestamptz, timestamptz, timestamptz)
to authenticated;

grant execute on function public.verificar_dictamen(text), public.tenant_publico(text) to anon, authenticated;

revoke all on function public.purgar_datos_tenant(uuid) from service_role;
grant execute on function public.purgar_datos_tenant(uuid) to service_role;
