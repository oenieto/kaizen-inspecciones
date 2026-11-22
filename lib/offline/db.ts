"use client"

import Dexie, { type EntityTable } from "dexie"
import type { RespuestaChecklist } from "@/lib/types"

/**
 * Base local de la PWA (IndexedDB vía Dexie). Cada inspección capturada en
 * campo vive aquí hasta que se sincroniza con el servidor.
 */
export interface FotoLocal {
  id: string
  nombre: string
  dataUrl: string
  lat: number | null
  lng: number | null
  tomadaEn: string
  hash: string
}

export interface CapturaLocal {
  inspeccionId: string
  respuestas: RespuestaChecklist[]
  observaciones: string
  fotos: FotoLocal[]
  firmaCliente: string | null
  firmaInspector: string | null
  nombreFirmaCliente: string
  /** borrador: se sigue editando · pendiente: finalizada, espera señal */
  estado: "borrador" | "pendiente"
  actualizadaEn: string
}

const db = new Dexie("uv-campo") as Dexie & { capturas: EntityTable<CapturaLocal, "inspeccionId"> }
db.version(1).stores({ capturas: "inspeccionId, estado" })

export const capturasDb = db.capturas
