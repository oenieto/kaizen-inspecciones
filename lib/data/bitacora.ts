import "server-only"
import { createClient } from "@/lib/supabase/server"
import { datos } from "./base"
import { mapBitacora } from "./mappers"

/**
 * Bitácora de solo inserción (ISO/IEC 17020). Se escribe únicamente en la BD:
 * un trigger genérico (altas, cambios y bajas con antes/después) y las
 * funciones de flujo (reprogramar, sincronizar, aprobar…). No hay políticas de
 * INSERT/UPDATE/DELETE para usuarios y un trigger rechaza cualquier UPDATE/DELETE.
 */

/** Línea de tiempo de una entidad: solo eventos con nombre. */
export async function listBitacora(entidadId: string) {
  const supabase = await createClient()
  return datos(
    await supabase
      .from("bitacora")
      .select("*")
      .eq("entidad_id", entidadId)
      .eq("nivel", "evento")
      .order("timestamp", { ascending: false }),
  ).map(mapBitacora)
}

/**
 * Registro completo para auditoría: eventos y detalle de cada cambio con los
 * valores anteriores y nuevos (`antes` / `despues`) e IP de origen.
 */
export async function listCambios(entidadId: string) {
  const supabase = await createClient()
  return datos(
    await supabase.from("bitacora").select("*").eq("entidad_id", entidadId).order("timestamp", { ascending: false }),
  ).map(mapBitacora)
}
