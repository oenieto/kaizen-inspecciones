import "server-only"
import type { EntradaBitacora } from "@/lib/types"
import { db, newId, store } from "./store"

/**
 * Bitácora de solo inserción (ISO/IEC 17020). En Supabase: tabla `bitacora`
 * sin políticas de UPDATE/DELETE y escrita por trigger o por esta función.
 */
export function registrar(e: Omit<EntradaBitacora, "id" | "tenantId" | "timestamp">) {
  const s = db()
  s.bitacora.push({ id: newId("b"), tenantId: s.tenant.id, timestamp: new Date().toISOString(), ...e })
}

export async function listBitacora(entidadId: string) {
  return (await store())
    .bitacora.filter((b) => b.entidadId === entidadId)
    .sort((a, b) => b.timestamp.localeCompare(a.timestamp))
}
