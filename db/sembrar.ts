import { existsSync } from "node:fs"
import { readFile } from "node:fs/promises"
import path from "node:path"
import type { SupabaseClient } from "@supabase/supabase-js"
import { getRama } from "@/config/ramas"
import type { Database, Json } from "@/lib/supabase/database.types"
import { createSeed } from "./seed"

type Admin = SupabaseClient<Database>

/** Plantillas por defecto incluidas en el repo; la del cliente se sube encima a Storage. */
const PLANTILLAS_DEFECTO: Partial<Record<"acta" | "dictamen", string>> = {
  dictamen: path.join(process.cwd(), "templates", "dictamen.docx"),
}

function ok<T>(r: { data: T; error: { message: string } | null }, paso: string): NonNullable<T> {
  if (r.error) throw new Error(`${paso}: ${r.error.message}`)
  return r.data as NonNullable<T>
}

const json = (v: unknown) => v as NonNullable<Json>

/** Borra todos los objetos de un tenant en un bucket ({tenant}/{subcarpeta}/{archivo}). */
async function vaciarCarpeta(admin: Admin, bucket: string, prefijo: string) {
  const { data: entradas } = await admin.storage.from(bucket).list(prefijo, { limit: 1000 })
  const archivos: string[] = []
  for (const e of entradas ?? []) {
    if (e.id) archivos.push(`${prefijo}/${e.name}`)
    else {
      const { data } = await admin.storage.from(bucket).list(`${prefijo}/${e.name}`, { limit: 1000 })
      archivos.push(...(data ?? []).map((f) => `${prefijo}/${e.name}/${f.name}`))
    }
  }
  if (archivos.length) ok(await admin.storage.from(bucket).remove(archivos), `vaciar ${bucket}`)
}

/**
 * Carga los datos de demo de db/seed.ts en Supabase (service_role).
 * Idempotente: conserva el tenant y las cuentas (actualiza la contraseña) y
 * reemplaza todos los datos operativos. Las fechas son relativas a `ahora`.
 */
