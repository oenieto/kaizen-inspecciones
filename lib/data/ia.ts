import "server-only"
import type { Json } from "@/lib/supabase/database.types"
import { createClient } from "@/lib/supabase/server"
import { datos } from "./base"

export type DecisionIA = "aceptada" | "editada" | "descartada"

/**
 * Registra qué hizo la persona con una sugerencia de IA: la BD compara lo
 * sugerido con lo guardado (`final`, mismas llaves), marca aceptada/editada y
 * escribe en bitácora ambas versiones con quién decidió.
 */
export async function resolverSugerenciaIA(
  solicitudId: string,
  r: { descartar: true } | { descartar?: false; entidad: string; entidadId: string; final: Record<string, unknown> },
): Promise<DecisionIA> {
  const supabase = await createClient()
  return datos(
    await supabase.rpc("ia_resolver", {
      p_id: solicitudId,
      p_descartar: Boolean(r.descartar),
      p_entidad: r.descartar ? null : r.entidad,
      p_entidad_id: r.descartar ? null : r.entidadId,
      p_final: r.descartar ? null : (r.final as Json),
    }),
  ) as DecisionIA
}
