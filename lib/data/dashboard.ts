import "server-only"
import { createClient } from "@/lib/supabase/server"
import { medianocheLocal, partesLocales, rangoDelDia } from "@/lib/fechas"
import type { EstatusInspeccion, Instalacion } from "@/lib/types"
import { datos } from "./base"
import { listChecklists } from "./catalogos"
import { mapInstalacion, type Fila } from "./mappers"

const MES = new Intl.DateTimeFormat("es-MX", { month: "short", timeZone: "UTC" })
const ESTATUS: EstatusInspeccion[] = ["programada", "en_curso", "en_revision", "dictaminada", "cancelada"]

/** Lo que devuelve la función SQL dashboard() (agregados calculados en la BD con RLS). */
interface Agregados {
  porEstatus: Partial<Record<EstatusInspeccion, number>>
  meses: { mes: string; cumple: number; noCumple: number }[]
  productividad: { inspector: string; dictaminadas: number; pendientes: number }[]
  promedioHoras: number
  ncFrecuentes: { reactivoId: string; total: number }[]
  vencimientos: (Fila<"instalaciones"> & { cliente: string })[]
  citasHoy: number
  totalClientes: number
}

export async function getDashboard() {
  const supabase = await createClient()
  const ahora = new Date()
  const hoy = partesLocales(ahora)
  const { inicio, fin } = rangoDelDia(ahora)

  // Últimos 6 meses calendario (zona de la operación)
  const meses = Array.from({ length: 6 }, (_, k) => {
    const d = new Date(Date.UTC(hoy.anio, hoy.mes - 1 - 5 + k, 15))
    return { clave: `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`, etiqueta: MES.format(d).replace(".", "") }
  })
  const desde = medianocheLocal(hoy.anio, hoy.mes - 5, 1)

  const [agregados, checklists] = await Promise.all([
    supabase.rpc("dashboard", {
      p_desde: desde.toISOString(),
      p_hoy_inicio: inicio.toISOString(),
      p_hoy_fin: fin.toISOString(),
      p_limite_vencimiento: new Date(ahora.getTime() + 60 * 86_400_000).toISOString(),
    }),
    listChecklists(),
  ])
  const a = datos(agregados) as unknown as Agregados
  const reactivos = new Map(checklists.flatMap((c) => c.reactivos.map((r) => [r.id, r])))

  return {
    porEstatus: ESTATUS.map((estatus) => ({ estatus, total: a.porEstatus[estatus] ?? 0 })),
    meses: meses.map(({ clave, etiqueta }) => {
      const m = a.meses.find((x) => x.mes === clave)
      return { mes: etiqueta, cumple: m?.cumple ?? 0, noCumple: m?.noCumple ?? 0 }
    }),
    productividad: a.productividad,
    promedioHoras: Number(a.promedioHoras),
    ncFrecuentes: a.ncFrecuentes.flatMap(({ reactivoId, total }) => {
      const r = reactivos.get(reactivoId)
      return r ? [{ numeral: r.numeral, texto: r.texto, total }] : []
    }),
    vencimientos: a.vencimientos.map(({ cliente, ...i }): Instalacion & { cliente: string } => ({ ...mapInstalacion(i), cliente })),
    citasHoy: a.citasHoy,
    totalClientes: a.totalClientes,
  }
}
