import assert from "node:assert/strict"
import { describe, test } from "node:test"
import type { RespuestaChecklist } from "../types.ts"
import type { FotoLocal } from "./db.ts"
import { HASH_EVIDENCIA, MAX_FOTOS, agregarFotos, aplicarRespuesta, hashEvidencia, porcentajeAvance } from "./captura.ts"

/**
 * Lógica pura de la captura de campo (PWA). Corre sin dependencias:
 *   pnpm test
 */

const foto = (id: string): FotoLocal => ({
  id,
  nombre: `${id}.jpg`,
  dataUrl: "data:image/jpeg;base64,AA==",
  lat: null,
  lng: null,
  tomadaEn: "2026-11-22T08:00:00.000Z",
  hash: `sha256:${id}`,
})

describe("aplicarRespuesta", () => {
  test("agrega la respuesta de un reactivo que aún no tenía", () => {
    const r = aplicarRespuesta([], "R-01", { valor: "cumple" })
    assert.deepEqual(r, [{ reactivoId: "R-01", valor: "cumple" }])
  })

  test("actualiza solo el reactivo indicado y conserva sus otros campos", () => {
    const previas: RespuestaChecklist[] = [
      { reactivoId: "R-01", valor: "no_cumple", observacion: "Sin memoria técnica" },
      { reactivoId: "R-02", valor: "cumple" },
    ]
    const r = aplicarRespuesta(previas, "R-01", { valor: "cumple" })
    assert.deepEqual(r, [
      { reactivoId: "R-01", valor: "cumple", observacion: "Sin memoria técnica" },
      { reactivoId: "R-02", valor: "cumple" },
    ])
  })

  test("no muta el arreglo ni los objetos recibidos", () => {
    const previas: RespuestaChecklist[] = [{ reactivoId: "R-01", valor: null }]
    const copia = structuredClone(previas)
    aplicarRespuesta(previas, "R-01", { valor: "na" })
    aplicarRespuesta(previas, "R-02", { valor: "cumple" })
    assert.deepEqual(previas, copia)
  })

  test("toques seguidos encadenados sobre el estado previo no se pierden", () => {
    // Reproduce el bug: varios toques antes de re-renderizar deben acumularse
    const ids = ["R-01", "R-02", "R-03", "R-04"]
    const r = ids.reduce<RespuestaChecklist[]>((acc, id) => aplicarRespuesta(acc, id, { valor: "cumple" }), [])
    assert.equal(r.length, 4)
    assert.ok(r.every((x) => x.valor === "cumple"))
  })
})

describe("agregarFotos", () => {
  test("agrega las nuevas al final sin descartar si cabe en el límite", () => {
    const r = agregarFotos([foto("a")], [foto("b"), foto("c")])
    assert.deepEqual(r.fotos.map((f) => f.id), ["a", "b", "c"])
    assert.equal(r.descartadas, 0)
  })

  test("recorta al límite que acepta el servidor e informa cuántas descartó", () => {
    const actuales = Array.from({ length: MAX_FOTOS - 1 }, (_, i) => foto(`f${i}`))
    const r = agregarFotos(actuales, [foto("x"), foto("y"), foto("z")])
    assert.equal(r.fotos.length, MAX_FOTOS)
    assert.equal(r.fotos.at(-1)?.id, "x")
    assert.equal(r.descartadas, 2)
  })

  test("no muta el arreglo de fotos actual", () => {
    const actuales = [foto("a")]
    agregarFotos(actuales, [foto("b")])
    assert.deepEqual(actuales.map((f) => f.id), ["a"])
  })
})

describe("hashEvidencia", () => {
  test("es el SHA-256 completo de los bytes", async () => {
    // Vector conocido: SHA-256("abc")
    const h = await hashEvidencia(new TextEncoder().encode("abc"))
    assert.equal(h, "sha256:ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad")
    assert.match(h, HASH_EVIDENCIA)
  })

  test("cambia si cambia un solo byte", async () => {
    const a = await hashEvidencia(new Uint8Array([0xff, 0xd8, 0x00]))
    const b = await hashEvidencia(new Uint8Array([0xff, 0xd8, 0x01]))
    assert.notEqual(a, b)
  })
})

describe("porcentajeAvance", () => {
  test("calcula el porcentaje redondeado", () => {
    assert.equal(porcentajeAvance(1, 3), 33)
    assert.equal(porcentajeAvance(20, 20), 100)
  })

  test("un checklist sin reactivos obligatorios cuenta como completo, no NaN", () => {
    assert.equal(porcentajeAvance(0, 0), 100)
  })
})
