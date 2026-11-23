import "server-only"
import { after } from "next/server"

export type Evento = "cita.programada" | "inspeccion.en_revision" | "dictamen.emitido"

/**
 * Avisa a n8n (correo al cliente, WhatsApp, etc.) después de responder al
 * usuario: nunca bloquea ni hace fallar la acción. Sin N8N_WEBHOOK_URL no hace nada.
 */
export function notificar(evento: Evento, datos: Record<string, unknown>) {
  const url = process.env.N8N_WEBHOOK_URL
  if (!url) return
  after(async () => {
    try {
      const r = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(process.env.N8N_WEBHOOK_SECRET ? { "X-Webhook-Secret": process.env.N8N_WEBHOOK_SECRET } : {}),
        },
        body: JSON.stringify({ evento, ...datos, ocurridoEn: new Date().toISOString() }),
        signal: AbortSignal.timeout(10_000),
      })
      if (!r.ok) console.error(`[n8n] ${evento}: HTTP ${r.status}`)
    } catch (e) {
      console.error(`[n8n] ${evento}:`, e instanceof Error ? e.message : e)
    }
  })
}
