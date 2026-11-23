import "server-only"
import { createClient } from "@/lib/supabase/server"
import type { ResultadoDictamen } from "@/lib/types"
import { getTenant } from "./catalogos"
import { datos, esUuid, patronBusqueda } from "./base"
import { getInspeccionDetalle } from "./inspecciones"
import { iso, mapDictamen, mapUsuario, type Fila } from "./mappers"

export async function listDictamenes(q?: string) {
  const supabase = await createClient()
  let consulta = supabase.from("dictamenes_lista").select("*")
  if (q?.trim()) consulta = consulta.ilike("busqueda", patronBusqueda(q))
  return datos(await consulta.order("emitido_en", { ascending: false })).map(({ cliente, instalacion, norma, ...d }) => ({
    ...mapDictamen(d as Fila<"dictamenes">),
    cliente: cliente!,
    instalacion: instalacion!,
    norma: norma!,
  }))
}

/** Todo lo necesario para renderizar el dictamen (y para la plantilla .docx). */
export async function getDictamenCompleto(id: string) {
  if (!esUuid(id)) return null
  const supabase = await createClient()
  const d = datos(await supabase.from("dictamenes").select("*, responsable:usuarios(*)").eq("id", id).maybeSingle())
  if (!d) return null
  const { responsable, ...dictamen } = d
  const [inspeccion, tenant] = await Promise.all([getInspeccionDetalle(dictamen.inspeccion_id), getTenant()])
  if (!inspeccion) return null
  return { dictamen: mapDictamen(dictamen), inspeccion, responsable: mapUsuario(responsable), tenant }
}

interface Verificacion {
  folio: string
  resultado: ResultadoDictamen
  emitidoEn: string
  vigenteHasta: string | null
  cliente: string
  instalacion: string
  norma: string
  unidad: string
  acreditacion: string
}

/** Verificación pública por QR (sin sesión): la función SQL expone solo lo mínimo. */
export async function verificarToken(token: string) {
  const supabase = await createClient()
  const v = datos(await supabase.rpc("verificar_dictamen", { p_token: token })) as unknown as Verificacion | null
  if (!v) return null
  return { ...v, emitidoEn: iso(v.emitidoEn), vigenteHasta: v.vigenteHasta ? iso(v.vigenteHasta) : null }
}
