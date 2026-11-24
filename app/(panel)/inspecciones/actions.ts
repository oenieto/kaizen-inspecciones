"use server"

import { revalidatePath } from "next/cache"
import { z } from "zod"
import { requirePermiso } from "@/lib/auth"
import { ejecutar } from "@/lib/action-result"
import { aprobarYEmitir, devolverACampo, getInspeccionDetalle } from "@/lib/data/inspecciones"
import { evaluarCompletitud } from "@/lib/ia/completitud"
import { notificar } from "@/lib/notificaciones"

function refrescar(id: string) {
  revalidatePath(`/inspecciones/${id}`)
  revalidatePath("/inspecciones")
  revalidatePath("/dictamenes")
  revalidatePath("/dashboard")
}

/**
 * Aprobación del responsable técnico → folio + dictamen. Siempre aprueba un
 * humano; la revisión de IA que tenía a la vista queda en bitácora junto con
 * su decisión (el semáforo sale de caché: no vuelve a llamar al modelo).
 */
export async function aprobarInspeccion(id: string) {
  return ejecutar(async () => {
    const s = await requirePermiso("dictamen.aprobar")
    const x = await getInspeccionDetalle(id)
    if (!x) throw new Error("La inspección no existe")
    const c = await evaluarCompletitud(x)
    const d = await aprobarYEmitir(id, {
      nivel: c.nivel,
      puntaje: c.puntaje,
      fuente: c.fuente,
      alertas: c.hallazgos.filter((h) => !h.ok).map((h) => (h.ia ? `IA: ${h.texto}` : h.texto)),
      redacciones: c.redacciones,
    })
    notificar("dictamen.emitido", { tenant: s.tenant.slug, inspeccionId: id, dictamenId: d.id, folio: d.folio, resultado: d.resultado })
    refrescar(id)
    return { dictamenId: d.id, folio: d.folio }
  }, "Dictamen emitido")
}

export async function devolverInspeccion(id: string, motivo: string) {
  return ejecutar(async () => {
    await requirePermiso("inspecciones.revisar")
    await devolverACampo(id, z.string().trim().min(5, "Indica el motivo").parse(motivo))
    refrescar(id)
  }, "Devuelta al inspector")
}
