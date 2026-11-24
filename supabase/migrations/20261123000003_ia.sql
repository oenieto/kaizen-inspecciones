-- IA (Claude): límite de uso por tenant y trazabilidad de lo que sugiere.
--
-- Regla ISO/IEC 17020: la IA nunca decide. Sugiere; una persona confirma, y la
-- bitácora guarda qué sugirió, qué se guardó al final y quién lo confirmó.
--
-- Cada llamada al modelo es una fila de ia_solicitudes:
--   ia_reservar   → antes de llamar: valida el límite mensual del tenant y crea la fila (pendiente)
--   ia_completar  → después: modelo, tokens y la sugerencia (ok) o el error
--   ia_resolver   → cuando una persona acepta, edita o descarta la sugerencia
-- ia_reservar e ia_completar solo las llama el servidor (service_role) después
-- de validar sesión y permiso; ia_resolver la llama el usuario con su sesión.

alter type public.accion_bitacora add value if not exists 'sugerencia_ia';
alter type public.accion_bitacora add value if not exists 'decision_ia';

-- Llamadas al modelo por mes. 0 = IA apagada para el tenant.
alter table public.tenants
  add column ia_limite_mensual int not null default 300 check (ia_limite_mensual >= 0);

-- Vigencia del permiso / constancia del cliente (la lee el OCR). Distinta de
-- instalaciones.vencimiento, que es el vencimiento del dictamen.
-- (el INSERT a nivel tabla para authenticated ya cubre la columna nueva)
alter table public.instalaciones add column permiso_vigencia date;

create table public.ia_solicitudes (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants (id) on delete cascade,
  -- null = proceso automático (semáforo calculado al abrir el expediente)
  usuario_id uuid,
  funcion text not null check (funcion in ('ocr_permiso', 'completitud')),
  estado text not null default 'pendiente' check (estado in ('pendiente', 'ok', 'error')),
  modelo text,
  tokens_entrada int,
  tokens_salida int,
  sugerencia jsonb,
  error text,
  -- Entidad donde terminó la sugerencia (p. ej. la instalación creada con el OCR)
  entidad text,
  entidad_id uuid,
  decision text check (decision in ('aceptada', 'editada', 'descartada')),
  decidida_por uuid,
  decidida_en timestamptz,
  creado_en timestamptz not null default now()
);
create index ia_solicitudes_mes_idx on public.ia_solicitudes (tenant_id, creado_en);

alter table public.ia_solicitudes enable row level security;
revoke all on public.ia_solicitudes from public, anon, authenticated;
grant select on public.ia_solicitudes to authenticated;
-- El admin ve el consumo del tenant; cada usuario, sus propias solicitudes.
create policy ia_solicitudes_select on public.ia_solicitudes for select to authenticated
  using (
    tenant_id = (select app.tenant_id())
    and ((select app.puede('configuracion.editar')) or usuario_id = (select auth.uid()))
  );

/* ---------- Servidor (service_role) ---------- */

-- Los parámetros que pueden ir vacíos llevan `default null` y van al final:
-- así `pnpm db:types` los genera como opcionales y el código los omite.

create function public.ia_reservar(p_tenant uuid, p_funcion text, p_usuario uuid default null) returns uuid
language plpgsql security definer set search_path = '' as $$
declare
  t public.tenants;
  v_usadas int;
  v_id uuid;
begin
  -- Bloquea la fila del tenant: dos reservas simultáneas no rebasan el límite.
  select * into t from public.tenants where id = p_tenant for update;
  if t.id is null then
    raise exception 'Tenant inexistente';
  end if;
  select count(*) into v_usadas
  from public.ia_solicitudes
  where tenant_id = p_tenant
    and creado_en >= (date_trunc('month', now() at time zone t.zona_horaria) at time zone t.zona_horaria);
  if v_usadas >= t.ia_limite_mensual then
    raise exception 'Se alcanzó el límite mensual de uso de IA (% solicitudes)', t.ia_limite_mensual;
  end if;
  insert into public.ia_solicitudes (tenant_id, usuario_id, funcion)
  values (p_tenant, p_usuario, p_funcion)
  returning id into v_id;
  return v_id;
end $$;

create function public.ia_completar(
  p_id uuid, p_modelo text,
  p_tokens_entrada int default null, p_tokens_salida int default null,
  p_sugerencia jsonb default null, p_error text default null
) returns void
language plpgsql security definer set search_path = '' as $$
declare
  s public.ia_solicitudes;
begin
  update public.ia_solicitudes set
    estado = case when p_error is null then 'ok' else 'error' end,
    modelo = p_modelo,
    tokens_entrada = p_tokens_entrada,
    tokens_salida = p_tokens_salida,
    sugerencia = p_sugerencia,
    error = left(p_error, 500)
  where id = p_id and estado = 'pendiente'
  returning * into s;

  -- La lectura del permiso queda en bitácora en cuanto existe, aunque nadie la use.
  if s.id is not null and s.estado = 'ok' and s.funcion = 'ocr_permiso' then
    insert into public.bitacora (tenant_id, entidad, entidad_id, accion, descripcion, usuario_id, despues)
    values (s.tenant_id, 'ia_solicitud', s.id, 'sugerencia_ia',
            'La IA leyó el permiso del cliente y sugirió los datos de la instalación', s.usuario_id, s.sugerencia);
  end if;
