import { z } from "zod"

/** Resultado uniforme de las server actions, para mostrar toasts en el cliente. */
export type ActionResult<T = undefined> = { ok: true; data?: T; mensaje?: string } | { ok: false; error: string }

export async function ejecutar<T>(fn: () => Promise<T>, mensaje?: string): Promise<ActionResult<T>> {
  try {
    return { ok: true, data: await fn(), mensaje }
  } catch (e) {
    if (e instanceof z.ZodError) return { ok: false, error: e.issues.map((i) => i.message).join(" · ") }
    return { ok: false, error: e instanceof Error ? e.message : "Error inesperado" }
  }
}
