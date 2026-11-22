import "server-only"
import type { PostgrestError } from "@supabase/supabase-js"

export class ReglaNegocioError extends Error {}

const UNICOS: [string, string][] = [
  ["clientes_tenant_id_rfc_key", "Ya existe un cliente con ese RFC"],
  ["dictamenes_inspeccion_id_key", "Ya tiene dictamen"],
]

/** Traduce un error de Postgres/PostgREST a un mensaje apto para el toast. */
export function errorDe(e: PostgrestError): Error {
  // P0001: reglas de negocio de las funciones SQL; 28000/42501: sesión y permisos
  if (e.code === "P0001" || e.code === "28000") return new ReglaNegocioError(e.message)
  if (e.code === "42501")
    return new ReglaNegocioError(e.message.includes("row-level security") ? "No tienes permiso para esta acción" : e.message)
  if (e.code === "23505") return new ReglaNegocioError(UNICOS.find(([k]) => e.message.includes(k))?.[1] ?? "El registro ya existe")
  if (e.code === "23503") return new ReglaNegocioError("Hace referencia a un registro que no existe")
  if (e.code === "22P02") return new ReglaNegocioError("Identificador inválido")
  console.error("[supabase]", e.code, e.message, e.details)
  return new Error("No se pudo completar la operación")
}

/** Devuelve `data` o lanza el error traducido. */
export function datos<T>(r: { data: T; error: PostgrestError | null }): NonNullable<T> {
  if (r.error) throw errorDe(r.error)
  return r.data as NonNullable<T>
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

/** Los ids de la URL llegan sin validar: uno mal formado es «no existe», no un error 500. */
export const esUuid = (id: string) => UUID.test(id)

/** Escapa comodines para usar texto libre en un filtro ILIKE. */
export const patronBusqueda = (q: string) => `%${q.trim().toLowerCase().replace(/[\\%_]/g, (c) => `\\${c}`)}%`
