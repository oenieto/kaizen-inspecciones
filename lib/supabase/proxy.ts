import { NextResponse, type NextRequest } from "next/server"
import { createServerClient } from "@supabase/ssr"
import type { Database } from "./database.types"
import { supabaseEnv } from "./env"

/** Refresca el token de Supabase en cada petición y devuelve el usuario verificado. */
export async function actualizarSesion(request: NextRequest) {
  let response = NextResponse.next({ request })
  const { url, anonKey } = supabaseEnv()
  const supabase = createServerClient<Database>(url, anonKey, {
    cookies: {
      getAll: () => request.cookies.getAll(),
      setAll(cookiesToSet, headers) {
        for (const { name, value } of cookiesToSet) request.cookies.set(name, value)
        response = NextResponse.next({ request })
        for (const { name, value, options } of cookiesToSet) response.cookies.set(name, value, options)
        for (const [k, v] of Object.entries(headers)) response.headers.set(k, v)
      },
    },
  })
  const { data } = await supabase.auth.getClaims()
  return { response, usuarioId: data?.claims.sub ?? null }
}
