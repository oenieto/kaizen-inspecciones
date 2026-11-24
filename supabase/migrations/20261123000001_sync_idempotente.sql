-- Sincronización idempotente desde la PWA.
-- Problema: si el servidor aplica el envío final pero la respuesta no llega al
-- celular (señal intermitente), el reintento encontraba la inspección ya «en
-- revisión» y fallaba; la captura quedaba atorada en la cola del dispositivo.
-- Solución: cada envío final lleva una llave UUID generada en el cliente
-- (envioId). Se guarda junto con su resultado en la misma transacción; un
-- reintento con la misma llave devuelve ese resultado sin volver a aplicar nada.

create table public.sincronizaciones (
  envio_id uuid primary key,
  tenant_id uuid not null references public.tenants (id) on delete cascade,
  inspeccion_id uuid not null references public.inspecciones (id) on delete cascade,
  usuario_id uuid not null,
  resultado jsonb not null,
  aplicada_en timestamptz not null default now()
);
create index sincronizaciones_inspeccion_idx on public.sincronizaciones (inspeccion_id);

-- Solo la toca sincronizar_captura (SECURITY DEFINER): RLS sin políticas y sin privilegios.
alter table public.sincronizaciones enable row level security;
revoke all on public.sincronizaciones from public, anon, authenticated;

-- p_captura: { respuestas, observaciones, evidencias: [{ tipo, nombre, ruta, lat, lng, tomadaEn, hash }],
--              firmaCliente, firmaInspector, nombreFirmaCliente, finalizar, envioId? }
create or replace function public.sincronizar_captura(p_id uuid, p_captura jsonb) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  u public.usuarios := app.exigir('campo.capturar');
  x public.inspecciones := app.bloquear_inspeccion(p_id, u.tenant_id);
  v_finalizar boolean := coalesce((p_captura ->> 'finalizar')::boolean, false);
  v_envio uuid := nullif(p_captura ->> 'envioId', '')::uuid;
  v_prefijo text := u.tenant_id::text || '/' || p_id::text || '/';
  v_previo public.sincronizaciones;
  v_resultado jsonb;
  v_ev jsonb;
  v_n int;
  v_nuevas int := 0;
  v_estatus public.estatus_inspeccion;
begin
  if u.rol = 'inspector' and x.inspector_id <> u.id then
    raise exception 'La inspección está asignada a otro inspector';
  end if;

  -- Reintento de un envío ya aplicado: mismo resultado, sin efectos.
  -- La fila de la inspección está bloqueada, así que dos envíos simultáneos
  -- con la misma llave se serializan y el segundo cae aquí.
  if v_envio is not null then
    select * into v_previo from public.sincronizaciones where envio_id = v_envio;
    if v_previo.envio_id is not null then
      if v_previo.inspeccion_id <> p_id or v_previo.tenant_id <> u.tenant_id then
        raise exception 'Llave de envío inválida';
      end if;
      return v_previo.resultado || jsonb_build_object('repetido', true);
    end if;
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

  v_resultado := jsonb_build_object('estatus', v_estatus, 'evidenciasNuevas', v_nuevas);
  if v_envio is not null then
    insert into public.sincronizaciones (envio_id, tenant_id, inspeccion_id, usuario_id, resultado)
    values (v_envio, u.tenant_id, p_id, u.id, v_resultado);
  end if;
  return v_resultado;
end $$;

-- El reinicio de la demo también limpia las llaves de envío.
create or replace function public.purgar_datos_tenant(p_tenant uuid) returns void
language plpgsql security definer set search_path = '' as $$
begin
  perform set_config('app.purga', 'on', true);
  delete from public.bitacora where tenant_id = p_tenant;
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
