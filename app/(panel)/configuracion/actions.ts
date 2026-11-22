"use server"

import { revalidatePath } from "next/cache"
import { z } from "zod"
import { requirePermiso } from "@/lib/auth"
import { ejecutar } from "@/lib/action-result"
import { updateBranding } from "@/lib/data/catalogos"
import { createAdminClient } from "@/lib/supabase/admin"
import { sembrar } from "@/db/sembrar"

const brandingSchema = z.object({
  nombreCorto: z.string().trim().min(2, "Nombre corto requerido"),
  razonSocial: z.string().trim().min(3, "Razón social requerida"),
  acreditacionEma: z.string().trim().min(3, "Acreditación requerida"),
  colorPrimario: z.string().regex(/^#[0-9a-f]{6}$/i, "Color inválido"),
  logoUrl: z.string().trim().transform((v) => v || null).pipe(z.url().nullable()),
})

export async function guardarBranding(input: z.input<typeof brandingSchema>) {
  return ejecutar(async () => {
    await requirePermiso("configuracion.editar")
    await updateBranding(brandingSchema.parse(input))
    revalidatePath("/", "layout")
  }, "Branding actualizado")
}

/**
 * Solo demo (MODO_DEMO=true): vuelve a los datos seed entre ensayos. Borra los
 * datos operativos del tenant —incluida la bitácora— y restablece las cuentas.
 */
export async function reiniciarDemo() {
  return ejecutar(async () => {
    await requirePermiso("configuracion.editar")
    const password = process.env.SEED_PASSWORD
    if (process.env.MODO_DEMO !== "true" || !password) throw new Error("El reinicio solo está disponible en modo demo")
    await sembrar(createAdminClient(), { password })
    revalidatePath("/", "layout")
  }, "Datos de demo reiniciados")
}
