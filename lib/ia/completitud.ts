import "server-only"
import { cache } from "react"
import { cacheLife } from "next/cache"
import Anthropic from "@anthropic-ai/sdk"
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod"
import { z } from "zod"
import type { InspeccionDetalle, Reactivo } from "@/lib/types"

/**
 * «Semáforo de completitud» del expediente antes de dictaminar.
 * Las reglas deterministas dan el puntaje (hechos objetivos: faltantes,
 * evidencias, acta). Claude agrega inconsistencias que una regla no ve y la
 * redacción formal de cada NC. Nunca dictamina: solo señala. Aprueba un humano.
 */
export interface Hallazgo {
  ok: boolean
  texto: string
  /** Lo señaló el modelo (no una regla) */
  ia?: boolean
}

export interface ResultadoCompletitud {
  puntaje: number
  nivel: "verde" | "amarillo" | "rojo"
  hallazgos: Hallazgo[]
  /** Redacción sugerida por reactivoId (solo NC) */
  redacciones: Record<string, string>
  fuente: "ia" | "reglas"
}

export function evaluarReglas(x: InspeccionDetalle): Omit<ResultadoCompletitud, "redacciones" | "fuente"> {
  const requeridos = x.checklist.reactivos.filter((r) => r.requerido)
  const resp = new Map(x.respuestas.map((r) => [r.reactivoId, r]))
  const sinResponder = requeridos.filter((r) => {
    const a = resp.get(r.id)
    return !a || (r.tipo === "medicion" ? a.medicion == null : a.valor == null)
  })
  const ncSinObs = x.respuestas.filter((r) => r.valor === "no_cumple" && !r.observacion?.trim())
  const fotos = x.evidencias.filter((e) => e.tipo === "foto")
  const fotosSinGeo = fotos.filter((e) => e.lat == null)

  const hallazgos = [
    { ok: sinResponder.length === 0, texto: sinResponder.length === 0 ? "Todos los reactivos obligatorios están respondidos" : `${sinResponder.length} reactivos obligatorios sin respuesta` },
    { ok: ncSinObs.length === 0, texto: ncSinObs.length === 0 ? "Cada no conformidad tiene observación" : `${ncSinObs.length} no conformidades sin observación` },
    { ok: fotos.length > 0, texto: fotos.length > 0 ? `${fotos.length} fotos de evidencia` : "Sin fotos de evidencia" },
    { ok: fotosSinGeo.length === 0, texto: fotosSinGeo.length === 0 ? "Evidencias con geolocalización y hora" : `${fotosSinGeo.length} fotos sin geolocalización` },
    { ok: Boolean(x.acta), texto: x.acta ? "Acta circunstanciada registrada" : "Falta el acta circunstanciada" },
  ]
  const puntaje = Math.round((hallazgos.filter((h) => h.ok).length / hallazgos.length) * 100)
  return { puntaje, nivel: puntaje === 100 ? "verde" : puntaje >= 60 ? "amarillo" : "rojo", hallazgos }
}

/** Redacción por plantilla: respaldo cuando no hay IA. */
export function sugerirRedaccionNC(r: Reactivo, observacion?: string) {
  const base = `No conformidad en ${r.numeral} (${r.seccion}): ${r.texto.charAt(0).toLowerCase()}${r.texto.slice(1)} no se cumple`
  return `${base}${observacion ? `; ${observacion.replace(/\.$/, "")}` : ""}. Se requiere corrección y evidencia antes de emitir dictamen favorable.`
}

/* ---------- Análisis con Claude ---------- */

const SalidaIA = z.object({
  hallazgos: z
    .array(z.object({ texto: z.string().describe("Una frase en español que cite el numeral (R-xx) afectado") }))
    .describe("Inconsistencias que el responsable técnico debe revisar. Lista vacía si no hay."),
  redacciones: z
    .array(z.object({ reactivoId: z.string(), texto: z.string().describe("Redacción formal de la no conformidad, 1 a 2 frases") }))
    .describe("Una entrada por cada reactivo con valor no_cumple"),
})

