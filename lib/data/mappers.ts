import "server-only"
import type { Database } from "@/lib/supabase/database.types"
import type {
  Acta,
  Checklist,
  Cliente,
  Competencia,
  Dictamen,
  EntradaBitacora,
  Evidencia,
  Inspeccion,
  InspeccionFila,
  Instalacion,
  Norma,
  Plantilla,
  Reactivo,
  RespuestaChecklist,
  Tenant,
  Usuario,
} from "@/lib/types"

/** snake_case de la BD → formas de lib/types.ts (contrato con las pantallas). */

type Tablas = Database["public"]["Tables"]
type Vistas = Database["public"]["Views"]
export type Fila<T extends keyof Tablas> = Tablas[T]["Row"]

/** Normaliza timestamptz («…+00:00») al ISO con «Z» que usa el frontend. */
export const iso = (v: string) => new Date(v).toISOString()
const isoONull = (v: string | null) => (v ? iso(v) : null)

export const mapTenant = (t: Fila<"tenants">): Tenant => ({
  id: t.id,
  slug: t.slug,
  razonSocial: t.razon_social,
  nombreCorto: t.nombre_corto,
  acreditacionEma: t.acreditacion_ema,
  acreditacionDesde: t.acreditacion_desde,
  rama: t.rama,
  ciudad: t.ciudad,
  sitioWeb: t.sitio_web,
  logoUrl: t.logo_url,
  colorPrimario: t.color_primario,
  serieFolio: t.serie_folio,
})

export const mapUsuario = (u: Fila<"usuarios">): Usuario => ({
  id: u.id,
  tenantId: u.tenant_id,
  nombre: u.nombre,
  email: u.email,
  rol: u.rol,
  iniciales: u.iniciales,
  competencias: u.competencias as unknown as Competencia[],
})

export const mapNorma = (n: Fila<"normas">): Norma => ({
  id: n.id,
  tenantId: n.tenant_id,
  clave: n.clave,
  titulo: n.titulo,
  rama: n.rama,
  vigente: n.vigente,
  nota: n.nota ?? undefined,
})

export const mapChecklist = (c: Fila<"checklists">): Checklist => ({
  id: c.id,
  normaId: c.norma_id,
  version: c.version,
  nombre: c.nombre,
  reactivos: c.reactivos as unknown as Reactivo[],
})

export const mapPlantilla = (p: Fila<"plantillas">): Plantilla => ({
  id: p.id,
  tenantId: p.tenant_id,
  tipo: p.tipo,
  nombre: p.nombre,
  archivo: p.archivo,
  campos: p.campos,
  actualizadaEn: iso(p.actualizada_en),
})

export const mapCliente = (c: Fila<"clientes">): Cliente => ({
  id: c.id,
  tenantId: c.tenant_id,
  rfc: c.rfc,
  razonSocial: c.razon_social,
  giro: c.giro,
  contacto: c.contacto,
  telefono: c.telefono,
  email: c.email,
  creadoEn: iso(c.creado_en),
})

export const mapInstalacion = (i: Fila<"instalaciones">): Instalacion => ({
  id: i.id,
  tenantId: i.tenant_id,
  clienteId: i.cliente_id,
  nombre: i.nombre,
  tipo: i.tipo,
  direccion: i.direccion,
  municipio: i.municipio,
  lat: i.lat,
  lng: i.lng,
  permiso: i.permiso,
  vencimiento: isoONull(i.vencimiento),
})

export const mapInspeccion = (x: Fila<"inspecciones">): Inspeccion => ({
  id: x.id,
  tenantId: x.tenant_id,
  instalacionId: x.instalacion_id,
  normaId: x.norma_id,
  checklistId: x.checklist_id,
  inspectorId: x.inspector_id,
  fecha: iso(x.fecha),
  duracionMin: x.duracion_min,
  estatus: x.estatus,
  version: x.version,
  respuestas: x.respuestas as unknown as RespuestaChecklist[],
  observaciones: x.observaciones,
  iniciadaEn: isoONull(x.iniciada_en),
  sincronizadaEn: isoONull(x.sincronizada_en),
  enviadaRevisionEn: isoONull(x.enviada_revision_en),
})

/** `url` debe venir ya resuelta (URL firmada de Storage o URL fija). */
export const mapEvidencia = (e: Fila<"evidencias">, url: string): Evidencia => ({
  id: e.id,
  inspeccionId: e.inspeccion_id,
  tipo: e.tipo,
  nombre: e.nombre,
  url,
  lat: e.lat,
  lng: e.lng,
  tomadaEn: iso(e.tomada_en),
  hash: e.hash,
})

export const mapActa = (a: Fila<"actas">): Acta => ({
  id: a.id,
  inspeccionId: a.inspeccion_id,
  version: a.version,
  firmaCliente: a.firma_cliente,
  firmaInspector: a.firma_inspector,
  nombreFirmaCliente: a.nombre_firma_cliente,
  generadaEn: iso(a.generada_en),
})

export const mapDictamen = (d: Fila<"dictamenes">): Dictamen => ({
  id: d.id,
  tenantId: d.tenant_id,
  inspeccionId: d.inspeccion_id,
  folio: d.folio,
  resultado: d.resultado,
  tokenQr: d.token_qr,
  aprobadoPor: d.aprobado_por,
  emitidoEn: iso(d.emitido_en),
  vigenteHasta: isoONull(d.vigente_hasta),
})

export const mapBitacora = (b: Fila<"bitacora">): EntradaBitacora => ({
  id: b.id,
  tenantId: b.tenant_id,
  entidad: b.entidad,
  entidadId: b.entidad_id,
  accion: b.accion,
  descripcion: b.descripcion,
  // Sin usuario = proceso del sistema (carga de datos)
  usuarioId: b.usuario_id ?? "sistema",
  timestamp: iso(b.timestamp),
  nivel: b.nivel === "detalle" ? "detalle" : "evento",
  antes: (b.antes as Record<string, unknown> | null) ?? null,
  despues: (b.despues as Record<string, unknown> | null) ?? null,
  ip: b.ip == null ? null : String(b.ip),
})

/** Las columnas de una vista salen como nullable en los tipos generados. */
export const mapFila = (r: Vistas["inspecciones_fila"]["Row"]): InspeccionFila => ({
  id: r.id!,
  fecha: iso(r.fecha!),
  estatus: r.estatus!,
  clienteId: r.cliente_id!,
  cliente: r.cliente!,
  instalacionId: r.instalacion_id!,
  instalacion: r.instalacion!,
  municipio: r.municipio!,
  inspector: r.inspector!,
  inspectorId: r.inspector_id!,
  norma: r.norma!,
  folio: r.folio,
})
