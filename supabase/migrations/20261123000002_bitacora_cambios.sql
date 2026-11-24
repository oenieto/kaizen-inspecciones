-- Bitácora con antes/después (ISO/IEC 17020: trazabilidad de registros).
--
-- Un solo trigger genérico registra cada alta, cambio y baja hecha por un
-- usuario en las tablas de negocio, con los valores anteriores y nuevos de los
-- campos que cambiaron (JSONB) y la IP de origen.
--
-- Dos niveles para no duplicar el historial del expediente:
--   evento  → lo que ve la línea de tiempo («Cita programada», «Dictamen … emitido»).
--             Lo escriben las funciones de flujo (app.registrar) y el trigger
--             cuando el usuario escribe directo en la tabla (alta de cliente, branding).
--   detalle → el cambio de fila que ocurre DENTRO de una función de flujo. El
--             evento con nombre ya lo escribe la función; el detalle guarda el
--             antes/después para auditoría.
-- Las funciones de flujo se reconocen porque todas empiezan con app.exigir(),
-- que marca la transacción con app.en_flujo = on.
--
-- Cargas con service_role (pnpm seed, reinicio de la demo) no tienen auth.uid()
-- y no generan bitácora automática: el seed escribe su propia bitácora histórica.

alter type public.accion_bitacora add value if not exists 'eliminar';

alter table public.bitacora
  add column nivel text not null default 'evento' check (nivel in ('evento', 'detalle')),
  add column antes jsonb,
  add column despues jsonb,
  -- Informativa: la manda el servidor de Next (x-cliente-ip) o la del gateway.
  add column ip inet;

create index bitacora_nivel_idx on public.bitacora (entidad_id, nivel, "timestamp" desc);

/* ---------- Contexto de la petición ---------- */

-- IP del cliente final. Next la reenvía en x-cliente-ip (las consultas salen del
-- servidor, no del navegador); si no viene, la primera de x-forwarded-for.
create function app.ip_cliente() returns inet
language plpgsql stable set search_path = '' as $$
declare
  h jsonb;
  v text;
begin
  h := nullif(current_setting('request.headers', true), '')::jsonb;
  v := trim(split_part(coalesce(h ->> 'x-cliente-ip', h ->> 'x-forwarded-for', ''), ',', 1));
  return nullif(v, '')::inet;
exception when others then
  return null;
end $$;

-- Copia auditable de una fila: las firmas (imágenes base64 de hasta 1 MB) se
-- guardan como su SHA-256, suficiente para probar que no cambiaron.
create function app.fila_auditable(f jsonb) returns jsonb
language sql immutable set search_path = '' as $$
  select f || coalesce((
    select jsonb_object_agg(k, 'sha256:' || encode(sha256(convert_to(f ->> k, 'UTF8')), 'hex'))
    from unnest(array['firma_cliente', 'firma_inspector']) k
    where f ->> k is not null
  ), '{}'::jsonb)
$$;

/* ---------- Escritura ---------- */

-- Las funciones de flujo marcan la transacción (ver encabezado). Deja de ser
-- STABLE porque ahora fija una variable de sesión.
create or replace function app.exigir(p_accion text) returns public.usuarios
language plpgsql security definer set search_path = '' as $$
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
  perform set_config('app.en_flujo', 'on', true);
  return u;
end $$;

-- Evento con nombre (lo llaman las funciones de flujo). Ahora con IP.
create or replace function app.registrar(
  p_tenant uuid, p_entidad text, p_entidad_id uuid, p_accion public.accion_bitacora, p_descripcion text
) returns void
language sql security definer set search_path = '' as $$
  insert into public.bitacora (tenant_id, entidad, entidad_id, accion, descripcion, usuario_id, nivel, ip)
  values (p_tenant, p_entidad, p_entidad_id, p_accion, p_descripcion, (select auth.uid()), 'evento', app.ip_cliente())
$$;

create function app.bitacora_cambio() returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  v_entidad text := tg_argv[0];
  v_old jsonb;
  v_new jsonb;
  v_fila jsonb;
  v_antes jsonb;
  v_despues jsonb;
  v_accion public.accion_bitacora;
  v_desc text;
