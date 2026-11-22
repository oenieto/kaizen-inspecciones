import "server-only"
import { getRama } from "@/config/ramas"
import type { Tenant } from "@/lib/types"
import { store } from "./store"
import { registrar } from "./bitacora"

export async function getTenant() {
  return (await store()).tenant
}

export async function getRamaActual() {
  return getRama((await store()).tenant.rama)
}

export async function updateBranding(
  cambios: Pick<Tenant, "nombreCorto" | "razonSocial" | "colorPrimario" | "acreditacionEma" | "logoUrl">,
  usuarioId: string,
) {
  const s = await store()
  s.tenant = { ...s.tenant, ...cambios }
  registrar({ entidad: "tenant", entidadId: s.tenant.id, accion: "actualizar", descripcion: "Branding actualizado", usuarioId })
  return s.tenant
}

export async function listUsuarios() {
  return (await store()).usuarios
}

export async function getUsuario(id: string) {
  return (await store()).usuarios.find((u) => u.id === id) ?? null
}

export async function listInspectores() {
  return (await store()).usuarios.filter((u) => u.rol === "inspector")
}

export async function listNormas() {
  return (await store()).normas
}

export async function listChecklists() {
  return (await store()).checklists
}

export async function getChecklist(id: string) {
  return (await store()).checklists.find((c) => c.id === id) ?? null
}

export async function listPlantillas() {
  return (await store()).plantillas
}
