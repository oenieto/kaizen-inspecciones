import "server-only"
import { createClient } from "@supabase/supabase-js"
import type { Database } from "./database.types"
import { supabaseEnv } from "./env"

/**
 * Cliente con service_role: ignora RLS. Solo para mantenimiento (reinicio de la
 * demo, cuentas de demo en el login). Nunca para operaciones de usuario.
 */
export function createAdminClient() {
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!key) throw new Error("Falta SUPABASE_SERVICE_ROLE_KEY")
  return createClient<Database>(supabaseEnv().url, key, { auth: { persistSession: false, autoRefreshToken: false } })
}
