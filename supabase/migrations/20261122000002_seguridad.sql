-- Seguridad: privilegios mínimos + RLS por tenant_id y rol.
-- Las escrituras de flujo (reprogramar, sincronizar, aprobar…) NO se permiten
-- directo sobre las tablas: pasan por las funciones de la migración 3, que
-- validan permiso, estatus y escriben la bitácora en la misma transacción.

/* ---------- Privilegios ---------- */

revoke all on all tables in schema public from anon, authenticated;
revoke all on all functions in schema public from public, anon, authenticated;
revoke all on all functions in schema app from public, anon, authenticated;

grant usage on schema app to authenticated, service_role;
grant execute on all functions in schema app to authenticated, service_role;

grant select on all tables in schema public to authenticated;
revoke select on public.folios from authenticated;
grant insert on public.clientes, public.instalaciones, public.inspecciones to authenticated;
-- Branding: solo estas columnas son editables desde la app
grant update (nombre_corto, razon_social, color_primario, acreditacion_ema, logo_url) on public.tenants to authenticated;

alter table public.tenants enable row level security;
alter table public.usuarios enable row level security;
alter table public.normas enable row level security;
alter table public.checklists enable row level security;
alter table public.plantillas enable row level security;
alter table public.clientes enable row level security;
alter table public.instalaciones enable row level security;
alter table public.inspecciones enable row level security;
alter table public.evidencias enable row level security;
alter table public.actas enable row level security;
alter table public.dictamenes enable row level security;
alter table public.folios enable row level security;
alter table public.bitacora enable row level security;

/* ---------- Políticas ---------- */

create policy tenants_select on public.tenants for select to authenticated
  using (id = (select app.tenant_id()));
create policy tenants_update on public.tenants for update to authenticated
  using (id = (select app.tenant_id()) and (select app.puede('configuracion.editar')))
  with check (id = (select app.tenant_id()));

create policy usuarios_select on public.usuarios for select to authenticated
  using (tenant_id = (select app.tenant_id()));

create policy normas_select on public.normas for select to authenticated
  using (tenant_id = (select app.tenant_id()));
create policy checklists_select on public.checklists for select to authenticated
  using (tenant_id = (select app.tenant_id()));
create policy plantillas_select on public.plantillas for select to authenticated
  using (tenant_id = (select app.tenant_id()));

create policy clientes_select on public.clientes for select to authenticated
  using (tenant_id = (select app.tenant_id()));
create policy clientes_insert on public.clientes for insert to authenticated
  with check (tenant_id = (select app.tenant_id()) and (select app.puede('clientes.editar')));

create policy instalaciones_select on public.instalaciones for select to authenticated
  using (tenant_id = (select app.tenant_id()));
create policy instalaciones_insert on public.instalaciones for insert to authenticated
  with check (
    tenant_id = (select app.tenant_id())
    and (select app.puede('clientes.editar'))
    and exists (select 1 from public.clientes c where c.id = cliente_id and c.tenant_id = (select app.tenant_id()))
  );

-- El inspector solo ve sus propias inspecciones (defensa además de la UI).
create policy inspecciones_select on public.inspecciones for select to authenticated
  using (
    tenant_id = (select app.tenant_id())
    and ((select app.rol()) <> 'inspector' or inspector_id = (select auth.uid()))
  );
create policy inspecciones_insert on public.inspecciones for insert to authenticated
  with check (
    tenant_id = (select app.tenant_id())
    and (select app.puede('agenda.editar'))
    and estatus = 'programada'
    and exists (select 1 from public.instalaciones i where i.id = instalacion_id and i.tenant_id = (select app.tenant_id()))
    and exists (select 1 from public.checklists k where k.id = checklist_id and k.norma_id = norma_id and k.tenant_id = (select app.tenant_id()))
    and exists (
      select 1 from public.usuarios u
      where u.id = inspector_id and u.tenant_id = (select app.tenant_id()) and u.activo and u.rol in ('inspector', 'admin')
    )
  );

create policy evidencias_select on public.evidencias for select to authenticated
  using (tenant_id = (select app.tenant_id()) and exists (select 1 from public.inspecciones x where x.id = inspeccion_id));
create policy actas_select on public.actas for select to authenticated
  using (tenant_id = (select app.tenant_id()) and exists (select 1 from public.inspecciones x where x.id = inspeccion_id));
create policy dictamenes_select on public.dictamenes for select to authenticated
  using (tenant_id = (select app.tenant_id()) and exists (select 1 from public.inspecciones x where x.id = inspeccion_id));

create policy bitacora_select on public.bitacora for select to authenticated
  using (tenant_id = (select app.tenant_id()) and (select app.rol()) <> 'inspector');

-- folios: sin políticas → nadie fuera de las funciones SECURITY DEFINER.

