import "server-only"
import type { Cliente, Instalacion } from "@/lib/types"
import { newId, store } from "./store"
import { registrar } from "./bitacora"
import { toFila } from "./inspecciones"

export async function listClientes(q?: string) {
  const s = await store()
  const term = q?.trim().toLowerCase()
  return s.clientes
    .filter((c) => !term || c.razonSocial.toLowerCase().includes(term) || c.rfc.toLowerCase().includes(term))
    .map((c) => ({
      ...c,
      instalaciones: s.instalaciones.filter((i) => i.clienteId === c.id).length,
      inspecciones: s.inspecciones.filter((x) => s.instalaciones.some((i) => i.id === x.instalacionId && i.clienteId === c.id)).length,
    }))
    .sort((a, b) => a.razonSocial.localeCompare(b.razonSocial))
}

export async function listInstalaciones() {
  const s = await store()
  return s.instalaciones.map((i) => ({ ...i, cliente: s.clientes.find((c) => c.id === i.clienteId)!.razonSocial }))
}

export async function getClienteDetalle(id: string) {
  const s = await store()
  const cliente = s.clientes.find((c) => c.id === id)
  if (!cliente) return null
  const instalaciones = s.instalaciones.filter((i) => i.clienteId === id)
  const ids = new Set(instalaciones.map((i) => i.id))
  const historial = s.inspecciones
    .filter((x) => ids.has(x.instalacionId))
    .sort((a, b) => b.fecha.localeCompare(a.fecha))
    .map(toFila)
  return { cliente, instalaciones, historial }
}

export async function createCliente(data: Omit<Cliente, "id" | "tenantId" | "creadoEn">, usuarioId: string) {
  const s = await store()
  const cliente: Cliente = { ...data, id: newId("c"), tenantId: s.tenant.id, creadoEn: new Date().toISOString() }
  s.clientes.push(cliente)
  registrar({ entidad: "cliente", entidadId: cliente.id, accion: "crear", descripcion: `Alta de cliente ${cliente.razonSocial}`, usuarioId })
  return cliente
}

export async function createInstalacion(data: Omit<Instalacion, "id" | "tenantId">, usuarioId: string) {
  const s = await store()
  const inst: Instalacion = { ...data, id: newId("i"), tenantId: s.tenant.id }
  s.instalaciones.push(inst)
  registrar({ entidad: "instalacion", entidadId: inst.id, accion: "crear", descripcion: `Alta de instalación ${inst.nombre}`, usuarioId })
  return inst
}
