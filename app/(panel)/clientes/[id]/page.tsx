import type { Metadata } from "next"
import { notFound } from "next/navigation"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { PageHeader } from "@/components/page-header"
import { InspeccionesTabla } from "@/components/inspecciones-tabla"
import { requireSession } from "@/lib/auth"
import { getRamaActual } from "@/lib/data/catalogos"
import { getClienteDetalle } from "@/lib/data/clientes"
import { diasHasta, fecha } from "@/lib/format"
import { puede } from "@/lib/permisos"
import { InstalacionDialog } from "../cliente-dialog"

export async function generateMetadata(props: PageProps<"/clientes/[id]">): Promise<Metadata> {
  const d = await getClienteDetalle((await props.params).id)
  return { title: d?.cliente.razonSocial ?? "Cliente" }
}

export default async function ClientePage(props: PageProps<"/clientes/[id]">) {
  const { id } = await props.params
  const [{ usuario }, d, rama] = await Promise.all([requireSession(), getClienteDetalle(id), getRamaActual()])
  if (!d) notFound()
  const { cliente, instalaciones, historial } = d

  return (
    <>
      <PageHeader title={cliente.razonSocial} description={`${cliente.giro} · RFC ${cliente.rfc}`}>
        {puede(usuario.rol, "clientes.editar") && <InstalacionDialog clienteId={cliente.id} tipos={rama.tiposInstalacion} />}
      </PageHeader>
      <div className="grid gap-4 lg:grid-cols-[320px_1fr]">
        <Card>
          <CardHeader><CardTitle>Contacto</CardTitle></CardHeader>
          <CardContent>
            <dl className="space-y-3 text-sm">
              {[["Nombre", cliente.contacto], ["Teléfono", cliente.telefono], ["Correo", cliente.email], ["Cliente desde", fecha(cliente.creadoEn)]].map(([k, v]) => (
                <div key={k}>
                  <dt className="text-xs text-muted-foreground">{k}</dt>
                  <dd>{v}</dd>
                </div>
              ))}
            </dl>
          </CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle>Instalaciones ({instalaciones.length})</CardTitle></CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nombre</TableHead>
                  <TableHead>Tipo</TableHead>
                  <TableHead>Dirección</TableHead>
                  <TableHead>Permiso</TableHead>
                  <TableHead className="text-right">Dictamen vence</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {instalaciones.map((i) => {
                  const dias = i.vencimiento ? diasHasta(i.vencimiento) : null
                  return (
                    <TableRow key={i.id}>
                      <TableCell className="font-medium">{i.nombre}</TableCell>
                      <TableCell>{i.tipo}</TableCell>
                      <TableCell className="max-w-64 truncate">{i.direccion}, {i.municipio}</TableCell>
                      <TableCell className="font-mono text-xs">{i.permiso || "—"}</TableCell>
                      <TableCell className={`text-right tabular-nums ${dias !== null && dias < 30 ? "font-medium text-destructive" : ""}`}>
                        {i.vencimiento ? fecha(i.vencimiento) : "Sin dictamen"}
                      </TableCell>
                    </TableRow>
                  )
                })}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>
      <Card className="mt-4">
        <CardHeader><CardTitle>Historial de inspecciones</CardTitle></CardHeader>
        <CardContent>
          <InspeccionesTabla filas={historial} etiquetas={rama.estatus} ocultarCliente />
        </CardContent>
      </Card>
    </>
  )
}