/* ---------- Registros inmutables ---------- */

-- Bitácora y dictámenes no se editan ni se borran (folio sin huecos).
-- Única excepción: purgar_datos_tenant() (reinicio de la demo, solo service_role).
create function app.solo_insercion() returns trigger
language plpgsql set search_path = '' as $$
begin
  if tg_op = 'DELETE' and current_setting('app.purga', true) = 'on' then
    return old;
  end if;
  raise exception 'Registro de solo inserción: % no admite %', tg_table_name, lower(tg_op)
    using errcode = '42501';
end $$;

create trigger bitacora_solo_insercion before update or delete on public.bitacora
  for each row execute function app.solo_insercion();
create trigger bitacora_sin_truncate before truncate on public.bitacora
  for each statement execute function app.solo_insercion();
create trigger dictamenes_solo_insercion before update or delete on public.dictamenes
  for each row execute function app.solo_insercion();
create trigger dictamenes_sin_truncate before truncate on public.dictamenes
  for each statement execute function app.solo_insercion();

/* ---------- Bitácora automática ---------- */

create function app.registrar(
  p_tenant uuid, p_entidad text, p_entidad_id uuid, p_accion public.accion_bitacora, p_descripcion text
) returns void
language sql security definer set search_path = '' as $$
  insert into public.bitacora (tenant_id, entidad, entidad_id, accion, descripcion, usuario_id)
  values (p_tenant, p_entidad, p_entidad_id, p_accion, p_descripcion, (select auth.uid()))
$$;
revoke execute on function app.registrar from public, anon, authenticated;

-- Altas hechas por usuarios. Las cargas con service_role (pnpm seed) no tienen
-- auth.uid() y escriben su propia bitácora histórica.
create function app.bitacora_alta() returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  v_fila jsonb := to_jsonb(new);
begin
  if (select auth.uid()) is null then
    return new;
  end if;
  perform app.registrar(
    new.tenant_id,
    tg_argv[0],
    new.id,
    'crear',
    case tg_argv[0]
      when 'cliente' then 'Alta de cliente ' || (v_fila ->> 'razon_social')
      when 'instalacion' then 'Alta de instalación ' || (v_fila ->> 'nombre')
      when 'inspeccion' then 'Cita programada'
    end
  );
  return new;
end $$;

create trigger clientes_bitacora after insert on public.clientes
  for each row execute function app.bitacora_alta('cliente');
create trigger instalaciones_bitacora after insert on public.instalaciones
  for each row execute function app.bitacora_alta('instalacion');
create trigger inspecciones_bitacora after insert on public.inspecciones
  for each row execute function app.bitacora_alta('inspeccion');

create function app.bitacora_branding() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if (select auth.uid()) is not null then
    perform app.registrar(new.id, 'tenant', new.id, 'actualizar', 'Branding actualizado');
  end if;
  return new;
end $$;

create trigger tenants_bitacora after update on public.tenants
  for each row execute function app.bitacora_branding();

/* ---------- Storage ---------- */

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values
  ('evidencias', 'evidencias', false, 10485760, array['image/jpeg', 'image/png', 'image/webp', 'application/pdf']),
  ('plantillas', 'plantillas', false, 10485760, array['application/vnd.openxmlformats-officedocument.wordprocessingml.document'])
on conflict (id) do nothing;

-- Rutas: {tenant_id}/{inspeccion_id}/{archivo} y {tenant_id}/{plantilla}.docx
create policy evidencias_leer on storage.objects for select to authenticated
  using (
    bucket_id = 'evidencias'
    and (storage.foldername(name))[1] = (select app.tenant_id())::text
    and exists (select 1 from public.inspecciones x where x.id::text = (storage.foldername(name))[2])
  );

-- Subida (con URL firmada) solo a una inspección asignada que aún admite captura
create policy evidencias_subir on storage.objects for insert to authenticated
  with check (
    bucket_id = 'evidencias'
    and (storage.foldername(name))[1] = (select app.tenant_id())::text
    and (select app.puede('campo.capturar'))
    and exists (
      select 1 from public.inspecciones x
      where x.id::text = (storage.foldername(name))[2]
        and x.estatus in ('programada', 'en_curso')
        and ((select app.rol()) <> 'inspector' or x.inspector_id = (select auth.uid()))
    )
  );

create policy plantillas_leer on storage.objects for select to authenticated
  using (bucket_id = 'plantillas' and (storage.foldername(name))[1] = (select app.tenant_id())::text);

create policy plantillas_subir on storage.objects for insert to authenticated
  with check (
    bucket_id = 'plantillas'
    and (storage.foldername(name))[1] = (select app.tenant_id())::text
    and (select app.puede('configuracion.editar'))
  );
