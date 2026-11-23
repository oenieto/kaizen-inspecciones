"use server"

import { revalidatePath } from "next/cache"
import { z } from "zod"
import { requirePermiso } from "@/lib/auth"
import { ejecutar } from "@/lib/action-result"
import { getInspeccionDetalle, sincronizarCaptura } from "@/lib/data/inspecciones"
import { MAX_FOTOS } from "@/lib/offline/captura"

const dataUrlImagen = z.string().regex(/^data:image\/(png|jpeg|webp);base64,/, "Imagen inválida").max(3_000_000, "Imagen demasiado grande")

const capturaSchema = z.object({
  respuestas: z
    .array(
      z.object({
        reactivoId: z.string(),
        valor: z.enum(["cumple", "no_cumple", "na"]).nullable(),
        medicion: z.number().finite().nullable().optional(),
        observacion: z.string().max(2000).optional(),
      }),
    )
    .max(500),
  observaciones: z.string().max(5000),
  fotos: z
    .array(
      z.object({
        nombre: z.string().max(200),
        dataUrl: dataUrlImagen,
        lat: z.number().min(-90).max(90).nullable(),
        lng: z.number().min(-180).max(180).nullable(),
        tomadaEn: z.iso.datetime(),
        hash: z.string().max(100),
      }),
    )
    .max(MAX_FOTOS, `Máximo ${MAX_FOTOS} fotos por inspección`),
  firmaCliente: dataUrlImagen.nullable(),
  firmaInspector: dataUrlImagen.nullable(),
  nombreFirmaCliente: z.string().max(200),
  finalizar: z.boolean(),
})

export type CapturaPayload = z.input<typeof capturaSchema>

/**
 * Recibe la captura offline de la PWA. BACKEND: las fotos van a Supabase
 * Storage (subida directa con URL firmada) y aquí solo llegan sus rutas.
 */
export async function sincronizarInspeccion(inspeccionId: string, payload: CapturaPayload) {
  return ejecutar(async () => {
    const s = await requirePermiso("campo.capturar")
    const x = await getInspeccionDetalle(inspeccionId)
    if (!x) throw new Error("La inspección no existe")
    if (s.usuario.rol === "inspector" && x.inspectorId !== s.usuario.id) throw new Error("La inspección está asignada a otro inspector")
    const c = capturaSchema.parse(payload)
    await sincronizarCaptura(
      inspeccionId,
      {
        respuestas: c.respuestas,
        observaciones: c.observaciones,
        evidencias: c.fotos.map((f) => ({ tipo: "foto", nombre: f.nombre, url: f.dataUrl, lat: f.lat, lng: f.lng, tomadaEn: f.tomadaEn, hash: f.hash })),
        firmaCliente: c.firmaCliente,
        firmaInspector: c.firmaInspector,
        nombreFirmaCliente: c.nombreFirmaCliente || null,
        finalizar: c.finalizar,
      },
      s.usuario.id,
    )
    revalidatePath("/campo")
    revalidatePath(`/inspecciones/${inspeccionId}`)
  }, payload.finalizar ? "Sincronizado y enviado a revisión" : "Avance sincronizado")
}