end $$;

/* ---------- Usuario ---------- */

-- p_final: lo que la persona guardó, con las mismas llaves que la sugerencia.
-- aceptada = guardó lo sugerido; editada = cambió algún valor que la IA sí propuso;
-- descartada = no usó la sugerencia.
create function public.ia_resolver(
  p_id uuid, p_descartar boolean,
  p_entidad text default null, p_entidad_id uuid default null, p_final jsonb default null
) returns text
language plpgsql security definer set search_path = '' as $$
declare
  s public.ia_solicitudes;
  u public.usuarios;
  v_decision text;
begin
  select * into s from public.ia_solicitudes
  where id = p_id and tenant_id = (select app.tenant_id())
  for update;
  if s.id is null then
    raise exception 'Sugerencia de IA no encontrada';
  end if;
  u := app.exigir(case s.funcion when 'ocr_permiso' then 'clientes.editar' else 'inspecciones.revisar' end);
  if s.estado <> 'ok' then
    raise exception 'La solicitud de IA no terminó correctamente';
  end if;
  if s.decision is not null then
    raise exception 'La sugerencia de IA ya se había resuelto';
  end if;

  v_decision := case
    when p_descartar then 'descartada'
    when exists (
      select 1 from jsonb_each(coalesce(p_final, '{}'::jsonb)) f
      where coalesce(s.sugerencia -> f.key, 'null'::jsonb) <> 'null'::jsonb
        and s.sugerencia -> f.key is distinct from f.value
    ) then 'editada'
    else 'aceptada'
  end;

  update public.ia_solicitudes set
    decision = v_decision, decidida_por = u.id, decidida_en = now(),
    entidad = p_entidad, entidad_id = p_entidad_id
  where id = p_id;

  insert into public.bitacora (tenant_id, entidad, entidad_id, accion, descripcion, usuario_id, antes, despues, ip)
  values (
    u.tenant_id,
    coalesce(p_entidad, 'ia_solicitud'),
    coalesce(p_entidad_id, p_id),
    'decision_ia',
    format('Sugerencia de IA (%s) %s por %s',
      case s.funcion when 'ocr_permiso' then 'lectura del permiso' else 'revisión del expediente' end,
      v_decision, u.nombre),
    u.id,
    s.sugerencia,
    p_final,
    app.ip_cliente()
  );
  return v_decision;
end $$;

/* ---------- Aprobación con la revisión de IA a la vista ---------- */

-- Igual que antes, más p_revision_ia: el semáforo y las sugerencias que el
-- responsable tenía en pantalla al aprobar. Queda en bitácora junto con quién
-- aprobó: la decisión es humana, la IA solo informó.
drop function public.aprobar_y_emitir(uuid);
create function public.aprobar_y_emitir(p_id uuid, p_revision_ia jsonb default null) returns public.dictamenes
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

  if p_revision_ia is not null then
    insert into public.bitacora (tenant_id, entidad, entidad_id, accion, descripcion, usuario_id, despues, ip)
    values (t.id, 'inspeccion', p_id, 'decision_ia',
      format('Revisión de IA a la vista al aprobar (semáforo %s, %s alertas); decidió %s',
        coalesce(p_revision_ia ->> 'nivel', 'sin dato'),
        coalesce(jsonb_array_length(p_revision_ia -> 'alertas'), 0),
        u.nombre),
      u.id, p_revision_ia, app.ip_cliente());
  end if;
  perform app.registrar(t.id, 'inspeccion', p_id, 'aprobar', 'Aprobada por el responsable técnico');
  perform app.registrar(t.id, 'inspeccion', p_id, 'emitir_dictamen', 'Dictamen ' || d.folio || ' emitido');
  return d;
end $$;

-- Reinicio de la demo: también las solicitudes de IA.
create or replace function public.purgar_datos_tenant(p_tenant uuid) returns void
language plpgsql security definer set search_path = '' as $$
begin
  perform set_config('app.purga', 'on', true);
  delete from public.bitacora where tenant_id = p_tenant;
  delete from public.ia_solicitudes where tenant_id = p_tenant;
  delete from public.sincronizaciones where tenant_id = p_tenant;
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

/* ---------- Privilegios ---------- */

revoke all on function
  public.ia_reservar(uuid, text, uuid),
  public.ia_completar(uuid, text, int, int, jsonb, text),
  public.ia_resolver(uuid, boolean, text, uuid, jsonb),
  public.aprobar_y_emitir(uuid, jsonb)
from public, anon, authenticated;

grant execute on function public.ia_reservar(uuid, text, uuid), public.ia_completar(uuid, text, int, int, jsonb, text) to service_role;
grant execute on function public.ia_resolver(uuid, boolean, text, uuid, jsonb), public.aprobar_y_emitir(uuid, jsonb) to authenticated;