export async function sembrar(admin: Admin, { password, ahora = new Date() }: { password: string; ahora?: Date }) {
  const s = createSeed(ahora)
  const rama = getRama(s.tenant.rama)
  const ids = new Map<string, string>()
  const id = (seedId: string) => {
    let v = ids.get(seedId)
    if (!v) ids.set(seedId, (v = crypto.randomUUID()))
    return v
  }

  const t = s.tenant
  const tenant = ok(
    await admin
      .from("tenants")
      .upsert(
        {
          slug: t.slug,
          razon_social: t.razonSocial,
          nombre_corto: t.nombreCorto,
          acreditacion_ema: t.acreditacionEma,
          acreditacion_desde: t.acreditacionDesde,
          rama: t.rama,
          ciudad: t.ciudad,
          sitio_web: t.sitioWeb,
          logo_url: t.logoUrl,
          color_primario: t.colorPrimario,
          serie_folio: t.serieFolio,
          vigencia_dictamen_meses: rama.vigenciaDictamenMeses,
        },
        { onConflict: "slug" },
      )
      .select()
      .single(),
    "tenant",
  )
  ids.set(t.id, tenant.id)

  // Cuentas de Supabase Auth: se crean o se les restablece la contraseña
  const existentes = new Map<string, string>()
  for (let page = 1; ; page++) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage: 1000 })
    if (error) throw new Error(`listar cuentas: ${error.message}`)
    const { users } = data
    for (const u of users) if (u.email) existentes.set(u.email.toLowerCase(), u.id)
    if (users.length < 1000) break
  }
  for (const u of s.usuarios) {
    let uid = existentes.get(u.email)
    const r = uid
      ? await admin.auth.admin.updateUserById(uid, { password, email_confirm: true })
      : await admin.auth.admin.createUser({ email: u.email, password, email_confirm: true })
    if (r.error || !r.data.user) throw new Error(`cuenta ${u.email}: ${r.error?.message}`)
    uid = r.data.user.id
    ids.set(u.id, uid)
  }
  ok(
    await admin.from("usuarios").upsert(
      s.usuarios.map((u) => ({
        id: id(u.id),
        tenant_id: tenant.id,
        nombre: u.nombre,
        email: u.email,
        rol: u.rol,
        iniciales: u.iniciales,
        competencias: json(u.competencias),
        activo: true,
      })),
    ),
    "usuarios",
  )

  // Datos operativos desde cero
  ok(await admin.rpc("purgar_datos_tenant", { p_tenant: tenant.id }), "purga")
  await vaciarCarpeta(admin, "evidencias", tenant.id)

  ok(
    await admin.from("normas").insert(
      s.normas.map((n) => ({ id: id(n.id), tenant_id: tenant.id, clave: n.clave, titulo: n.titulo, rama: n.rama, vigente: n.vigente, nota: n.nota ?? null })),
    ),
    "normas",
  )
  ok(
    await admin.from("checklists").insert(
      s.checklists.map((c) => ({
        id: id(c.id),
        tenant_id: tenant.id,
        norma_id: id(c.normaId),
        version: c.version,
        nombre: c.nombre,
        reactivos: json(c.reactivos),
      })),
    ),
    "checklists",
  )

  for (const [tipo, archivo] of Object.entries(PLANTILLAS_DEFECTO)) {
    if (!existsSync(archivo)) continue
    ok(
      await admin.storage.from("plantillas").upload(`${tenant.id}/${tipo}.docx`, await readFile(archivo), {
        upsert: true,
        contentType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      }),
      `plantilla ${tipo}`,
    )
  }
  ok(
    await admin.from("plantillas").insert(
      s.plantillas.map((p) => ({
        id: id(p.id),
        tenant_id: tenant.id,
        tipo: p.tipo,
        nombre: p.nombre,
        archivo: `${tenant.id}/${p.tipo}.docx`,
        campos: p.campos,
        actualizada_en: p.actualizadaEn,
      })),
    ),
    "plantillas",
  )

  ok(
    await admin.from("clientes").insert(
      s.clientes.map((c) => ({
        id: id(c.id),
        tenant_id: tenant.id,
        rfc: c.rfc,
        razon_social: c.razonSocial,
        giro: c.giro,
        contacto: c.contacto,
        telefono: c.telefono,
        email: c.email,
        creado_en: c.creadoEn,
      })),
    ),
    "clientes",
  )
  ok(
    await admin.from("instalaciones").insert(
      s.instalaciones.map((i) => ({
        id: id(i.id),
        tenant_id: tenant.id,
        cliente_id: id(i.clienteId),
        nombre: i.nombre,
        tipo: i.tipo,
        direccion: i.direccion,
        municipio: i.municipio,
        lat: i.lat,
        lng: i.lng,
        permiso: i.permiso,
        vencimiento: i.vencimiento,
      })),
    ),
    "instalaciones",
  )
  ok(
    await admin.from("inspecciones").insert(
      s.inspecciones.map((x) => ({
        id: id(x.id),
        tenant_id: tenant.id,
        instalacion_id: id(x.instalacionId),
        norma_id: id(x.normaId),
        checklist_id: id(x.checklistId),
        inspector_id: id(x.inspectorId),
        fecha: x.fecha,
        duracion_min: x.duracionMin,
        estatus: x.estatus,
        version: x.version,
        respuestas: json(x.respuestas),
        observaciones: x.observaciones,
        iniciada_en: x.iniciadaEn,
        sincronizada_en: x.sincronizadaEn,
        enviada_revision_en: x.enviadaRevisionEn,
      })),
    ),
    "inspecciones",
  )
  ok(
    await admin.from("evidencias").insert(
      s.evidencias.map((e) => ({
        id: id(e.id),
        tenant_id: tenant.id,
        inspeccion_id: id(e.inspeccionId),
        tipo: e.tipo,
        nombre: e.nombre,
        url: e.url,
        lat: e.lat,
        lng: e.lng,
        tomada_en: e.tomadaEn,
        hash: e.hash,
      })),
    ),
    "evidencias",
  )
  ok(
    await admin.from("actas").insert(
      s.actas.map((a) => ({
        id: id(a.id),
        tenant_id: tenant.id,
        inspeccion_id: id(a.inspeccionId),
        version: a.version,
        firma_cliente: a.firmaCliente,
        firma_inspector: a.firmaInspector,
        nombre_firma_cliente: a.nombreFirmaCliente,
        generada_en: a.generadaEn,
      })),
    ),
    "actas",
  )
  ok(
    await admin.from("dictamenes").insert(
      s.dictamenes.map((d) => ({
        id: id(d.id),
        tenant_id: tenant.id,
        inspeccion_id: id(d.inspeccionId),
        folio: d.folio,
        resultado: d.resultado,
        token_qr: d.tokenQr,
        aprobado_por: id(d.aprobadoPor),
        emitido_en: d.emitidoEn,
        vigente_hasta: d.vigenteHasta,
      })),
    ),
    "dictamenes",
  )
  ok(
    await admin
      .from("folios")
      .insert(Object.entries(s.folios).map(([anio, ultimo]) => ({ tenant_id: tenant.id, anio: Number(anio), ultimo }))),
    "folios",
  )
  ok(
    await admin.from("bitacora").insert(
      s.bitacora.map((b) => ({
        tenant_id: tenant.id,
        entidad: b.entidad,
        entidad_id: id(b.entidadId),
        accion: b.accion,
        descripcion: b.descripcion,
        usuario_id: id(b.usuarioId),
        timestamp: b.timestamp,
      })),
    ),
    "bitácora",
  )

  return {
    tenant: tenant.slug,
    usuarios: s.usuarios.length,
    clientes: s.clientes.length,
    instalaciones: s.instalaciones.length,
    inspecciones: s.inspecciones.length,
    dictamenes: s.dictamenes.length,
  }
}
