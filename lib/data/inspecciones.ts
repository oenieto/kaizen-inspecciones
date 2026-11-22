import "server-only"
import { getRama } from "@/config/ramas"
import type {
  Dictamen,
  EstatusInspeccion,
  Evidencia,
  Inspeccion,
  InspeccionDetalle,
  InspeccionFila,
  RespuestaChecklist,
} from "@/lib/types"
import { db, newId, store } from "./store"
import { registrar } from "./bitacora"

export class ReglaNegocioError extends Error {}

export function toFila(x: Inspeccion): InspeccionFila {
  const s = db()
  const inst = s.instalaciones.find((i) => i.id === x.instalacionId)!
  const cliente = s.clientes.find((c) => c.id === inst.clienteId)!
  const inspector = s.usuarios.find((u) => u.id === x.inspectorId)!
  const norma = s.normas.find((n) => n.id === x.normaId)!
  const dictamen = s.dictamenes.find((d) => d.inspeccionId === x.id)
  return {
    id: x.id,
    fecha: x.fecha,
    estatus: x.estatus,
    clienteId: cliente.id,
    cliente: cliente.razonSocial,
    instalacionId: inst.id,
    instalacion: inst.nombre,
    municipio: inst.municipio,
    inspector: inspector.nombre,
    inspectorId: inspector.id,
    norma: norma.clave,
    folio: dictamen?.folio ?? null,
  }
}

export interface FiltroInspecciones {
  estatus?: EstatusInspeccion
  inspectorId?: string
  desde?: string
  hasta?: string
  q?: string
}

export async function listInspecciones(f: FiltroInspecciones = {}) {
  const term = f.q?.trim().toLowerCase()
  return (await store())
    .inspecciones.filter(
      (x) =>
        (!f.estatus || x.estatus === f.estatus) &&
        (!f.inspectorId || x.inspectorId === f.inspectorId) &&
        (!f.desde || x.fecha >= f.desde) &&
        (!f.hasta || x.fecha < f.hasta),
    )
    .map(toFila)
    .filter((r) => !term || `${r.cliente} ${r.instalacion} ${r.folio ?? ""}`.toLowerCase().includes(term))
    .sort((a, b) => b.fecha.localeCompare(a.fecha))
}

/** Ventana de la agenda: 45 días atrás y 90 adelante. */
export async function listAgenda() {
  await store()
  const ahora = Date.now()
  return listInspecciones({
    desde: new Date(ahora - 45 * 86_400_000).toISOString(),
    hasta: new Date(ahora + 90 * 86_400_000).toISOString(),
  })
}

/** Citas del inspector en un día, ordenadas por hora (ruta del día). */
export async function listRutaDelDia(inspectorId: string, dia: Date) {
  const s = await store()
  const inicio = new Date(dia)
  inicio.setHours(0, 0, 0, 0)
  const fin = new Date(inicio.getTime() + 86_400_000)
  return s.inspecciones
    .filter((x) => x.inspectorId === inspectorId && x.estatus !== "cancelada" && x.fecha >= inicio.toISOString() && x.fecha < fin.toISOString())
    .sort((a, b) => a.fecha.localeCompare(b.fecha))
    .map((x) => {
      const instalacion = s.instalaciones.find((i) => i.id === x.instalacionId)!
      const cliente = s.clientes.find((c) => c.id === instalacion.clienteId)!
      return { ...x, instalacion, cliente }
    })
}

export async function getInspeccionDetalle(id: string): Promise<InspeccionDetalle | null> {
  const s = await store()
  const x = s.inspecciones.find((i) => i.id === id)
  if (!x) return null
  const instalacion = s.instalaciones.find((i) => i.id === x.instalacionId)!
  return {
    ...x,
    instalacion,
    cliente: s.clientes.find((c) => c.id === instalacion.clienteId)!,
    norma: s.normas.find((n) => n.id === x.normaId)!,
    checklist: s.checklists.find((c) => c.id === x.checklistId)!,
    inspector: s.usuarios.find((u) => u.id === x.inspectorId)!,
    evidencias: s.evidencias.filter((e) => e.inspeccionId === id),
    acta: s.actas.find((a) => a.inspeccionId === id) ?? null,
    dictamen: s.dictamenes.find((d) => d.inspeccionId === id) ?? null,
    bitacora: s.bitacora.filter((b) => b.entidadId === id).sort((a, b) => b.timestamp.localeCompare(a.timestamp)),
  }
}

function get(id: string) {
  const x = db().inspecciones.find((i) => i.id === id)
  if (!x) throw new ReglaNegocioError("La inspección no existe")
  return x
}

export async function createInspeccion(
  data: { instalacionId: string; inspectorId: string; fecha: string; duracionMin: number },
  usuarioId: string,
) {
  const s = await store()
  const checklist = s.checklists[0]
  const x: Inspeccion = {
    id: newId("ins"),
    tenantId: s.tenant.id,
    instalacionId: data.instalacionId,
    normaId: checklist.normaId,
    checklistId: checklist.id,
    inspectorId: data.inspectorId,
    fecha: data.fecha,
    duracionMin: data.duracionMin,
    estatus: "programada",
    version: 1,
    respuestas: [],
    observaciones: "",
    iniciadaEn: null,
    sincronizadaEn: null,
    enviadaRevisionEn: null,
  }
  s.inspecciones.push(x)
  registrar({ entidad: "inspeccion", entidadId: x.id, accion: "crear", descripcion: "Cita programada", usuarioId })
  return x
}

