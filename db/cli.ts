import { createClient } from "@supabase/supabase-js"
import type { Database } from "@/lib/supabase/database.types"
import { sembrar } from "./sembrar"

/** `pnpm seed`: carga los datos de demo en el Supabase de .env.local. */
const url = process.env.NEXT_PUBLIC_SUPABASE_URL
const key = process.env.SUPABASE_SERVICE_ROLE_KEY
const password = process.env.SEED_PASSWORD
if (!url || !key || !password) {
  console.error("Faltan NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY o SEED_PASSWORD en .env.local")
  process.exit(1)
}
if (password.length < 8) {
  console.error("SEED_PASSWORD debe tener al menos 8 caracteres")
  process.exit(1)
}

const admin = createClient<Database>(url, key, { auth: { persistSession: false, autoRefreshToken: false } })
sembrar(admin, { password })
  .then((r) => console.log(`Seed listo en «${r.tenant}»:`, r))
  .catch((e) => {
    console.error(e instanceof Error ? e.message : e)
    process.exit(1)
  })
