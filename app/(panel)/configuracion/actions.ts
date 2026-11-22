"use server"

import { revalidatePath } from "next/cache"
import { z } from "zod"
import { requirePermiso } from "@/lib/auth"
import { ejecutar } from "@/lib/action-result"
import { updateBranding } from "@/lib/data/catalogos"
import { resetStore } from "@/lib/data/store"

const brandingSchema = z.object({
  nombreCorto: z.string().trim().min(2, "Nombre corto requerido"),
  razonSocial: z.string().trim().min(3, "Razón social requerida"),
  acreditacionEma: z.string().trim().min(3, "Acreditación requerida"),
  colorPrimario: z.string().regex(/^#[0-9a-f]{6}$/i, "Color inválido"),
  logoUrl: z.string().trim().transform((v) => v || null).pipe(z.url().nullable()),
})

export async function guardarBranding(input: z.input<typeof brandingSchema>) {
  return ejecutar(async () => {
    const s = await requirePermiso("configuracion.editar")
    await updateBranding(brandingSchema.parse(input), s.usuario.id)
    revalidatePath("/", "layout")
  }, "Branding actualizado")
}

/** Solo demo: vuelve a los datos seed (útil entre ensayos). */
export async function reiniciarDemo() {
  return ejecutar(async () => {
    await requirePermiso("configuracion.editar")
    resetStore()
    revalidatePath("/", "layout")
  }, "Datos de demo reiniciados")
}
