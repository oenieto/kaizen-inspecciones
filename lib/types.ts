/**
 * Modelo de dominio. Refleja el modelo de datos del pizarrón (marco 4) y es el
 * contrato entre el frontend y el backend: las tablas de Supabase deben
 * producir exactamente estas formas (snake_case en BD → camelCase aquí).
 * Toda entidad de negocio lleva tenantId (RLS por tenant_id).
 */

export type ID = string
/** Fecha/hora ISO 8601 */
export type ISODate = string

export type Rol = "admin" | "coordinador" | "inspector" | "responsable"

export interface Tenant {
  id: ID
  slug: string
  razonSocial: string
  nombreCorto: string
  acreditacionEma: string
  acreditacionDesde: ISODate
  rama: string
  ciudad: string
  sitioWeb: string
  logoUrl: string | null
  colorPrimario: string
  /** Serie de folio de dictámenes, p. ej. "UVCRE029" */
  serieFolio: string
}

export interface Competencia {
  normaClave: string
  vigenteHasta: ISODate
}

export interface Usuario {
  id: ID
  tenantId: ID
  nombre: string
  email: string
  rol: Rol
  iniciales: string
  competencias: Competencia[]
}

export interface Norma {
  id: ID
  tenantId: ID
  clave: string
  titulo: string
  rama: string
  vigente: boolean
  nota?: string
}

export type TipoReactivo = "cumple" | "medicion" | "texto"

export interface Reactivo {
  id: string
  numeral: string
  seccion: string
  texto: string
  tipo: TipoReactivo
  requerido: boolean
  unidad?: string
}

export interface Checklist {
  id: ID
  normaId: ID
  version: string
  nombre: string
  reactivos: Reactivo[]
}

export interface Cliente {
  id: ID
  tenantId: ID
  rfc: string
  razonSocial: string
  giro: string
  contacto: string
  telefono: string
  email: string
  creadoEn: ISODate
}

export interface Instalacion {
  id: ID
  tenantId: ID
  clienteId: ID
  nombre: string
  tipo: string
  direccion: string
  municipio: string
  lat: number
  lng: number
  permiso: string
  /** Fecha en que vence su dictamen vigente (o null si nunca se ha dictaminado) */
  vencimiento: ISODate | null
}

export type EstatusInspeccion =
  | "programada"
  | "en_curso"
  | "en_revision"
  | "dictaminada"
  | "cancelada"

export type ValorCumple = "cumple" | "no_cumple" | "na"

export interface RespuestaChecklist {
  reactivoId: string
  valor: ValorCumple | null
  medicion?: number | null
  observacion?: string
}

export type TipoEvidencia = "foto" | "documento"

export interface Evidencia {
  id: ID
  inspeccionId: ID
  tipo: TipoEvidencia
  nombre: string
  /** URL en Storage (o data URL en la demo) */
  url: string
  lat: number | null
  lng: number | null
  tomadaEn: ISODate
  hash: string
}

export interface Acta {
  id: ID
  inspeccionId: ID
  version: number
  firmaCliente: string | null
  firmaInspector: string | null
  nombreFirmaCliente: string | null
  generadaEn: ISODate
}

export type ResultadoDictamen = "cumple" | "no_cumple"

export interface Dictamen {
  id: ID
  tenantId: ID
  inspeccionId: ID
  folio: string
  resultado: ResultadoDictamen
  tokenQr: string
  aprobadoPor: ID
  emitidoEn: ISODate
  /** Solo los dictámenes favorables tienen vigencia; null si no cumple */
  vigenteHasta: ISODate | null
}

export interface Inspeccion {
  id: ID
  tenantId: ID
  instalacionId: ID
  normaId: ID
  checklistId: ID
  inspectorId: ID
  /** Inicio programado */
  fecha: ISODate
  duracionMin: number
  estatus: EstatusInspeccion
  version: number
  respuestas: RespuestaChecklist[]
  observaciones: string
  iniciadaEn: ISODate | null
  sincronizadaEn: ISODate | null
  enviadaRevisionEn: ISODate | null
}

export type AccionBitacora =
  | "crear"
  | "actualizar"
  | "cambiar_estatus"
  | "sincronizar"
  | "aprobar"
  | "emitir_dictamen"
  | "subir_evidencia"

export interface EntradaBitacora {
  id: ID
  tenantId: ID
  entidad: string
  entidadId: ID
  accion: AccionBitacora
  descripcion: string
  usuarioId: ID
  timestamp: ISODate
}

export interface Plantilla {
  id: ID
  tenantId: ID
  tipo: "acta" | "dictamen"
  nombre: string
  archivo: string
  campos: string[]
  actualizadaEn: ISODate
}

/* ---------- Vistas compuestas que consumen las pantallas ---------- */

export interface InspeccionDetalle extends Inspeccion {
  instalacion: Instalacion
  cliente: Cliente
  norma: Norma
  checklist: Checklist
  inspector: Usuario
  evidencias: Evidencia[]
  acta: Acta | null
  dictamen: Dictamen | null
  bitacora: EntradaBitacora[]
}

export interface InspeccionFila {
  id: ID
  fecha: ISODate
  estatus: EstatusInspeccion
  clienteId: ID
  cliente: string
  instalacionId: ID
  instalacion: string
  municipio: string
  inspector: string
  inspectorId: ID
  norma: string
  folio: string | null
}
