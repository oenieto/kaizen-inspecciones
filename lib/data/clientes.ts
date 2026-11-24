import "server-only"
import { createClient } from "@/lib/supabase/server"
import type { Cliente, Instalacion } from "@/lib/types"
import { datos, esUuid, patronBusqueda } from "./base"
import { mapCliente, mapFila, mapInstalacion, type Fila } from "./mappers"

export async function listClientes(q?: string) {
  const supabase = await createClient()
  let consulta = supabase.from("clientes_resumen").select("*")
  if (q?.trim()) consulta = consulta.ilike("busqueda", patronBusqueda(q))
  return datos(await consulta)
    .map((c) => ({
      ...mapCliente(c as Fila<"clientes">),
      instalaciones: c.instalaciones ?? 0,
      inspecciones: c.inspecciones ?? 0,
    }))
    .sort((a, b) => a.razonSocial.localeCompare(b.razonSocial, "es"))
}

export async function listInstalaciones() {
  const supabase = await createClient()
  return datos(await supabase.from("instalaciones").select("*, cliente:clientes(razon_social)"))
    .map(({ cliente, ...i }) => ({ ...mapInstalacion(i), cliente: cliente.razon_social }))
    .sort((a, b) => a.cliente.localeCompare(b.cliente, "es") || a.nombre.localeCompare(b.nombre, "es"))
}

/** RFC del cliente (para cotejarlo con el titular del permiso). null si no existe o no es visible. */
export async function getRfcCliente(id: string) {
  if (!esUuid(id)) return null
  const supabase = await createClient()
  return datos(await supabase.from("clientes").select("rfc").eq("id", id).maybeSingle())?.rfc ?? null
}

export async function getClienteDetalle(id: string) {
  if (!esUuid(id)) return null
  const supabase = await createClient()
  const [cliente, instalaciones, historial] = await Promise.all([
    supabase.from("clientes").select("*").eq("id", id).maybeSingle(),
    supabase.from("instalaciones").select("*").eq("cliente_id", id).order("nombre"),
    supabase.from("inspecciones_fila").select("*").eq("cliente_id", id).order("fecha", { ascending: false }),
  ])
  const c = datos(cliente)
  if (!c) return null
  return { cliente: mapCliente(c), instalaciones: datos(instalaciones).map(mapInstalacion), historial: datos(historial).map(mapFila) }
}

export async function createCliente(data: Omit<Cliente, "id" | "tenantId" | "creadoEn">) {
  const supabase = await createClient()
  const c = datos(
    await supabase
      .from("clientes")
      .insert({
        rfc: data.rfc,
        razon_social: data.razonSocial,
        giro: data.giro,
        contacto: data.contacto,
        telefono: data.telefono,
        email: data.email,
      })
      .select()
      .single(),
  )
  return mapCliente(c)
}

export async function createInstalacion(data: Omit<Instalacion, "id" | "tenantId">) {
  const supabase = await createClient()
  const i = datos(
    await supabase
      .from("instalaciones")
      .insert({
        cliente_id: data.clienteId,
        nombre: data.nombre,
        tipo: data.tipo,
        direccion: data.direccion,
        municipio: data.municipio,
        lat: data.lat,
        lng: data.lng,
        permiso: data.permiso,
        permiso_vigencia: data.permisoVigencia ?? null,
        vencimiento: data.vencimiento,
      })
      .select()
      .single(),
  )
  return mapInstalacion(i)
}
