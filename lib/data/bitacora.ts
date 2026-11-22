import "server-only"
import { createClient } from "@/lib/supabase/server"
import { datos } from "./base"
import { mapBitacora } from "./mappers"

/**
 * Bitácora de solo inserción (ISO/IEC 17020). Se escribe únicamente en la BD:
 * triggers de alta y las funciones de flujo (reprogramar, sincronizar,
 * aprobar…). No hay políticas de INSERT/UPDATE/DELETE para usuarios y un
 * trigger rechaza cualquier UPDATE/DELETE.
 */
export async function listBitacora(entidadId: string) {
  const supabase = await createClient()
  return datos(
    await supabase.from("bitacora").select("*").eq("entidad_id", entidadId).order("timestamp", { ascending: false }),
  ).map(mapBitacora)
}
