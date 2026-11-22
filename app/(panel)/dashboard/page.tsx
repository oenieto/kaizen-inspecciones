import type { Metadata } from "next"
import Link from "next/link"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { PageHeader } from "@/components/page-header"
import { getDashboard } from "@/lib/data/dashboard"
import { getRamaActual } from "@/lib/data/catalogos"
import { diasHasta, fecha } from "@/lib/format"
import { DictamenesPorMes, ProductividadInspectores } from "./charts"

export const metadata: Metadata = { title: "Dashboard" }

export default async function DashboardPage() {
  const [d, rama] = await Promise.all([getDashboard(), getRamaActual()])
  const total = (e: string) => d.porEstatus.find((x) => x.estatus === e)?.total ?? 0

  const kpis = [
    { label: "Citas hoy", value: d.citasHoy, hint: "Programadas o en curso" },
    { label: rama.estatus.en_revision, value: total("en_revision"), hint: "Esperan al responsable técnico" },
    { label: "Dictámenes emitidos", value: total("dictaminada"), hint: "Últimos 6 meses" },
    { label: "Visita → dictamen", value: `${Math.round(d.promedioHoras)} h`, hint: "Promedio histórico; meta < 1 día" },
  ]

  return (
    <>
      <PageHeader title="Dashboard" description="Operación de la Unidad de Inspección" />
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {kpis.map((k) => (
          <Card key={k.label}>
            <CardHeader>
              <CardDescription className="text-sm font-medium text-foreground">{k.label}</CardDescription>
              <CardTitle className="text-4xl font-bold tracking-tight tabular-nums">{k.value}</CardTitle>
            </CardHeader>
            <CardContent className="text-xs text-muted-foreground">{k.hint}</CardContent>
          </Card>
        ))}
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Dictámenes por mes</CardTitle>
            <CardDescription>Resultado cumple / no cumple</CardDescription>
          </CardHeader>
          <CardContent>
            <DictamenesPorMes data={d.meses} />
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Productividad por inspector</CardTitle>
            <CardDescription>Dictaminadas y pendientes</CardDescription>
          </CardHeader>
          <CardContent>
            <ProductividadInspectores data={d.productividad} />
          </CardContent>
        </Card>
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>No conformidades más frecuentes</CardTitle>
          </CardHeader>
          <CardContent>
            <ol className="space-y-3">
              {d.ncFrecuentes.map((nc) => (
                <li key={nc.numeral} className="flex items-start justify-between gap-4 text-sm">
                  <span>
                    <span className="font-mono text-xs text-muted-foreground">{nc.numeral}</span> {nc.texto}
                  </span>
                  <Badge variant="secondary" className="h-6 min-w-8 justify-center rounded-full tabular-nums">{nc.total}</Badge>
                </li>
              ))}
            </ol>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Vencimientos próximos</CardTitle>
            <CardDescription>Dictámenes que vencen en 60 días: oportunidad de reinspección</CardDescription>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Cliente</TableHead>
                  <TableHead>Instalación</TableHead>
                  <TableHead className="text-right">Vence</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {d.vencimientos.map((v) => {
                  const dias = diasHasta(v.vencimiento!)
                  return (
                    <TableRow key={v.id}>
                      <TableCell className="max-w-44 truncate font-medium">
                        <Link href={`/clientes/${v.clienteId}`} className="hover:underline">{v.cliente}</Link>
                      </TableCell>
                      <TableCell>{v.nombre}</TableCell>
                      <TableCell className="text-right tabular-nums">
                        <div className="font-medium">{fecha(v.vencimiento!)}</div>
                        <div className={`text-xs ${dias < 0 ? "font-medium text-negative" : "text-muted-foreground"}`}>
                          {dias < 0 ? `Vencido hace ${-dias} d` : `En ${dias} d`}
                        </div>
                      </TableCell>
                    </TableRow>
                  )
                })}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>
    </>
  )
}
