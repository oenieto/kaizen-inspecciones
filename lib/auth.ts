import "server-only"
import { cache } from "react"
import { redirect } from "next/navigation"
import { createClient } from "@/lib/supabase/server"
import { mapTenant, mapUsuario } from "@/lib/data/mappers"
import { puede, type Accion } from "@/lib/permisos"

/**
 * Sesión de Supabase Auth. El JWT se verifica con getClaims() y el rol y el
 * tenant salen de la tabla usuarios (no del token), así que un cambio de rol
 * aplica en la siguiente petición. Memoizada por petición.
 */
export const getSession = cache(async () => {
  const supabase = await createClient()
  const { data } = await supabase.auth.getClaims()
  const uid = data?.claims.sub
  if (!uid) return null
  const { data: fila } = await supabase
    .from("usuarios")
    .select("*, tenant:tenants(*)")
    .eq("id", uid)
    .eq("activo", true)
    .maybeSingle()
  if (!fila?.tenant) return null
  const { tenant, ...usuario } = fila
  return { usuario: mapUsuario(usuario), tenant: mapTenant(tenant) }
})

export type Session = NonNullable<Awaited<ReturnType<typeof getSession>>>

/** Para páginas: redirige a /login si no hay sesión. */
export async function requireSession() {
  const s = await getSession()
  if (!s) redirect("/login")
  return s
}

/** Para server actions: valida sesión y permiso (RLS lo vuelve a validar en la BD). */
export async function requirePermiso(accion: Accion) {
  const s = await getSession()
  if (!s) throw new Error("Sesión expirada")
  if (!puede(s.usuario.rol, accion)) throw new Error("No tienes permiso para esta acción")
  return s
}
