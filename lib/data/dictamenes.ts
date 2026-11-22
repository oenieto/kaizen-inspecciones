import "server-only"
import { store } from "./store"
import { getInspeccionDetalle } from "./inspecciones"

export async function listDictamenes(q?: string) {
  const s = await store()
  const term = q?.trim().toLowerCase()
  return s.dictamenes
    .map((d) => {
      const x = s.inspecciones.find((i) => i.id === d.inspeccionId)!
      const inst = s.instalaciones.find((i) => i.id === x.instalacionId)!
      const cliente = s.clientes.find((c) => c.id === inst.clienteId)!
      return { ...d, cliente: cliente.razonSocial, instalacion: inst.nombre, norma: s.normas.find((n) => n.id === x.normaId)!.clave }
    })
    .filter((d) => !term || `${d.folio} ${d.cliente}`.toLowerCase().includes(term))
    .sort((a, b) => b.emitidoEn.localeCompare(a.emitidoEn))
}

/** Todo lo necesario para renderizar el dictamen (y para la plantilla .docx). */
export async function getDictamenCompleto(id: string) {
  const s = await store()
  const dictamen = s.dictamenes.find((d) => d.id === id)
  if (!dictamen) return null
  const inspeccion = await getInspeccionDetalle(dictamen.inspeccionId)
  if (!inspeccion) return null
  const responsable = s.usuarios.find((u) => u.id === dictamen.aprobadoPor)!
  return { dictamen, inspeccion, responsable, tenant: s.tenant }
}

/** Verificación pública por QR: expone solo lo mínimo. */
export async function verificarToken(token: string) {
  const s = await store()
  const d = s.dictamenes.find((x) => x.tokenQr === token)
  if (!d) return null
  const x = s.inspecciones.find((i) => i.id === d.inspeccionId)!
  const inst = s.instalaciones.find((i) => i.id === x.instalacionId)!
  return {
    folio: d.folio,
    resultado: d.resultado,
    emitidoEn: d.emitidoEn,
    vigenteHasta: d.vigenteHasta,
    cliente: s.clientes.find((c) => c.id === inst.clienteId)!.razonSocial,
    instalacion: `${inst.nombre} · ${inst.municipio}`,
    norma: s.normas.find((n) => n.id === x.normaId)!.clave,
    unidad: s.tenant.razonSocial,
    acreditacion: s.tenant.acreditacionEma,
  }
}
