import "server-only"
import { cookies } from "next/headers"
import { redirect } from "next/navigation"
import { getTenant, getUsuario } from "@/lib/data/catalogos"
import { puede, type Accion } from "@/lib/permisos"

/**
 * Sesión de demo: una cookie con el id del usuario elegido en /login.
 * BACKEND: reemplazar por Supabase Auth (createServerClient + getUser) y leer
 * el rol desde la tabla usuarios. La firma de getSession() se mantiene.
 */
export const SESSION_COOKIE = "uv_demo_session"

export async function getSession() {
  const id = (await cookies()).get(SESSION_COOKIE)?.value
  if (!id) return null
  const usuario = await getUsuario(id)
  if (!usuario) return null
  return { usuario, tenant: await getTenant() }
}

export type Session = NonNullable<Awaited<ReturnType<typeof getSession>>>

/** Para páginas: redirige a /login si no hay sesión. */
export async function requireSession() {
  const s = await getSession()
  if (!s) redirect("/login")
  return s
}

/** Para server actions: valida sesión y permiso. */
export async function requirePermiso(accion: Accion) {
  const s = await getSession()
  if (!s) throw new Error("Sesión expirada")
  if (!puede(s.usuario.rol, accion)) throw new Error("No tienes permiso para esta acción")
  return s
}
