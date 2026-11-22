import type { InspeccionDetalle, Reactivo } from "@/lib/types"

/**
 * «Semáforo de completitud» del expediente antes de dictaminar.
 * En la demo son reglas deterministas; en productivo esta función llama al
 * LLM (lib/ia) con salida estructurada y conserva la misma forma de retorno.
 * Nunca dictamina: solo señala faltantes. Aprueba un humano.
 */
export interface ResultadoCompletitud {
  puntaje: number
  nivel: "verde" | "amarillo" | "rojo"
  hallazgos: { ok: boolean; texto: string }[]
}

export function evaluarCompletitud(x: InspeccionDetalle): ResultadoCompletitud {
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

/** Sugerencia de redacción de una no conformidad (en productivo: LLM). */
export function sugerirRedaccionNC(r: Reactivo, observacion?: string) {
  const base = `No conformidad en ${r.numeral} (${r.seccion}): ${r.texto.charAt(0).toLowerCase()}${r.texto.slice(1)} no se cumple`
  return `${base}${observacion ? `; ${observacion.replace(/\.$/, "")}` : ""}. Se requiere corrección y evidencia antes de emitir dictamen favorable.`
}
