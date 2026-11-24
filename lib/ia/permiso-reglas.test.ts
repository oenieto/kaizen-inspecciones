import assert from "node:assert/strict"
import { describe, test } from "node:test"
import { normalizarLectura, sugerenciaInstalacion, type LecturaPermiso } from "./permiso-reglas.ts"

/**
 * Reglas sobre la lectura del permiso con IA. Sin red ni modelo:
 *   pnpm test
 */

const lectura = (cambios: Partial<LecturaPermiso> = {}): LecturaPermiso => ({
  legible: true,
  tipoDocumento: "Permiso de distribución",
  permiso: "G/00123/DIS/2024",
  titular: "Autopartes del Bajío, S.A. de C.V.",
  rfc: "ABA150312KJ8",
  nombre: "Planta El Marqués",
  tipo: "Industrial",
  direccion: "Av. de la Montaña 112, Parque Industrial Bernardo Quintana",
  municipio: "El Marqués",
  vigencia: "2027-03-31",
  observaciones: "",
  ...cambios,
})

describe("normalizarLectura", () => {
  test("una lectura correcta pasa igual", () => {
    assert.deepEqual(normalizarLectura(lectura()), lectura())
  })

  test("limpia espacios y guiones del RFC sin cambiarlo", () => {
    assert.equal(normalizarLectura(lectura({ rfc: "aba-150312 kj8" })).rfc, "ABA150312KJ8")
  })

  test("un RFC con formato inválido se vacía y se avisa, no se corrige", () => {
    const l = normalizarLectura(lectura({ rfc: "ABA15031" }))
    assert.equal(l.rfc, null)
    assert.match(l.observaciones, /RFC leído \(«ABA15031»\)/)
  })

  test("una vigencia que no es fecha YYYY-MM-DD se vacía y se avisa", () => {
    for (const v of ["31/03/2027", "2027-02-30x", "marzo 2027"]) {
      const l = normalizarLectura(lectura({ vigencia: v }))
      assert.equal(l.vigencia, null, v)
      assert.match(l.observaciones, /vigencia leída/)
    }
  })

  test("conserva las observaciones del modelo y les suma los avisos", () => {
    const l = normalizarLectura(lectura({ rfc: "X", observaciones: "Sello ilegible" }))
    assert.equal(l.observaciones, "Sello ilegible. El RFC leído («X») no tiene formato válido")
  })

  test("cadenas vacías cuentan como dato ausente", () => {
    const l = normalizarLectura(lectura({ municipio: "  ", permiso: "" }))
    assert.equal(l.municipio, null)
    assert.equal(l.permiso, null)
  })
})

describe("sugerenciaInstalacion", () => {
  const hoy = new Date("2026-11-23T12:00:00Z")

  test("los campos usan las llaves del formulario de instalación", () => {
    const s = sugerenciaInstalacion(lectura(), { hoy })
    assert.deepEqual(Object.keys(s.campos).sort(), ["direccion", "municipio", "nombre", "permiso", "permisoVigencia", "tipo"])
    assert.equal(s.campos.permisoVigencia, "2027-03-31")
    assert.deepEqual(s.avisos, [])
  })

  test("avisa si el permiso es de otro RFC que el del cliente", () => {
    const s = sugerenciaInstalacion(lectura(), { rfcCliente: "otr010101aa1", hoy })
    assert.match(s.avisos[0], /otro RFC \(ABA150312KJ8\); el cliente tiene OTR010101AA1/)
  })

  test("avisa si el permiso ya venció", () => {
    const s = sugerenciaInstalacion(lectura({ vigencia: "2025-01-15" }), { hoy })
    assert.ok(s.avisos.includes("El permiso venció el 2025-01-15"))
  })

  test("un archivo ilegible lo dice primero", () => {
    const s = sugerenciaInstalacion(lectura({ legible: false, observaciones: "Imagen borrosa" }), { hoy })
    assert.match(s.avisos[0], /no parece un permiso legible/)
    assert.equal(s.avisos[1], "Imagen borrosa")
  })
})
