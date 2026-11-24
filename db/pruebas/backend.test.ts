import assert from "node:assert/strict"
import { after, before, describe, test } from "node:test"
import { createClient, type SupabaseClient } from "@supabase/supabase-js"
import type { Database } from "@/lib/supabase/database.types"

/**
 * Pruebas de integración del backend contra el Supabase LOCAL ya sembrado:
 *   supabase start && pnpm db:reset && pnpm test:db
 * Modifican datos del tenant de demo; al terminar conviene volver a correr `pnpm seed`.
 */

const url = process.env.NEXT_PUBLIC_SUPABASE_URL!
const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
const service = process.env.SUPABASE_SERVICE_ROLE_KEY!
const password = process.env.SEED_PASSWORD!
if (!/^https?:\/\/(127\.0\.0\.1|localhost)/.test(url)) throw new Error("Estas pruebas solo corren contra Supabase local")

type Cliente = SupabaseClient<Database>
const opciones = { auth: { persistSession: false, autoRefreshToken: false } }
const admin: Cliente = createClient<Database>(url, service, opciones)

async function sesion(email: string) {
  const c = createClient<Database>(url, anon, opciones)
  const { error } = await c.auth.signInWithPassword({ email, password })
  assert.ifError(error)
  return c
}

const jpeg = () => new Blob([new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0xff, 0xd9])], { type: "image/jpeg" })

let adminUv: Cliente, coord: Cliente, resp: Cliente, insp: Cliente, insp2: Cliente
let tenantUv: string
let inspectorId: string

// Segundo tenant para probar aislamiento
const OTRO = { slug: "prueba-aislamiento", email: "admin@otro-tenant.test" }
let otroTenantId: string
let otroUsuarioId: string

before(async () => {
  ;[adminUv, coord, resp, insp, insp2] = await Promise.all(
    ["admin@demo.uv", "coordinacion@demo.uv", "responsable@demo.uv", "cruiz@demo.uv", "atorres@demo.uv"].map(sesion),
  )
  const { data: yo } = await insp.auth.getUser()
  inspectorId = yo.user!.id
  tenantUv = (await admin.from("tenants").select("id").eq("slug", "uv-energia").single()).data!.id

  const t = await admin
    .from("tenants")
    .insert({ slug: OTRO.slug, razon_social: "Otra UI, S.A.", nombre_corto: "Otra", acreditacion_ema: "X 1", acreditacion_desde: "2024-01-01", rama: "gas-natural", serie_folio: "OTRA" })
    .select()
    .single()
  assert.ifError(t.error)
  otroTenantId = t.data.id
  const u = await admin.auth.admin.createUser({ email: OTRO.email, password, email_confirm: true })
  assert.ifError(u.error)
  otroUsuarioId = u.data.user!.id
  assert.ifError(
    (await admin.from("usuarios").insert({ id: otroUsuarioId, tenant_id: otroTenantId, nombre: "Admin Otro", email: OTRO.email, rol: "admin", iniciales: "AO" })).error,
  )
})

after(async () => {
  await admin.rpc("purgar_datos_tenant", { p_tenant: otroTenantId })
  await admin.from("tenants").delete().eq("id", otroTenantId)
  await admin.auth.admin.deleteUser(otroUsuarioId)
})

