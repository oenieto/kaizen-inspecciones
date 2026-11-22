-- Esquema base. Refleja lib/types.ts (snake_case aquí → camelCase en lib/data).
-- Toda entidad de negocio lleva tenant_id; el aislamiento lo hace RLS (migración 2).

create schema if not exists app;
comment on schema app is 'Funciones internas (contexto de sesión, permisos, bitácora). No se expone por la API.';

create type public.rol as enum ('admin', 'coordinador', 'inspector', 'responsable');
create type public.estatus_inspeccion as enum ('programada', 'en_curso', 'en_revision', 'dictaminada', 'cancelada');
create type public.resultado_dictamen as enum ('cumple', 'no_cumple');
create type public.tipo_evidencia as enum ('foto', 'documento');
create type public.tipo_plantilla as enum ('acta', 'dictamen');
create type public.accion_bitacora as enum (
  'crear', 'actualizar', 'cambiar_estatus', 'sincronizar', 'aprobar', 'emitir_dictamen', 'subir_evidencia'
);

create table public.tenants (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  razon_social text not null,
  nombre_corto text not null,
  acreditacion_ema text not null,
  acreditacion_desde date not null,
  rama text not null,
  ciudad text not null default '',
  sitio_web text not null default '',
  logo_url text,
  color_primario text not null default '#000000' check (color_primario ~* '^#[0-9a-f]{6}$'),
  serie_folio text not null,
  zona_horaria text not null default 'America/Mexico_City',
  vigencia_dictamen_meses int not null default 12 check (vigencia_dictamen_meses between 1 and 120),
  creado_en timestamptz not null default now()
);

create table public.usuarios (
  id uuid primary key references auth.users (id) on delete cascade,
  tenant_id uuid not null references public.tenants (id) on delete cascade,
  nombre text not null,
  email text not null,
  rol public.rol not null,
  iniciales text not null,
  -- [{ "normaClave": "NOM-002-SECRE-2010", "vigenteHasta": "2027-06-30T…" }]
  competencias jsonb not null default '[]' check (jsonb_typeof(competencias) = 'array'),
  activo boolean not null default true,
  creado_en timestamptz not null default now(),
  unique (tenant_id, email)
);

-- Contexto de la sesión. SECURITY DEFINER para leer usuarios sin pasar por su
-- propia política (evita recursión en RLS).
create function app.tenant_id() returns uuid
language sql stable security definer set search_path = '' as $$
  select tenant_id from public.usuarios where id = (select auth.uid()) and activo
$$;

create function app.rol() returns public.rol
language sql stable security definer set search_path = '' as $$
  select rol from public.usuarios where id = (select auth.uid()) and activo
$$;

-- Matriz rol → acciones. Debe coincidir con lib/permisos.ts.
create function app.puede(p_accion text) returns boolean
language sql stable security definer set search_path = '' as $$
  select coalesce(p_accion = any (
    case (select rol from public.usuarios where id = (select auth.uid()) and activo)
      when 'admin' then array['agenda.editar', 'clientes.editar', 'inspecciones.revisar', 'dictamen.aprobar', 'configuracion.editar', 'campo.capturar']
      when 'coordinador' then array['agenda.editar', 'clientes.editar']
      when 'responsable' then array['inspecciones.revisar', 'dictamen.aprobar']
      when 'inspector' then array['campo.capturar']
    end
  ), false)
$$;

create table public.normas (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null default app.tenant_id() references public.tenants (id) on delete cascade,
  clave text not null,
  titulo text not null,
  rama text not null,
  vigente boolean not null default true,
  nota text,
  unique (tenant_id, clave)
);

create table public.checklists (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null default app.tenant_id() references public.tenants (id) on delete cascade,
  norma_id uuid not null references public.normas (id) on delete cascade,
  version text not null,
  nombre text not null,
  -- Reactivo[] de lib/types.ts
  reactivos jsonb not null default '[]' check (jsonb_typeof(reactivos) = 'array'),
  creado_en timestamptz not null default now(),
  unique (norma_id, version)
);

create table public.plantillas (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null default app.tenant_id() references public.tenants (id) on delete cascade,
  tipo public.tipo_plantilla not null,
  nombre text not null,
  -- Ruta dentro del bucket «plantillas» ({tenant_id}/dictamen.docx)
  archivo text not null,
  campos text[] not null default '{}',
  actualizada_en timestamptz not null default now(),
  unique (tenant_id, tipo)
);

create table public.clientes (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null default app.tenant_id() references public.tenants (id) on delete cascade,
  rfc text not null,
  razon_social text not null,
  giro text not null,
  contacto text not null,
  telefono text not null,
  email text not null,
  creado_en timestamptz not null default now(),
  unique (tenant_id, rfc)
);

create table public.instalaciones (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null default app.tenant_id() references public.tenants (id) on delete cascade,
  cliente_id uuid not null references public.clientes (id) on delete cascade,
  nombre text not null,
  tipo text not null,
  direccion text not null,
  municipio text not null,
  lat double precision not null check (lat between -90 and 90),
  lng double precision not null check (lng between -180 and 180),
  permiso text not null default '',
  vencimiento timestamptz
);
create index instalaciones_cliente_idx on public.instalaciones (cliente_id);
create index instalaciones_vencimiento_idx on public.instalaciones (tenant_id, vencimiento);

