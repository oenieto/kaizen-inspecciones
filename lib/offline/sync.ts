"use client"

import { prepararSubidaFotos, sincronizarInspeccion } from "@/app/campo/actions"
import type { ActionResult } from "@/lib/action-result"
import { createClient } from "@/lib/supabase/client"
import { capturasDb, type CapturaLocal } from "./db"
import { estaEnLinea } from "./red"

/**
 * Sube a Storage las fotos que aún no tienen ruta (URL firmada por foto) y
 * guarda cada ruta en IndexedDB en cuanto sube, para que un corte de red a
 * media cola no obligue a resubir lo ya enviado.
 */
async function subirFotos(c: CapturaLocal): Promise<ActionResult<CapturaLocal>> {
  const pendientes = c.fotos.filter((f) => !f.ruta)
  if (!pendientes.length) return { ok: true, data: c }
  const r = await prepararSubidaFotos(c.inspeccionId, pendientes.map((f) => f.id))
  if (!r.ok) return r
  const storage = createClient().storage.from("evidencias")
  let fotos = c.fotos
  for (const { id, ruta, token } of r.data!) {
    if (token) {
      const foto = c.fotos.find((f) => f.id === id)!
      const blob = await (await fetch(foto.dataUrl)).blob()
      const { error } = await storage.uploadToSignedUrl(ruta, token, blob, { contentType: "image/jpeg" })
      if (error) return { ok: false, error: `No se pudo subir «${foto.nombre}»: ${error.message}` }
    }
    fotos = fotos.map((f) => (f.id === id ? { ...f, ruta } : f))
    await capturasDb.update(c.inspeccionId, { fotos })
  }
  return { ok: true, data: { ...c, fotos } }
}

/**
 * Envía una captura al servidor. Si sale bien y es final, la borra de IndexedDB.
 * El envío final lleva una llave de idempotencia guardada en IndexedDB antes del
 * primer intento: un reintento tras perder la respuesta no falla ni duplica.
 */
export async function enviarCaptura(c: CapturaLocal, finalizar: boolean) {
  if (finalizar && !c.envioId) {
    c = { ...c, envioId: crypto.randomUUID() }
    await capturasDb.update(c.inspeccionId, { envioId: c.envioId })
  }
  const subida = await subirFotos(c)
  if (!subida.ok) return subida
  const r = await sincronizarInspeccion(c.inspeccionId, {
    envioId: finalizar ? c.envioId : undefined,
    respuestas: c.respuestas,
    observaciones: c.observaciones,
    fotos: subida.data!.fotos.map(({ nombre, ruta, lat, lng, tomadaEn, hash }) => ({ nombre, ruta: ruta!, lat, lng, tomadaEn, hash })),
    firmaCliente: c.firmaCliente,
    firmaInspector: c.firmaInspector,
    nombreFirmaCliente: c.nombreFirmaCliente,
    finalizar,
  })
  if (r.ok && finalizar) await capturasDb.delete(c.inspeccionId)
  return r
}

let enCurso = false

/** Cola de sincronización: manda todo lo «pendiente» cuando hay señal. */
export async function sincronizarPendientes() {
  if (enCurso || !estaEnLinea()) return { enviadas: 0, errores: 0 }
  enCurso = true
  let enviadas = 0
  let errores = 0
  try {
    const pendientes = await capturasDb.where("estado").equals("pendiente").toArray()
    for (const c of pendientes) {
      try {
        const r = await enviarCaptura(c, true)
        if (r.ok) enviadas++
        else errores++
      } catch {
        errores++ // sin red a mitad del envío: se reintenta en el próximo «online»
      }
    }
  } finally {
    enCurso = false
  }
  return { enviadas, errores }
}
