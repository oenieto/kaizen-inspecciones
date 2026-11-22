import "server-only"
import { connection } from "next/server"
import { createSeed, type DemoStore } from "@/db/seed"

/**
 * Almacén en memoria de la demo. Sobrevive a recargas de HMR en desarrollo y
 * se reinicia al reiniciar el servidor (o con resetStore()).
 *
 * BACKEND: este archivo desaparece al conectar Supabase. Nada fuera de
 * lib/data/ debe importarlo.
 */

const g = globalThis as unknown as { __uvStore?: DemoStore }

export function db(): DemoStore {
  g.__uvStore ??= createSeed()
  return g.__uvStore
}

/**
 * Acceso para consultas: espera la petición (como haría una BD real) para que
 * Cache Components no congele estos datos en el prerender.
 */
export async function store(): Promise<DemoStore> {
  await connection()
  return db()
}

export function resetStore() {
  g.__uvStore = createSeed()
}

export function newId(prefix: string) {
  const s = db()
  s.seq += 1
  return `${prefix}_${s.seq}`
}