create table public.inspecciones (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null default app.tenant_id() references public.tenants (id) on delete cascade,
  instalacion_id uuid not null references public.instalaciones (id),
  norma_id uuid not null references public.normas (id),
  checklist_id uuid not null references public.checklists (id),
  inspector_id uuid not null references public.usuarios (id),
  fecha timestamptz not null,
  duracion_min int not null check (duracion_min between 15 and 720),
  estatus public.estatus_inspeccion not null default 'programada',
  version int not null default 1,
  -- RespuestaChecklist[] de lib/types.ts
  respuestas jsonb not null default '[]' check (jsonb_typeof(respuestas) = 'array'),
  observaciones text not null default '',
  iniciada_en timestamptz,
  sincronizada_en timestamptz,
  enviada_revision_en timestamptz,
  creado_en timestamptz not null default now()
);
create index inspecciones_fecha_idx on public.inspecciones (tenant_id, fecha);
create index inspecciones_inspector_idx on public.inspecciones (inspector_id, fecha);
create index inspecciones_instalacion_idx on public.inspecciones (instalacion_id);
create index inspecciones_estatus_idx on public.inspecciones (tenant_id, estatus);

create table public.evidencias (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants (id) on delete cascade,
  inspeccion_id uuid not null references public.inspecciones (id) on delete cascade,
  tipo public.tipo_evidencia not null,
  nombre text not null,
  -- Ruta en el bucket «evidencias»; las pantallas reciben una URL firmada.
  -- Única: la misma foto reenviada por la cola de sincronización no se duplica.
  ruta text unique,
  -- URL fija (solo datos históricos / demo).
  url text,
  lat double precision,
  lng double precision,
  tomada_en timestamptz not null,
  hash text not null,
  subida_en timestamptz not null default now(),
  check (ruta is not null or url is not null)
);
create index evidencias_inspeccion_idx on public.evidencias (inspeccion_id);

create table public.actas (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants (id) on delete cascade,
  inspeccion_id uuid not null unique references public.inspecciones (id) on delete cascade,
  version int not null default 1,
  firma_cliente text,
  firma_inspector text,
  nombre_firma_cliente text,
  generada_en timestamptz not null default now()
);

create table public.dictamenes (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants (id) on delete cascade,
  inspeccion_id uuid not null unique references public.inspecciones (id),
  folio text not null,
  resultado public.resultado_dictamen not null,
  token_qr text not null unique,
  aprobado_por uuid not null references public.usuarios (id),
  emitido_en timestamptz not null default now(),
  vigente_hasta timestamptz,
  unique (tenant_id, folio)
);
create index dictamenes_emitido_idx on public.dictamenes (tenant_id, emitido_en);

-- Último consecutivo por tenant y año. Solo lo toca aprobar_y_emitir() con FOR UPDATE.
create table public.folios (
  tenant_id uuid not null references public.tenants (id) on delete cascade,
  anio int not null,
  ultimo int not null default 0 check (ultimo >= 0),
  primary key (tenant_id, anio)
);

-- Bitácora de solo inserción (ISO/IEC 17020). Sin FK a usuarios: el registro
-- debe sobrevivir aunque la cuenta se elimine.
create table public.bitacora (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants (id) on delete cascade,
  entidad text not null,
  entidad_id uuid not null,
  accion public.accion_bitacora not null,
  descripcion text not null,
  usuario_id uuid,
  -- clock_timestamp(): varias entradas de una misma transacción conservan su orden
  "timestamp" timestamptz not null default clock_timestamp()
);
create index bitacora_entidad_idx on public.bitacora (entidad_id, "timestamp" desc);

/* ---------- Vistas para listados (respetan RLS del usuario) ---------- */

create view public.inspecciones_fila with (security_invoker = true) as
select
  x.id,
  x.tenant_id,
  x.fecha,
  x.estatus,
  c.id as cliente_id,
  c.razon_social as cliente,
  i.id as instalacion_id,
  i.nombre as instalacion,
  i.municipio,
  u.nombre as inspector,
  u.id as inspector_id,
  n.clave as norma,
  d.folio,
  lower(c.razon_social || ' ' || i.nombre || ' ' || coalesce(d.folio, '')) as busqueda
from public.inspecciones x
join public.instalaciones i on i.id = x.instalacion_id
join public.clientes c on c.id = i.cliente_id
join public.usuarios u on u.id = x.inspector_id
join public.normas n on n.id = x.norma_id
left join public.dictamenes d on d.inspeccion_id = x.id;

create view public.dictamenes_lista with (security_invoker = true) as
select
  d.*,
  c.razon_social as cliente,
  i.nombre as instalacion,
  n.clave as norma,
  lower(d.folio || ' ' || c.razon_social) as busqueda
from public.dictamenes d
join public.inspecciones x on x.id = d.inspeccion_id
join public.instalaciones i on i.id = x.instalacion_id
join public.clientes c on c.id = i.cliente_id
join public.normas n on n.id = x.norma_id;

create view public.clientes_resumen with (security_invoker = true) as
select
  c.*,
  (select count(*) from public.instalaciones i where i.cliente_id = c.id)::int as instalaciones,
  (select count(*) from public.inspecciones x join public.instalaciones i on i.id = x.instalacion_id where i.cliente_id = c.id)::int as inspecciones,
  lower(c.razon_social || ' ' || c.rfc) as busqueda
from public.clientes c;
