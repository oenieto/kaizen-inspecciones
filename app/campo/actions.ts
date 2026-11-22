"use server"

import { revalidatePath } from "next/cache"
import { z } from "zod"
import { requirePermiso } from "@/lib/auth"
import { ejecutar } from "@/lib/action-result"
import { getInspeccionDetalle, sincronizarCaptura } from "@/lib/data/inspecciones"
import { notificar } from "@/lib/notificaciones"
import { createClient } from "@/lib/supabase/server"

const uuid = z.uuid("Identificador inválido")
const dataUrlFirma = z.string().regex(/^data:image\/(png|jpeg|webp);base64,/, "Firma inválida").max(1_000_000, "Firma demasiado grande")

async function inspeccionAsignada(inspeccionId: string) {
  const s = await requirePermiso("campo.capturar")
  const x = await getInspeccionDetalle(uuid.parse(inspeccionId))
  if (!x) throw new Error("La inspección no existe")
  if (s.usuario.rol === "inspector" && x.inspectorId !== s.usuario.id) throw new Error("La inspección está asignada a otro inspector")
  return { s, x }
}

/**
 * Paso 1 de la sincronización: URLs firmadas para subir las fotos directo a
 * Storage desde el dispositivo (sin pasar el binario por el servidor). Las que
 * ya existen (reintento tras corte de red) vuelven sin token.
 */
export async function prepararSubidaFotos(inspeccionId: string, fotoIds: string[]) {
  return ejecutar(async () => {
    const { s, x } = await inspeccionAsignada(inspeccionId)
    const ids = z.array(uuid).max(20).parse(fotoIds)
    const supabase = await createClient()
    const carpeta = `${s.tenant.id}/${x.id}`
    const { data: existentes } = await supabase.storage.from("evidencias").list(carpeta, { limit: 1000 })
    const yaSubidas = new Set((existentes ?? []).map((o) => o.name))
    return Promise.all(
      ids.map(async (id) => {
        const ruta = `${carpeta}/${id}.jpg`
        if (yaSubidas.has(`${id}.jpg`)) return { id, ruta, token: null }
        const { data, error } = await supabase.storage.from("evidencias").createSignedUploadUrl(ruta)
        if (error) throw new Error(`No se pudo preparar la subida: ${error.message}`)
        return { id, ruta, token: data.token }
      }),
    )
  })
}

const capturaSchema = z.object({
  respuestas: z
    .array(
      z.object({
        reactivoId: z.string().max(50),
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
        ruta: z.string().regex(/^[0-9a-f-]{36}\/[0-9a-f-]{36}\/[0-9a-f-]{36}\.jpg$/, "Ruta de evidencia inválida"),
        lat: z.number().min(-90).max(90).nullable(),
        lng: z.number().min(-180).max(180).nullable(),
        tomadaEn: z.iso.datetime(),
        hash: z.string().max(100),
      }),
    )
    .max(20),
  firmaCliente: dataUrlFirma.nullable(),
  firmaInspector: dataUrlFirma.nullable(),
  nombreFirmaCliente: z.string().max(200),
  finalizar: z.boolean(),
})

export type CapturaPayload = z.input<typeof capturaSchema>

/** Paso 2: registra la captura con las rutas ya subidas (transacción en la BD). */
export async function sincronizarInspeccion(inspeccionId: string, payload: CapturaPayload) {
  return ejecutar(async () => {
    const { s, x } = await inspeccionAsignada(inspeccionId)
    const c = capturaSchema.parse(payload)
    const prefijo = `${s.tenant.id}/${x.id}/`
    if (c.fotos.some((f) => !f.ruta.startsWith(prefijo))) throw new Error("Evidencia de otra inspección")
    const r = await sincronizarCaptura(x.id, {
      respuestas: c.respuestas,
      observaciones: c.observaciones,
      evidencias: c.fotos.map((f) => ({ tipo: "foto", nombre: f.nombre, ruta: f.ruta, lat: f.lat, lng: f.lng, tomadaEn: f.tomadaEn, hash: f.hash })),
      firmaCliente: c.firmaCliente,
      firmaInspector: c.firmaInspector,
      nombreFirmaCliente: c.nombreFirmaCliente || null,
      finalizar: c.finalizar,
    })
    if (c.finalizar) notificar("inspeccion.en_revision", { tenant: s.tenant.slug, inspeccionId: x.id, inspectorId: x.inspectorId })
    revalidatePath("/campo")
    revalidatePath(`/inspecciones/${x.id}`)
    return r
  }, payload.finalizar ? "Sincronizado y enviado a revisión" : "Avance sincronizado")
}
