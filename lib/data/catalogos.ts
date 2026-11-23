import "server-only"
import { readFile } from "node:fs/promises"
import path from "node:path"
import { getRama } from "@/config/ramas"
import { getSession } from "@/lib/auth"
import { createAdminClient } from "@/lib/supabase/admin"
import { createClient } from "@/lib/supabase/server"
import type { Rol, Tenant } from "@/lib/types"
import { datos } from "./base"
import { mapChecklist, mapNorma, mapPlantilla, mapTenant, mapUsuario, type Fila } from "./mappers"

const tenantSlug = () => process.env.TENANT_SLUG ?? "uv-energia"

/** Tenant de la sesión; sin sesión (login), el de TENANT_SLUG con sus datos públicos. */
export async function getTenant(): Promise<Tenant> {
  const s = await getSession()
  if (s) return s.tenant
  const supabase = await createClient()
  const t = datos(await supabase.rpc("tenant_publico", { p_slug: tenantSlug() }))
  if (!t) throw new Error(`No existe el tenant «${tenantSlug()}»: corre «pnpm seed» o revisa TENANT_SLUG`)
  return mapTenant(t as unknown as Fila<"tenants">)
}

export async function getRamaActual() {
  return getRama((await getTenant()).rama)
}

export async function updateBranding(
  cambios: Pick<Tenant, "nombreCorto" | "razonSocial" | "colorPrimario" | "acreditacionEma" | "logoUrl">,
) {
  const supabase = await createClient()
  const { tenant } = (await getSession())!
  const t = datos(
    await supabase
      .from("tenants")
      .update({
        nombre_corto: cambios.nombreCorto,
        razon_social: cambios.razonSocial,
        color_primario: cambios.colorPrimario,
        acreditacion_ema: cambios.acreditacionEma,
        logo_url: cambios.logoUrl,
      })
      .eq("id", tenant.id)
      .select()
      .single(),
  )
  return mapTenant(t)
}

export async function listUsuarios() {
  const supabase = await createClient()
  return datos(await supabase.from("usuarios").select("*").order("nombre")).map(mapUsuario)
}

export async function getUsuario(id: string) {
  const supabase = await createClient()
  const u = datos(await supabase.from("usuarios").select("*").eq("id", id).maybeSingle())
  return u ? mapUsuario(u) : null
}

export async function listInspectores() {
  const supabase = await createClient()
  return datos(await supabase.from("usuarios").select("*").eq("rol", "inspector").eq("activo", true).order("nombre")).map(mapUsuario)
}

export async function listNormas() {
  const supabase = await createClient()
  return datos(await supabase.from("normas").select("*").order("clave")).map(mapNorma)
}

export async function listChecklists() {
  const supabase = await createClient()
  return datos(await supabase.from("checklists").select("*").order("creado_en")).map(mapChecklist)
}

export async function getChecklist(id: string) {
  const supabase = await createClient()
  const c = datos(await supabase.from("checklists").select("*").eq("id", id).maybeSingle())
  return c ? mapChecklist(c) : null
}

export async function listPlantillas() {
  const supabase = await createClient()
  return datos(await supabase.from("plantillas").select("*").order("tipo")).map(mapPlantilla)
}

/**
 * Archivo .docx de la plantilla del tenant (bucket «plantillas»). Si el cliente
 * aún no sube la suya, se usa la de templates/ incluida en el repo.
 */
export async function getArchivoPlantilla(tipo: "acta" | "dictamen") {
  const supabase = await createClient()
  const p = datos(await supabase.from("plantillas").select("archivo").eq("tipo", tipo).maybeSingle())
  if (p) {
    const { data } = await supabase.storage.from("plantillas").download(p.archivo)
    if (data) return Buffer.from(await data.arrayBuffer())
  }
  return readFile(path.join(process.cwd(), "templates", `${tipo}.docx`))
}

const ordenRol: Record<Rol, number> = { admin: 0, coordinador: 1, responsable: 2, inspector: 3 }

/** Cuentas que el login ofrece como atajo. Solo con MODO_DEMO=true; en productivo, ninguna. */
export async function listCuentasDemo() {
  if (process.env.MODO_DEMO !== "true") return []
  const admin = createAdminClient()
  const usuarios = datos(
    await admin.from("usuarios").select("email, nombre, rol, tenant:tenants!inner(slug)").eq("tenant.slug", tenantSlug()).eq("activo", true),
  )
  return usuarios
    .map(({ email, nombre, rol }) => ({ email, nombre, rol }))
    .sort((a, b) => ordenRol[a.rol] - ordenRol[b.rol] || a.nombre.localeCompare(b.nombre, "es"))
}
