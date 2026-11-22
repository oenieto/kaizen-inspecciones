"use server"

import { revalidatePath } from "next/cache"
import { z } from "zod"
import { requirePermiso } from "@/lib/auth"
import { ejecutar } from "@/lib/action-result"
import { aprobarYEmitir, devolverACampo } from "@/lib/data/inspecciones"

function refrescar(id: string) {
  revalidatePath(`/inspecciones/${id}`)
  revalidatePath("/inspecciones")
  revalidatePath("/dictamenes")
  revalidatePath("/dashboard")
}

/** Aprobación del responsable técnico → folio + dictamen. Siempre aprueba un humano. */
export async function aprobarInspeccion(id: string) {
  return ejecutar(async () => {
    const s = await requirePermiso("dictamen.aprobar")
    const d = await aprobarYEmitir(id, s.usuario.id)
    refrescar(id)
    return { dictamenId: d.id, folio: d.folio }
  }, "Dictamen emitido")
}

export async function devolverInspeccion(id: string, motivo: string) {
  return ejecutar(async () => {
    const s = await requirePermiso("inspecciones.revisar")
    await devolverACampo(id, z.string().trim().min(5, "Indica el motivo").parse(motivo), s.usuario.id)
    refrescar(id)
  }, "Devuelta al inspector")
}