export async function reprogramar(id: string, fecha: string, usuarioId: string) {
  const x = get(id)
  if (x.estatus !== "programada") throw new ReglaNegocioError("Solo se reprograman citas programadas")
  x.fecha = fecha
  registrar({ entidad: "inspeccion", entidadId: id, accion: "actualizar", descripcion: `Reprogramada a ${new Date(fecha).toLocaleString("es-MX")}`, usuarioId })
}

export async function cancelar(id: string, usuarioId: string) {
  const x = get(id)
  if (x.estatus === "dictaminada") throw new ReglaNegocioError("Una inspección dictaminada no se cancela")
  x.estatus = "cancelada"
  registrar({ entidad: "inspeccion", entidadId: id, accion: "cambiar_estatus", descripcion: "Cancelada", usuarioId })
}

export interface CapturaCampo {
  respuestas: RespuestaChecklist[]
  observaciones: string
  evidencias: Pick<Evidencia, "tipo" | "nombre" | "url" | "lat" | "lng" | "tomadaEn" | "hash">[]
  firmaCliente: string | null
  firmaInspector: string | null
  nombreFirmaCliente: string | null
  finalizar: boolean
}

/** Recibe lo capturado offline en la PWA. Con `finalizar` pasa a revisión. */
export async function sincronizarCaptura(id: string, c: CapturaCampo, usuarioId: string) {
  const s = await store()
  const x = get(id)
  if (x.estatus !== "programada" && x.estatus !== "en_curso")
    throw new ReglaNegocioError("La inspección ya no admite captura de campo")
  x.respuestas = c.respuestas
  x.observaciones = c.observaciones
  x.iniciadaEn ??= new Date().toISOString()
  x.sincronizadaEn = new Date().toISOString()
  x.version += 1
  x.estatus = c.finalizar ? "en_revision" : "en_curso"
  if (c.finalizar) x.enviadaRevisionEn = new Date().toISOString()
  for (const e of c.evidencias) s.evidencias.push({ ...e, id: newId("ev"), inspeccionId: id })
  if (c.firmaCliente || c.firmaInspector) {
    const acta = s.actas.find((a) => a.inspeccionId === id)
    const datos = { firmaCliente: c.firmaCliente, firmaInspector: c.firmaInspector, nombreFirmaCliente: c.nombreFirmaCliente, generadaEn: new Date().toISOString() }
    if (acta) Object.assign(acta, datos, { version: acta.version + 1 })
    else s.actas.push({ id: newId("a"), inspeccionId: id, version: 1, ...datos })
  }
  registrar({
    entidad: "inspeccion",
    entidadId: id,
    accion: "sincronizar",
    descripcion: `Sincronizado desde campo (${c.respuestas.length} respuestas, ${c.evidencias.length} evidencias)${c.finalizar ? " y enviado a revisión" : ""}`,
    usuarioId,
  })
}

export async function devolverACampo(id: string, motivo: string, usuarioId: string) {
  const x = get(id)
  if (x.estatus !== "en_revision") throw new ReglaNegocioError("Solo se devuelven inspecciones en revisión")
  x.estatus = "en_curso"
  registrar({ entidad: "inspeccion", entidadId: id, accion: "cambiar_estatus", descripcion: `Devuelta a campo: ${motivo}`, usuarioId })
}

/**
 * Aprobación del responsable técnico: asigna folio consecutivo sin huecos y
 * emite el dictamen. En Supabase debe ser una función SQL (transacción) que
 * bloquee la fila del folio (SELECT … FOR UPDATE).
 */
export async function aprobarYEmitir(id: string, usuarioId: string): Promise<Dictamen> {
  const s = await store()
  const x = get(id)
  if (x.estatus !== "en_revision") throw new ReglaNegocioError("Solo se aprueban inspecciones en revisión")
  if (s.dictamenes.some((d) => d.inspeccionId === id)) throw new ReglaNegocioError("Ya tiene dictamen")
  const ahora = new Date()
  const year = ahora.getFullYear()
  s.folios[year] = (s.folios[year] ?? 0) + 1
  const meses = getRama(s.tenant.rama).vigenciaDictamenMeses
  const resultado = x.respuestas.some((r) => r.valor === "no_cumple") ? "no_cumple" : "cumple"
  const vigenteHasta = new Date(ahora)
  vigenteHasta.setMonth(vigenteHasta.getMonth() + meses)
  const dictamen: Dictamen = {
    id: newId("d"),
    tenantId: s.tenant.id,
    inspeccionId: id,
    folio: `${s.tenant.serieFolio}-${year}-${String(s.folios[year]).padStart(4, "0")}`,
    resultado,
    tokenQr: crypto.randomUUID().replaceAll("-", "").slice(0, 16),
    aprobadoPor: usuarioId,
    emitidoEn: ahora.toISOString(),
    vigenteHasta: resultado === "cumple" ? vigenteHasta.toISOString() : null,
  }
  s.dictamenes.push(dictamen)
  x.estatus = "dictaminada"
  const inst = s.instalaciones.find((i) => i.id === x.instalacionId)!
  if (dictamen.vigenteHasta) inst.vencimiento = dictamen.vigenteHasta
  registrar({ entidad: "inspeccion", entidadId: id, accion: "aprobar", descripcion: "Aprobada por el responsable técnico", usuarioId })
  registrar({ entidad: "inspeccion", entidadId: id, accion: "emitir_dictamen", descripcion: `Dictamen ${dictamen.folio} emitido`, usuarioId })
  return dictamen
}
