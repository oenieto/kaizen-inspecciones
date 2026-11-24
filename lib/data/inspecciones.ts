import "server-only"
import { cache } from "react"
import { rangoDelDia } from "@/lib/fechas"
import { createClient } from "@/lib/supabase/server"
import type { Json } from "@/lib/supabase/database.types"
import type { EstatusInspeccion, Evidencia, InspeccionDetalle, RespuestaChecklist } from "@/lib/types"
import { datos, esUuid, patronBusqueda, ReglaNegocioError } from "./base"
import {
  mapActa,
  mapBitacora,
  mapChecklist,
  mapCliente,
  mapDictamen,
  mapEvidencia,
  mapFila,
  mapInspeccion,
  mapInstalacion,
  mapNorma,
  mapUsuario,
} from "./mappers"

export { ReglaNegocioError }

/** Vigencia de las URL firmadas de evidencias (segundos) */
const VIGENCIA_URL = 60 * 60

export interface FiltroInspecciones {
  estatus?: EstatusInspeccion
  inspectorId?: string
  desde?: string
  hasta?: string
  q?: string
}

export async function listInspecciones(f: FiltroInspecciones = {}) {
  const supabase = await createClient()
  let consulta = supabase.from("inspecciones_fila").select("*")
  if (f.estatus) consulta = consulta.eq("estatus", f.estatus)
  if (f.inspectorId && esUuid(f.inspectorId)) consulta = consulta.eq("inspector_id", f.inspectorId)
  if (f.desde) consulta = consulta.gte("fecha", f.desde)
  if (f.hasta) consulta = consulta.lt("fecha", f.hasta)
  if (f.q?.trim()) consulta = consulta.ilike("busqueda", patronBusqueda(f.q))
  return datos(await consulta.order("fecha", { ascending: false })).map(mapFila)
}

/** Ventana de la agenda: 45 días atrás y 90 adelante. */
export async function listAgenda() {
  const ahora = Date.now()
  return listInspecciones({
    desde: new Date(ahora - 45 * 86_400_000).toISOString(),
    hasta: new Date(ahora + 90 * 86_400_000).toISOString(),
  })
}

/** Citas del inspector en un día (hora de la operación), ordenadas por hora (ruta del día). */
export async function listRutaDelDia(inspectorId: string, dia: Date) {
  if (!esUuid(inspectorId)) return []
  const supabase = await createClient()
  const { inicio, fin } = rangoDelDia(dia)
  const filas = datos(
    await supabase
      .from("inspecciones")
      .select("*, instalacion:instalaciones(*, cliente:clientes(*))")
      .eq("inspector_id", inspectorId)
      .neq("estatus", "cancelada")
      .gte("fecha", inicio.toISOString())
      .lt("fecha", fin.toISOString())
      .order("fecha"),
  )
  return filas.map(({ instalacion: { cliente, ...instalacion }, ...x }) => ({
    ...mapInspeccion(x),
    instalacion: mapInstalacion(instalacion),
    cliente: mapCliente(cliente),
  }))
}

/** Expediente completo. Memoizado por petición (metadata + página). */
export const getInspeccionDetalle = cache(async (id: string): Promise<InspeccionDetalle | null> => {
  if (!esUuid(id)) return null
  const supabase = await createClient()
  const [fila, bitacora] = await Promise.all([
    supabase
      .from("inspecciones")
      .select(
        "*, instalacion:instalaciones(*, cliente:clientes(*)), norma:normas(*), checklist:checklists(*), inspector:usuarios(*), evidencias(*), acta:actas(*), dictamen:dictamenes(*)",
      )
      .eq("id", id)
      .order("tomada_en", { referencedTable: "evidencias" })
      .maybeSingle(),
    supabase.from("bitacora").select("*").eq("entidad_id", id).order("timestamp", { ascending: false }),
  ])
  const x = datos(fila)
  if (!x) return null
  const { instalacion: { cliente, ...instalacion }, norma, checklist, inspector, evidencias, acta, dictamen, ...inspeccion } = x

  // Evidencias en Storage privado → URL firmada de corta vida (respeta RLS de storage)
  const rutas = evidencias.flatMap((e) => (e.ruta ? [e.ruta] : []))
  const firmadas = new Map<string, string>()
  if (rutas.length) {
    const { data, error } = await supabase.storage.from("evidencias").createSignedUrls(rutas, VIGENCIA_URL)
    if (error) console.error("[storage] URLs firmadas", error.message)
    for (const f of data ?? []) if (f.path && f.signedUrl) firmadas.set(f.path, f.signedUrl)
  }

  return {
    ...mapInspeccion(inspeccion),
    instalacion: mapInstalacion(instalacion),
    cliente: mapCliente(cliente),
    norma: mapNorma(norma),
    checklist: mapChecklist(checklist),
    inspector: mapUsuario(inspector),
    evidencias: evidencias.map((e) => mapEvidencia(e, (e.ruta ? firmadas.get(e.ruta) : e.url) ?? "")),
    acta: acta ? mapActa(acta) : null,
    dictamen: dictamen ? mapDictamen(dictamen) : null,
    bitacora: datos(bitacora).map(mapBitacora),
  }
})

