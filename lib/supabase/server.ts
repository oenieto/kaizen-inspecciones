import "server-only"
import { cookies } from "next/headers"
import { connection } from "next/server"
import { createServerClient } from "@supabase/ssr"
import type { Database } from "./database.types"
import { supabaseEnv } from "./env"

/**
 * Cliente con la sesión del usuario (cookies): toda consulta pasa por RLS.
 * `connection()` marca la petición como dinámica: con Cache Components y
 * prefetch parcial, cookies() sola no impide que se prerendericen los datos.
 */
export async function createClient() {
  await connection()
  const cookieStore = await cookies()
  const { url, anonKey } = supabaseEnv()
  return createServerClient<Database>(url, anonKey, {
    cookies: {
      getAll: () => cookieStore.getAll(),
      setAll(cookiesToSet) {
        try {
          for (const { name, value, options } of cookiesToSet) cookieStore.set(name, value, options)
        } catch {
          // Llamado desde un Server Component: el proxy ya refresca la sesión.
        }
      },
    },
  })
}

export type SupabaseServer = Awaited<ReturnType<typeof createClient>>