describe("aislamiento y permisos (RLS)", () => {
  test("anon no lee tablas", async () => {
    const c = createClient<Database>(url, anon, opciones)
    const r = await c.from("clientes").select("id")
    assert.ok(r.error || r.data!.length === 0)
  })

  test("otro tenant no ve ni referencia datos de UV Energía", async () => {
    const otro = await sesion(OTRO.email)
    assert.equal((await otro.from("clientes").select("id")).data!.length, 0)
    assert.equal((await otro.from("inspecciones").select("id")).data!.length, 0)
    const { data: inst } = await coord.from("instalaciones").select("id").limit(1).single()
    const r = await otro.from("inspecciones").insert({
      instalacion_id: inst!.id,
      inspector_id: otroUsuarioId,
      fecha: new Date().toISOString(),
      duracion_min: 60,
      norma_id: inst!.id,
      checklist_id: inst!.id,
    })
    assert.equal(r.error?.code, "42501")
  })

  test("el inspector solo ve sus inspecciones y no ve la bitácora", async () => {
    const { data } = await insp.from("inspecciones").select("inspector_id")
    assert.ok(data!.length > 0)
    assert.ok(data!.every((x) => x.inspector_id === inspectorId))
    assert.equal((await insp.from("bitacora").select("id")).data!.length, 0)
  })

  test("el inspector no da de alta clientes", async () => {
    const r = await insp.from("clientes").insert({ rfc: "XXX010101AAA", razon_social: "No", giro: "Hotel", contacto: "a", telefono: "1234567", email: "a@b.mx" })
    assert.equal(r.error?.code, "42501")
  })

  test("nadie escribe la bitácora directo", async () => {
    const r = await adminUv.from("bitacora").insert({ tenant_id: tenantUv, entidad: "x", entidad_id: tenantUv, accion: "crear", descripcion: "falsa" })
    assert.ok(r.error)
  })

  test("branding: solo admin y solo columnas permitidas", async () => {
    const coordUpd = await coord.from("tenants").update({ nombre_corto: "Hack" }).eq("id", tenantUv).select()
    assert.equal(coordUpd.data?.length ?? 0, 0)
    const folio = await adminUv.from("tenants").update({ serie_folio: "HACK" }).eq("id", tenantUv)
    assert.equal(folio.error?.code, "42501")
    const ok = await adminUv.from("tenants").update({ nombre_corto: "UV Energía" }).eq("id", tenantUv).select().single()
    assert.ifError(ok.error)
    const b = await adminUv.from("bitacora").select("descripcion").eq("entidad_id", tenantUv)
    assert.ok(b.data!.some((x) => x.descripcion === "Branding actualizado"))
  })

  test("el coordinador no aprueba dictámenes", async () => {
    const { data } = await coord.from("inspecciones").select("id").eq("estatus", "en_revision").limit(1).single()
    const r = await coord.rpc("aprobar_y_emitir", { p_id: data!.id })
    assert.equal(r.error?.message, "No tienes permiso para esta acción")
  })
})

describe("agenda", () => {
  test("alta de cliente escribe bitácora con el usuario", async () => {
    const c = await coord
      .from("clientes")
      .insert({ rfc: "PRU010101AB1", razon_social: "Cliente Prueba Demo", giro: "Hotel", contacto: "Ana", telefono: "4421234567", email: "ana@prueba.mx" })
      .select()
      .single()
    assert.ifError(c.error)
    const { data: yo } = await coord.auth.getUser()
    const b = await coord.from("bitacora").select("*").eq("entidad_id", c.data.id).single()
    assert.equal(b.data!.descripcion, "Alta de cliente Cliente Prueba Demo")
    assert.equal(b.data!.usuario_id, yo.user!.id)
    const dup = await coord.from("clientes").insert({ rfc: "PRU010101AB1", razon_social: "Dup", giro: "Hotel", contacto: "a", telefono: "1234567", email: "a@b.mx" })
    assert.equal(dup.error?.code, "23505")
  })

  test("solo se reprograman citas programadas", async () => {
    const { data } = await coord.from("inspecciones").select("id").eq("estatus", "dictaminada").limit(1).single()
    const r = await coord.rpc("reprogramar_inspeccion", { p_id: data!.id, p_fecha: new Date().toISOString() })
    assert.equal(r.error?.message, "Solo se reprograman citas programadas")
  })
})

