import Link from "next/link"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { EstatusBadge } from "@/components/estatus-badge"
import { fechaHora } from "@/lib/format"
import type { EstatusInspeccion, InspeccionFila } from "@/lib/types"

export function InspeccionesTabla({
  filas,
  etiquetas,
  ocultarCliente = false,
}: {
  filas: InspeccionFila[]
  etiquetas: Record<EstatusInspeccion, string>
  ocultarCliente?: boolean
}) {
  if (filas.length === 0) return <p className="py-10 text-center text-sm text-muted-foreground">No hay inspecciones con estos filtros.</p>
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Fecha</TableHead>
          {!ocultarCliente && <TableHead>Cliente</TableHead>}
          <TableHead>Instalación</TableHead>
          <TableHead>Inspector</TableHead>
          <TableHead>Norma</TableHead>
          <TableHead>Estatus</TableHead>
          <TableHead>Folio</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {filas.map((f) => (
          <TableRow key={f.id} className="relative">
            <TableCell className="tabular-nums">
              <Link href={`/inspecciones/${f.id}`} className="after:absolute after:inset-0 hover:underline">{fechaHora(f.fecha)}</Link>
            </TableCell>
            {!ocultarCliente && <TableCell className="max-w-56 truncate">{f.cliente}</TableCell>}
            <TableCell>{f.instalacion} <span className="text-muted-foreground">· {f.municipio}</span></TableCell>
            <TableCell>{f.inspector}</TableCell>
            <TableCell className="font-mono text-xs">{f.norma}</TableCell>
            <TableCell><EstatusBadge estatus={f.estatus} etiqueta={etiquetas[f.estatus]} /></TableCell>
            <TableCell className="font-mono text-xs">{f.folio ?? "—"}</TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  )
}
