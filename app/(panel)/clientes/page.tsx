import type { Metadata } from "next"
import Link from "next/link"
import { Card, CardContent } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { PageHeader } from "@/components/page-header"
import { SearchInput } from "@/components/search-input"
import { requireSession } from "@/lib/auth"
import { getRamaActual } from "@/lib/data/catalogos"
import { listClientes } from "@/lib/data/clientes"
import { puede } from "@/lib/permisos"
import { ClienteDialog } from "./cliente-dialog"

export const metadata: Metadata = { title: "Clientes" }

export default async function ClientesPage(props: PageProps<"/clientes">) {
  const { q } = await props.searchParams
  const query = typeof q === "string" ? q : undefined
  const [{ usuario }, clientes, rama] = await Promise.all([requireSession(), listClientes(query), getRamaActual()])

  return (
    <>
      <PageHeader title="Clientes e instalaciones" description={`${clientes.length} clientes`}>
        {puede(usuario.rol, "clientes.editar") && <ClienteDialog giros={rama.giros} />}
      </PageHeader>
      <Card>
        <CardContent className="space-y-4">
          <SearchInput defaultValue={query} placeholder="Buscar por razón social o RFC" />
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Razón social</TableHead>
                <TableHead>RFC</TableHead>
                <TableHead>Giro</TableHead>
                <TableHead>Contacto</TableHead>
                <TableHead className="text-right">Instalaciones</TableHead>
                <TableHead className="text-right">Inspecciones</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {clientes.map((c) => (
                <TableRow key={c.id} className="relative">
                  <TableCell className="font-medium">
                    <Link href={`/clientes/${c.id}`} className="after:absolute after:inset-0 hover:underline">{c.razonSocial}</Link>
                  </TableCell>
                  <TableCell className="font-mono text-xs">{c.rfc}</TableCell>
                  <TableCell>{c.giro}</TableCell>
                  <TableCell>{c.contacto}</TableCell>
                  <TableCell className="text-right tabular-nums">{c.instalaciones}</TableCell>
                  <TableCell className="text-right tabular-nums">{c.inspecciones}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          {clientes.length === 0 && <p className="py-8 text-center text-sm text-muted-foreground">Sin resultados.</p>}
        </CardContent>
      </Card>
    </>
  )
}
