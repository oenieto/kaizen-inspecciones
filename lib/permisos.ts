import type { Rol } from "@/lib/types"

/**
 * Qué puede hacer cada rol. La UI lo usa para mostrar u ocultar; el servidor
 * lo vuelve a validar en cada server action (y RLS en Supabase).
 */
export type Accion =
  | "agenda.editar"
  | "clientes.editar"
  | "inspecciones.revisar"
  | "dictamen.aprobar"
  | "configuracion.editar"
  | "campo.capturar"

const matriz: Record<Rol, Accion[]> = {
  admin: ["agenda.editar", "clientes.editar", "inspecciones.revisar", "dictamen.aprobar", "configuracion.editar", "campo.capturar"],
  coordinador: ["agenda.editar", "clientes.editar"],
  responsable: ["inspecciones.revisar", "dictamen.aprobar"],
  inspector: ["campo.capturar"],
}

export function puede(rol: Rol, accion: Accion) {
  return matriz[rol].includes(accion)
}

export const etiquetaRol: Record<Rol, string> = {
  admin: "Administrador",
  coordinador: "Coordinación",
  responsable: "Responsable técnico",
  inspector: "Inspector",
}

/** Pantalla de inicio por rol tras iniciar sesión */
export function inicioPorRol(rol: Rol) {
  return rol === "inspector" ? "/campo" : "/dashboard"
}
