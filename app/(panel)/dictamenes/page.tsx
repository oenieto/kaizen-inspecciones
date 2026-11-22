import type { Metadata } from "next"
import Link from "next/link"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { PageHeader } from "@/components/page-header"
import { SearchInput } from "@/components/search-input"
import { listDictamenes } from "@/lib/data/dictamenes"
import { diasHasta, fecha } from "@/lib/format"

export const metadata: Metadata = { title: "Dictámenes" }

export default async function DictamenesPage(props: PageProps<"/dictamenes">) {
  const { q } = await props.searchParams
  const query = typeof q === "string" ? q : undefined
  const dictamenes = await listDictamenes(query)

  return (
    <>
      <PageHeader title="Dictámenes" description={`${dictamenes.length} emitidos · folio consecutivo por año`} />
      <Card>
        <CardContent className="space-y-4">
          <SearchInput defaultValue={query} placeholder="Buscar folio o cliente" />
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Folio</TableHead>
                <TableHead>Cliente</TableHead>
                <TableHead>Instalación</TableHead>
                <TableHead>Norma</TableHead>
                <TableHead>Resultado</TableHead>
                <TableHead>Emitido</TableHead>
                <TableHead className="text-right">Vigencia</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {dictamenes.map((d) => {
                const dias = d.vigenteHasta ? diasHasta(d.vigenteHasta) : null
                return (
                  <TableRow key={d.id} className="relative">
                    <TableCell className="font-mono text-xs">
                      <Link href={`/dictamenes/${d.id}`} className="after:absolute after:inset-0 hover:underline">{d.folio}</Link>
                    </TableCell>
                    <TableCell className="max-w-56 truncate">{d.cliente}</TableCell>
                    <TableCell>{d.instalacion}</TableCell>
                    <TableCell className="font-mono text-xs">{d.norma}</TableCell>
                    <TableCell>
                      <Badge variant="secondary" className={d.resultado === "cumple" ? "border-0 bg-positive-soft text-positive" : "border-0 bg-negative-soft text-negative"}>
                        {d.resultado === "cumple" ? "Cumple" : "No cumple"}
                      </Badge>
                    </TableCell>
                    <TableCell className="tabular-nums">{fecha(d.emitidoEn)}</TableCell>
                    <TableCell className={`text-right tabular-nums ${dias !== null && dias < 60 ? "text-warning" : ""}`}>{d.vigenteHasta ? fecha(d.vigenteHasta) : "No aplica"}</TableCell>
                  </TableRow>
                )
              })}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </>
  )
}