begin
  if (select auth.uid()) is null then
    return null;
  end if;
  if tg_op <> 'INSERT' then v_old := app.fila_auditable(to_jsonb(old)); end if;
  if tg_op <> 'DELETE' then v_new := app.fila_auditable(to_jsonb(new)); end if;
  v_fila := coalesce(v_new, v_old);

  if tg_op = 'UPDATE' then
    select jsonb_object_agg(k, v_old -> k), jsonb_object_agg(k, v_new -> k)
      into v_antes, v_despues
    from jsonb_object_keys(v_new) k
    where (v_old -> k) is distinct from (v_new -> k);
    if v_despues is null then
      return null; -- UPDATE sin cambios reales
    end if;
    v_accion := 'actualizar';
    v_desc := case v_entidad
      when 'tenant' then 'Branding actualizado'
      else 'Cambio en ' || v_entidad || ': ' || (select string_agg(k, ', ' order by k) from jsonb_object_keys(v_despues) k)
    end;
  elsif tg_op = 'INSERT' then
    v_despues := v_new;
    v_accion := 'crear';
    v_desc := case v_entidad
      when 'cliente' then 'Alta de cliente ' || (v_fila ->> 'razon_social')
      when 'instalacion' then 'Alta de instalación ' || (v_fila ->> 'nombre')
      when 'inspeccion' then 'Cita programada'
      else 'Alta de ' || v_entidad
    end;
  else
    v_antes := v_old;
    v_accion := 'eliminar';
    v_desc := 'Baja de ' || v_entidad;
  end if;

  insert into public.bitacora (tenant_id, entidad, entidad_id, accion, descripcion, usuario_id, nivel, antes, despues, ip)
  values (
    case when v_entidad = 'tenant' then (v_fila ->> 'id')::uuid else (v_fila ->> 'tenant_id')::uuid end,
    v_entidad,
    (v_fila ->> 'id')::uuid,
    v_accion,
    v_desc,
    (select auth.uid()),
    case when current_setting('app.en_flujo', true) = 'on' then 'detalle' else 'evento' end,
    v_antes,
    v_despues,
    app.ip_cliente()
  );
  return null;
end $$;

/* ---------- Triggers: reemplazan los de alta y branding ---------- */

drop trigger clientes_bitacora on public.clientes;
drop trigger instalaciones_bitacora on public.instalaciones;
drop trigger inspecciones_bitacora on public.inspecciones;
drop trigger tenants_bitacora on public.tenants;
drop function app.bitacora_alta();
drop function app.bitacora_branding();

create trigger tenants_bitacora after insert or update or delete on public.tenants
  for each row execute function app.bitacora_cambio('tenant');
create trigger usuarios_bitacora after insert or update or delete on public.usuarios
  for each row execute function app.bitacora_cambio('usuario');
create trigger normas_bitacora after insert or update or delete on public.normas
  for each row execute function app.bitacora_cambio('norma');
create trigger checklists_bitacora after insert or update or delete on public.checklists
  for each row execute function app.bitacora_cambio('checklist');
create trigger plantillas_bitacora after insert or update or delete on public.plantillas
  for each row execute function app.bitacora_cambio('plantilla');
create trigger clientes_bitacora after insert or update or delete on public.clientes
  for each row execute function app.bitacora_cambio('cliente');
create trigger instalaciones_bitacora after insert or update or delete on public.instalaciones
  for each row execute function app.bitacora_cambio('instalacion');
create trigger inspecciones_bitacora after insert or update or delete on public.inspecciones
  for each row execute function app.bitacora_cambio('inspeccion');
create trigger evidencias_bitacora after insert or update or delete on public.evidencias
  for each row execute function app.bitacora_cambio('evidencia');
create trigger actas_bitacora after insert or update or delete on public.actas
  for each row execute function app.bitacora_cambio('acta');
-- Dictámenes: solo inserción (UPDATE/DELETE ya los rechaza dictamenes_solo_insercion)
create trigger dictamenes_bitacora after insert on public.dictamenes
  for each row execute function app.bitacora_cambio('dictamen');

/* ---------- Privilegios ---------- */

revoke all on function app.ip_cliente(), app.fila_auditable(jsonb), app.bitacora_cambio()
  from public, anon, authenticated;
