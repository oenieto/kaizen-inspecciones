import type { RespuestaChecklist } from "@/lib/types"
import type { FotoLocal } from "./db"

/**
 * Reglas puras de la captura de campo. Sin React ni IndexedDB para que se
 * prueben solas (captura.test.ts) y las use tanto la PWA como el servidor.
 */

/** Máximo de fotos por inspección; el servidor rechaza capturas con más. */
export const MAX_FOTOS = 20

/** Devuelve las respuestas con el cambio aplicado a un reactivo, sin mutar las previas. */
export function aplicarRespuesta(
  respuestas: readonly RespuestaChecklist[],
  reactivoId: string,
  cambio: Partial<RespuestaChecklist>,
): RespuestaChecklist[] {
  const existe = respuestas.some((r) => r.reactivoId === reactivoId)
  return existe
    ? respuestas.map((r) => (r.reactivoId === reactivoId ? { ...r, ...cambio } : r))
    : [...respuestas, { reactivoId, valor: null, ...cambio }]
}

/** Agrega fotos respetando MAX_FOTOS; informa cuántas no cupieron. */
export function agregarFotos(
  actuales: readonly FotoLocal[],
  nuevas: readonly FotoLocal[],
  max: number = MAX_FOTOS,
): { fotos: FotoLocal[]; descartadas: number } {
  const espacio = Math.max(0, max - actuales.length)
  const aceptadas = nuevas.slice(0, espacio)
  return { fotos: [...actuales, ...aceptadas], descartadas: nuevas.length - aceptadas.length }
}

/** Formato del hash de una evidencia: SHA-256 completo (64 hex) del archivo tal como se sube. */
export const HASH_EVIDENCIA = /^sha256:[0-9a-f]{64}$/

/**
 * Hash de integridad de una evidencia sobre sus bytes (no sobre el dataURL).
 * Usa Web Crypto, presente en el navegador y en Node: la PWA lo calcula al
 * tomar la foto y el servidor lo recalcula sobre el objeto ya guardado en Storage.
 */
export async function hashEvidencia(bytes: ArrayBuffer | Uint8Array): Promise<string> {
  const buf = await crypto.subtle.digest("SHA-256", bytes as BufferSource)
  return `sha256:${[...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, "0")).join("")}`
}

/** Porcentaje de reactivos obligatorios respondidos (100 si no hay obligatorios). */
export function porcentajeAvance(listos: number, total: number): number {
  return total === 0 ? 100 : Math.round((listos / total) * 100)
}