describe("campo → revisión → dictamen", () => {
  let inspeccionId: string
  let ruta: string

  test("el inspector sube evidencia con URL firmada y sincroniza sin duplicar", async () => {
    const { data } = await insp.from("inspecciones").select("id, tenant_id").eq("estatus", "programada").limit(1).single()
    inspeccionId = data!.id
    ruta = `${data!.tenant_id}/${inspeccionId}/${crypto.randomUUID()}.jpg`

    const firmada = await insp.storage.from("evidencias").createSignedUploadUrl(ruta)
    assert.ifError(firmada.error)
    assert.ifError((await insp.storage.from("evidencias").uploadToSignedUrl(ruta, firmada.data.token, jpeg(), { contentType: "image/jpeg" })).error)

    const { data: k } = await insp.from("inspecciones").select("checklist:checklists(reactivos)").eq("id", inspeccionId).single()
    const reactivos = k!.checklist.reactivos as { id: string; tipo: string }[]
    const respuestas = reactivos.map((r) =>
      r.tipo === "medicion" ? { reactivoId: r.id, valor: "cumple", medicion: 2.5 } : r.id === "r10" ? { reactivoId: r.id, valor: "no_cumple", observacion: "Corrosión en soportes" } : { reactivoId: r.id, valor: "cumple" },
    )
    const captura = (finalizar: boolean) => ({
      respuestas,
      observaciones: "Prueba",
      evidencias: [{ tipo: "foto", nombre: "medidor.jpg", ruta, lat: 20.6, lng: -100.4, tomadaEn: new Date().toISOString(), hash: "sha256:prueba" }],
      firmaCliente: "data:image/png;base64,AAAA",
      firmaInspector: "data:image/png;base64,BBBB",
      nombreFirmaCliente: "Cliente",
      finalizar,
    })
    const avance = await insp.rpc("sincronizar_captura", { p_id: inspeccionId, p_captura: captura(false) })
    assert.ifError(avance.error)
    assert.deepEqual(avance.data, { estatus: "en_curso", evidenciasNuevas: 1 })
    const final = await insp.rpc("sincronizar_captura", { p_id: inspeccionId, p_captura: captura(true) })
    assert.ifError(final.error)
    assert.deepEqual(final.data, { estatus: "en_revision", evidenciasNuevas: 0 })

    const ev = await resp.from("evidencias").select("id").eq("inspeccion_id", inspeccionId)
    assert.equal(ev.data!.length, 1)
    const acta = await resp.from("actas").select("version").eq("inspeccion_id", inspeccionId).single()
    assert.equal(acta.data!.version, 2)
    const firmadas = await resp.storage.from("evidencias").createSignedUrls([ruta], 60)
    assert.ok(firmadas.data![0].signedUrl)
  })

  test("ya en revisión no admite captura", async () => {
    const r = await insp.rpc("sincronizar_captura", { p_id: inspeccionId, p_captura: { respuestas: [], finalizar: false } })
    assert.equal(r.error?.message, "La inspección ya no admite captura de campo")
  })

  test("reintento del envío final con la misma llave: mismo resultado, sin duplicar", async () => {
    const { data } = await insp.from("inspecciones").select("id").eq("estatus", "programada").limit(1).single()
    const envioId = crypto.randomUUID()
    const captura = { respuestas: [], observaciones: "Reintento", finalizar: true, envioId }
    const primero = await insp.rpc("sincronizar_captura", { p_id: data!.id, p_captura: captura })
    assert.ifError(primero.error)
    assert.deepEqual(primero.data, { estatus: "en_revision", evidenciasNuevas: 0 })
    // La respuesta «se perdió»: la PWA reintenta con la misma llave
    const segundo = await insp.rpc("sincronizar_captura", { p_id: data!.id, p_captura: captura })
    assert.ifError(segundo.error)
    assert.deepEqual(segundo.data, { estatus: "en_revision", evidenciasNuevas: 0, repetido: true })
    const b = await resp.from("bitacora").select("accion").eq("entidad_id", data!.id).eq("accion", "sincronizar")
    assert.equal(b.data!.length, 1)
    // Una llave nueva sí respeta la regla de estatus
    const otra = await insp.rpc("sincronizar_captura", { p_id: data!.id, p_captura: { ...captura, envioId: crypto.randomUUID() } })
    assert.equal(otra.error?.message, "La inspección ya no admite captura de campo")
  })

  test("una llave de envío no sirve para otra inspección", async () => {
    const { data } = await insp.from("inspecciones").select("id").eq("estatus", "programada").limit(2)
    const envioId = crypto.randomUUID()
    assert.ifError((await insp.rpc("sincronizar_captura", { p_id: data![0].id, p_captura: { respuestas: [], finalizar: false, envioId } })).error)
    const r = await insp.rpc("sincronizar_captura", { p_id: data![1].id, p_captura: { respuestas: [], finalizar: false, envioId } })
    assert.equal(r.error?.message, "Llave de envío inválida")
  })

  test("rechaza evidencias que no están en Storage", async () => {
    const { data } = await insp.from("inspecciones").select("id, tenant_id").eq("estatus", "programada").limit(1).single()
    const r = await insp.rpc("sincronizar_captura", {
      p_id: data!.id,
      p_captura: { respuestas: [], finalizar: false, evidencias: [{ nombre: "fantasma.jpg", ruta: `${data!.tenant_id}/${data!.id}/no-existe.jpg`, tomadaEn: new Date().toISOString(), hash: "x" }] },
    })
    assert.equal(r.error?.message, "La evidencia «fantasma.jpg» no se ha subido")
  })

  test("otro inspector no sube ni captura en una inspección ajena", async () => {
    const { data: tid } = await insp.from("inspecciones").select("tenant_id").eq("id", inspeccionId).single()
    const { data: ajena } = await insp.from("inspecciones").select("id").eq("estatus", "programada").limit(1).single()
    const subida = await insp2.storage.from("evidencias").createSignedUploadUrl(`${tid!.tenant_id}/${ajena!.id}/${crypto.randomUUID()}.jpg`)
    assert.ok(subida.error)
    const r = await insp2.rpc("sincronizar_captura", { p_id: ajena!.id, p_captura: { respuestas: [], finalizar: false } })
    assert.equal(r.error?.message, "La inspección está asignada a otro inspector")
  })

  test("aprobaciones simultáneas: folios consecutivos sin huecos", async () => {
    const { data: antes } = await admin.from("folios").select("ultimo").eq("tenant_id", tenantUv).eq("anio", new Date().getFullYear()).maybeSingle()
    const { data: pendientes } = await resp.from("inspecciones").select("id").eq("estatus", "en_revision").neq("id", inspeccionId).limit(3)
    const ids = [inspeccionId, ...pendientes!.map((x) => x.id)]
    const res = await Promise.all(ids.map((id) => resp.rpc("aprobar_y_emitir", { p_id: id })))
    for (const r of res) assert.ifError(r.error)
    const consecutivos = res.map((r) => Number(r.data!.folio.split("-").at(-1))).sort((a, b) => a - b)
    const base = antes?.ultimo ?? 0
    assert.deepEqual(consecutivos, ids.map((_, i) => base + i + 1))

    const nuestro = res[0].data!
    assert.equal(nuestro.resultado, "no_cumple")
    assert.equal(nuestro.vigente_hasta, null)
    const otraVez = await resp.rpc("aprobar_y_emitir", { p_id: inspeccionId })
    assert.equal(otraVez.error?.message, "Solo se aprueban inspecciones en revisión")

    const b = await resp.from("bitacora").select("accion").eq("entidad_id", inspeccionId)
    assert.deepEqual(new Set(b.data!.map((x) => x.accion)), new Set(["crear", "sincronizar", "aprobar", "emitir_dictamen"]))

    const publico = createClient<Database>(url, anon, opciones)
    const v = await publico.rpc("verificar_dictamen", { p_token: nuestro.token_qr })
    assert.ifError(v.error)
    assert.equal((v.data as { folio: string }).folio, nuestro.folio)
    assert.ok(!("rfc" in (v.data as object)))
    assert.equal((await publico.rpc("verificar_dictamen", { p_token: "no-existe" })).data, null)
  })
})

test("dashboard agrega solo lo del tenant", async () => {
  const ahora = new Date()
  const r = await adminUv.rpc("dashboard", {
    p_desde: new Date(ahora.getTime() - 180 * 86_400_000).toISOString(),
    p_hoy_inicio: new Date(ahora.getTime() - 86_400_000).toISOString(),
    p_hoy_fin: ahora.toISOString(),
    p_limite_vencimiento: new Date(ahora.getTime() + 60 * 86_400_000).toISOString(),
  })
  assert.ifError(r.error)
  const d = r.data as { totalClientes: number; porEstatus: Record<string, number> }
  assert.equal(d.totalClientes, 13)
  assert.ok((d.porEstatus.dictaminada ?? 0) >= 61)
})
