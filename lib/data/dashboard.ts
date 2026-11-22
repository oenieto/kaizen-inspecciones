import "server-only"
import type { EstatusInspeccion } from "@/lib/types"
import { store } from "./store"

const MES = new Intl.DateTimeFormat("es-MX", { month: "short" })

export async function getDashboard() {
  const s = await store()
  const ahora = new Date()

  const porEstatus = (["programada", "en_curso", "en_revision", "dictaminada", "cancelada"] as EstatusInspeccion[]).map(
    (estatus) => ({ estatus, total: s.inspecciones.filter((x) => x.estatus === estatus).length }),
  )

  const meses = Array.from({ length: 6 }, (_, k) => {
    const d = new Date(ahora.getFullYear(), ahora.getMonth() - 5 + k, 1)
    const fin = new Date(d.getFullYear(), d.getMonth() + 1, 1)
    const delMes = s.dictamenes.filter((x) => x.emitidoEn >= d.toISOString() && x.emitidoEn < fin.toISOString())
    return {
      mes: MES.format(d).replace(".", ""),
      cumple: delMes.filter((x) => x.resultado === "cumple").length,
      noCumple: delMes.filter((x) => x.resultado === "no_cumple").length,
    }
  })

  const productividad = s.usuarios
    .filter((u) => u.rol === "inspector")
    .map((u) => ({
      inspector: u.nombre,
      dictaminadas: s.inspecciones.filter((x) => x.inspectorId === u.id && x.estatus === "dictaminada").length,
      pendientes: s.inspecciones.filter((x) => x.inspectorId === u.id && ["programada", "en_curso", "en_revision"].includes(x.estatus)).length,
    }))

  // Horas de visita → emisión del dictamen
  const tiempos = s.dictamenes
    .map((d) => {
      const x = s.inspecciones.find((i) => i.id === d.inspeccionId)!
      return (new Date(d.emitidoEn).getTime() - new Date(x.fecha).getTime()) / 3_600_000
    })
    .filter((h) => h > 0)
  const promedioHoras = tiempos.length ? tiempos.reduce((a, b) => a + b, 0) / tiempos.length : 0

  const checklist = s.checklists[0]
  const conteoNC = new Map<string, number>()
  for (const x of s.inspecciones)
    for (const r of x.respuestas) if (r.valor === "no_cumple") conteoNC.set(r.reactivoId, (conteoNC.get(r.reactivoId) ?? 0) + 1)
  const ncFrecuentes = [...conteoNC.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([id, total]) => {
      const r = checklist.reactivos.find((x) => x.id === id)!
      return { numeral: r.numeral, texto: r.texto, total }
    })

  const limite = new Date(ahora.getTime() + 60 * 86_400_000).toISOString()
  const vencimientos = s.instalaciones
    .filter((i) => i.vencimiento && i.vencimiento <= limite)
    .sort((a, b) => a.vencimiento!.localeCompare(b.vencimiento!))
    .slice(0, 8)
    .map((i) => ({ ...i, cliente: s.clientes.find((c) => c.id === i.clienteId)!.razonSocial }))

  const hoy = new Date(ahora)
  hoy.setHours(0, 0, 0, 0)
  const manana = new Date(hoy.getTime() + 86_400_000)
  const citasHoy = s.inspecciones.filter((x) => x.fecha >= hoy.toISOString() && x.fecha < manana.toISOString() && x.estatus !== "cancelada").length

  return { porEstatus, meses, productividad, promedioHoras, ncFrecuentes, vencimientos, citasHoy, totalClientes: s.clientes.length }
}
