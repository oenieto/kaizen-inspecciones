"use client"

import { sincronizarInspeccion } from "@/app/campo/actions"
import { capturasDb, type CapturaLocal } from "./db"
import { estaEnLinea } from "./red"

/** Envía una captura al servidor. Si sale bien la borra de IndexedDB. */
export async function enviarCaptura(c: CapturaLocal, finalizar: boolean) {
  const r = await sincronizarInspeccion(c.inspeccionId, {
    respuestas: c.respuestas,
    observaciones: c.observaciones,
    fotos: c.fotos.map(({ nombre, dataUrl, lat, lng, tomadaEn, hash }) => ({ nombre, dataUrl, lat, lng, tomadaEn, hash })),
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
