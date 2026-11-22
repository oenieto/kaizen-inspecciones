"use server"

import { revalidatePath } from "next/cache"
import { z } from "zod"
import { requirePermiso } from "@/lib/auth"
import { ejecutar } from "@/lib/action-result"
import { cancelar, createInspeccion, reprogramar } from "@/lib/data/inspecciones"
import { notificar } from "@/lib/notificaciones"

const citaSchema = z.object({
  instalacionId: z.string().min(1, "Elige una instalación"),
  inspectorId: z.string().min(1, "Elige un inspector"),
  fecha: z.string().min(1, "Indica fecha y hora"),
  duracionMin: z.coerce.number().int().min(30).max(480),
})

export async function crearCita(input: z.input<typeof citaSchema>) {
  return ejecutar(async () => {
    const s = await requirePermiso("agenda.editar")
    const data = citaSchema.parse(input)
    const x = await createInspeccion({ ...data, fecha: new Date(data.fecha).toISOString() })
    notificar("cita.programada", { tenant: s.tenant.slug, inspeccionId: x.id, inspectorId: x.inspectorId, fecha: x.fecha })
    revalidatePath("/agenda")
    return x.id
  }, "Cita programada")
}

export async function reprogramarCita(id: string, fechaIso: string) {
  return ejecutar(async () => {
    await requirePermiso("agenda.editar")
    await reprogramar(id, z.iso.datetime({ offset: true }).parse(fechaIso))
    revalidatePath("/agenda")
  }, "Cita reprogramada")
}

export async function cancelarCita(id: string) {
  return ejecutar(async () => {
    await requirePermiso("agenda.editar")
    await cancelar(id)
    revalidatePath("/agenda")
    revalidatePath(`/inspecciones/${id}`)
  }, "Cita cancelada")
}
