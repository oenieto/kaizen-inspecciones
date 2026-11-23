"use client"

import { createBrowserClient } from "@supabase/ssr"
import type { Database } from "./database.types"
import { supabaseEnv } from "./env"

let cliente: ReturnType<typeof createBrowserClient<Database>> | undefined

/** Cliente del navegador (PWA de campo): se usa para subir evidencias con URL firmada. */
export function createClient() {
  const { url, anonKey } = supabaseEnv()
  cliente ??= createBrowserClient<Database>(url, anonKey)
  return cliente
}