const SISTEMA = `Eres el revisor de calidad de una Unidad de Inspección acreditada (ISO/IEC 17020) que verifica instalaciones de gas natural en México. Revisas el expediente de una inspección de campo antes de que el responsable técnico emita el dictamen. Tú no dictaminas ni decides si la instalación cumple: solo ayudas a que el expediente sea consistente.

Devuelve:
1. hallazgos: inconsistencias concretas del expediente que un revisor humano debe atender. Por ejemplo: una medición que contradice su respuesta o es poco plausible para la unidad indicada, una observación que contradice el valor marcado, un reactivo obligatorio marcado N/A sin justificación, o una no conformidad cuya observación no la sustenta. Máximo 5, cada una en una frase que cite el numeral. No repitas lo que ya reportan las reglas automáticas que se te dan. Si no hay inconsistencias, devuelve una lista vacía; no inventes problemas.
2. redacciones: para cada reactivo con valor "no_cumple", la redacción formal de la no conformidad en español, en tercera persona, citando el numeral y apoyada solo en la observación del inspector. No agregues hechos que no estén en el expediente.`

interface EntradaIA {
  norma: string
  reactivos: Pick<Reactivo, "id" | "numeral" | "seccion" | "texto" | "tipo" | "requerido" | "unidad">[]
  respuestas: InspeccionDetalle["respuestas"]
  observacionesGenerales: string
  evidencias: { fotos: number; fotosSinUbicacion: number; documentos: number }
  acta: { registrada: boolean; firmaCliente: boolean; firmaInspector: boolean }
  reglasAutomaticas: string[]
}

/** En caché por contenido: el mismo expediente (mismas respuestas) no se vuelve a analizar. */
async function analizarConIA(entrada: EntradaIA) {
  "use cache"
  cacheLife("weeks")
  const client = new Anthropic({ timeout: 60_000, maxRetries: 1 })
  const respuesta = await client.messages.parse({
    model: process.env.ANTHROPIC_MODEL || "claude-opus-5-5",
    max_tokens: 8000,
    output_config: { effort: "low", format: zodOutputFormat(SalidaIA) },
    system: SISTEMA,
    messages: [{ role: "user", content: `Expediente (JSON):\n${JSON.stringify(entrada)}` }],
  })
  if (respuesta.stop_reason === "refusal") throw new Error("El modelo declinó analizar el expediente")
  if (!respuesta.parsed_output) throw new Error(`Salida sin estructura (stop_reason: ${respuesta.stop_reason})`)
  return respuesta.parsed_output
}

/**
 * Semáforo completo (reglas + IA). Sin ANTHROPIC_API_KEY o si el modelo falla,
 * devuelve solo las reglas con la misma forma. Memoizado por petición.
 */
export const evaluarCompletitud = cache(async (x: InspeccionDetalle): Promise<ResultadoCompletitud> => {
  const reglas = evaluarReglas(x)
  const soloReglas: ResultadoCompletitud = { ...reglas, redacciones: {}, fuente: "reglas" }
  if (!process.env.ANTHROPIC_API_KEY || x.respuestas.length === 0) return soloReglas

  const fotos = x.evidencias.filter((e) => e.tipo === "foto")
  try {
    const ia = await analizarConIA({
      norma: `${x.norma.clave} — ${x.norma.titulo}`,
      reactivos: x.checklist.reactivos.map(({ id, numeral, seccion, texto, tipo, requerido, unidad }) => ({ id, numeral, seccion, texto, tipo, requerido, unidad })),
      respuestas: x.respuestas,
      observacionesGenerales: x.observaciones,
      evidencias: { fotos: fotos.length, fotosSinUbicacion: fotos.filter((e) => e.lat == null).length, documentos: x.evidencias.length - fotos.length },
      acta: { registrada: Boolean(x.acta), firmaCliente: Boolean(x.acta?.firmaCliente), firmaInspector: Boolean(x.acta?.firmaInspector) },
      reglasAutomaticas: reglas.hallazgos.map((h) => h.texto),
    })
    const nc = new Set(x.respuestas.filter((r) => r.valor === "no_cumple").map((r) => r.reactivoId))
    const redacciones = Object.fromEntries(ia.redacciones.filter((r) => nc.has(r.reactivoId)).map((r) => [r.reactivoId, r.texto]))
    const alertas = ia.hallazgos.slice(0, 5).map((h) => ({ ok: false, texto: h.texto, ia: true }))
    return {
      puntaje: reglas.puntaje,
      // La IA no mejora el semáforo, pero sí lo baja de verde si encontró algo
      nivel: reglas.nivel === "verde" && alertas.length > 0 ? "amarillo" : reglas.nivel,
      hallazgos: [...reglas.hallazgos, ...alertas],
      redacciones,
      fuente: "ia",
    }
  } catch (e) {
    console.error("[ia] completitud:", e instanceof Error ? e.message : e)
    return soloReglas
  }
})