/** Nueva cita con el checklist de una norma vigente. La bitácora la escribe un trigger. */
export async function createInspeccion(data: { instalacionId: string; inspectorId: string; fecha: string; duracionMin: number }) {
  const supabase = await createClient()
  const checklist = datos(
    await supabase
      .from("checklists")
      .select("id, norma_id, norma:normas!inner(vigente)")
      .eq("norma.vigente", true)
      .order("creado_en")
      .limit(1)
      .maybeSingle(),
  )
  if (!checklist) throw new ReglaNegocioError("No hay un checklist configurado para una norma vigente")
  const x = datos(
    await supabase
      .from("inspecciones")
      .insert({
        instalacion_id: data.instalacionId,
        inspector_id: data.inspectorId,
        fecha: data.fecha,
        duracion_min: data.duracionMin,
        norma_id: checklist.norma_id,
        checklist_id: checklist.id,
      })
      .select()
      .single(),
  )
  return mapInspeccion(x)
}

export async function reprogramar(id: string, fecha: string) {
  const supabase = await createClient()
  datos(await supabase.rpc("reprogramar_inspeccion", { p_id: id, p_fecha: fecha }))
}

export async function cancelar(id: string) {
  const supabase = await createClient()
  datos(await supabase.rpc("cancelar_inspeccion", { p_id: id }))
}

export interface CapturaCampo {
  respuestas: RespuestaChecklist[]
  observaciones: string
  /** `ruta`: objeto ya subido al bucket «evidencias» ({tenant}/{inspeccion}/{archivo}) */
  evidencias: (Pick<Evidencia, "tipo" | "nombre" | "lat" | "lng" | "tomadaEn" | "hash"> & { ruta: string })[]
  firmaCliente: string | null
  firmaInspector: string | null
  nombreFirmaCliente: string | null
  finalizar: boolean
  /** Llave de idempotencia (UUID del cliente). Un envío ya aplicado devuelve su resultado original. */
  envioId?: string
}

/** Recibe lo capturado offline en la PWA (una transacción en sincronizar_captura). Con `finalizar` pasa a revisión. */
export async function sincronizarCaptura(id: string, c: CapturaCampo) {
  const supabase = await createClient()
  const r = datos(await supabase.rpc("sincronizar_captura", { p_id: id, p_captura: c as unknown as Json }))
  /** `repetido`: el envío ya se había aplicado (reintento tras perder la respuesta) */
  return r as { estatus: EstatusInspeccion; evidenciasNuevas: number; repetido?: boolean }
}

export async function devolverACampo(id: string, motivo: string) {
  const supabase = await createClient()
  datos(await supabase.rpc("devolver_a_campo", { p_id: id, p_motivo: motivo }))
}

/**
 * Aprobación del responsable técnico: función SQL transaccional que asigna el
 * folio consecutivo sin huecos (bloqueo de la fila de folios) y emite el dictamen.
 */
export async function aprobarYEmitir(id: string) {
  const supabase = await createClient()
  return mapDictamen(datos(await supabase.rpc("aprobar_y_emitir", { p_id: id })))
}
