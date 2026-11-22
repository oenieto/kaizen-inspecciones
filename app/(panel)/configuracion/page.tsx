import type { Metadata } from "next"
import { redirect } from "next/navigation"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { PageHeader } from "@/components/page-header"
import { requireSession } from "@/lib/auth"
import { getRamaActual, listChecklists, listNormas, listPlantillas, listUsuarios } from "@/lib/data/catalogos"
import { diasHasta, fecha } from "@/lib/format"
import { etiquetaRol, puede } from "@/lib/permisos"
import { BrandingForm, ReiniciarDemo } from "./branding-form"

export const metadata: Metadata = { title: "Configuración" }

const tipoReactivo = { cumple: "Cumple / No cumple / N/A", medicion: "Medición", texto: "Texto libre" }

export default async function ConfiguracionPage() {
  const { usuario, tenant } = await requireSession()
  if (!puede(usuario.rol, "configuracion.editar")) redirect("/dashboard")
  const [normas, checklists, plantillas, usuarios, rama] = await Promise.all([listNormas(), listChecklists(), listPlantillas(), listUsuarios(), getRamaActual()])

  return (
    <>
      <PageHeader title="Configuración" description={`Rama: ${rama.nombre}. Normas, checklists y plantillas son configuración, no código.`}>
        {process.env.MODO_DEMO === "true" && <ReiniciarDemo />}
      </PageHeader>
      <Tabs defaultValue="normas">
        <TabsList>
          <TabsTrigger value="normas">Normas</TabsTrigger>
          <TabsTrigger value="checklists">Checklists</TabsTrigger>
          <TabsTrigger value="plantillas">Plantillas</TabsTrigger>
          <TabsTrigger value="usuarios">Usuarios</TabsTrigger>
          <TabsTrigger value="branding">Branding</TabsTrigger>
        </TabsList>

        <TabsContent value="normas" className="mt-4">
          <Card>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow><TableHead>Clave</TableHead><TableHead>Título</TableHead><TableHead>Estado</TableHead><TableHead>Nota</TableHead></TableRow>
                </TableHeader>
                <TableBody>
                  {normas.map((n) => (
                    <TableRow key={n.id}>
                      <TableCell className="font-mono text-xs">{n.clave}</TableCell>
                      <TableCell>{n.titulo}</TableCell>
                      <TableCell><Badge variant={n.vigente ? "secondary" : "outline"}>{n.vigente ? "Vigente" : "Cancelada"}</Badge></TableCell>
                      <TableCell className="max-w-80 text-xs whitespace-normal text-muted-foreground">{n.nota ?? "—"}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="checklists" className="mt-4 space-y-4">
          {checklists.map((c) => (
            <Card key={c.id}>
              <CardHeader>
                <CardTitle>{c.nombre}</CardTitle>
                <CardDescription>{normas.find((n) => n.id === c.normaId)?.clave} · versión {c.version} · {c.reactivos.length} reactivos</CardDescription>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow><TableHead>Numeral</TableHead><TableHead>Sección</TableHead><TableHead>Reactivo</TableHead><TableHead>Tipo</TableHead><TableHead>Obligatorio</TableHead></TableRow>
                  </TableHeader>
                  <TableBody>
                    {c.reactivos.map((r) => (
                      <TableRow key={r.id}>
                        <TableCell className="font-mono text-xs">{r.numeral}</TableCell>
                        <TableCell>{r.seccion}</TableCell>
                        <TableCell className="whitespace-normal">{r.texto}</TableCell>
                        <TableCell className="text-xs">{tipoReactivo[r.tipo]}{r.unidad && ` (${r.unidad})`}</TableCell>
                        <TableCell>{r.requerido ? "Sí" : "No"}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          ))}
        </TabsContent>

        <TabsContent value="plantillas" className="mt-4 grid gap-4 md:grid-cols-2">
          {plantillas.map((p) => (
            <Card key={p.id}>
              <CardHeader>
                <CardTitle>{p.nombre}</CardTitle>
                <CardDescription className="font-mono">{p.archivo} · actualizada {fecha(p.actualizadaEn)}</CardDescription>
              </CardHeader>
              <CardContent className="space-y-2">
                <p className="text-xs text-muted-foreground">Campos que llena el sistema (etiquetas {"{campo}"} en el .docx):</p>
                <div className="flex flex-wrap gap-1.5">
                  {p.campos.map((c) => <Badge key={c} variant="outline" className="font-mono">{c}</Badge>)}
                </div>
              </CardContent>
            </Card>
          ))}
        </TabsContent>

        <TabsContent value="usuarios" className="mt-4">
          <Card>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow><TableHead>Nombre</TableHead><TableHead>Correo</TableHead><TableHead>Rol</TableHead><TableHead>Competencias</TableHead></TableRow>
                </TableHeader>
                <TableBody>
                  {usuarios.map((u) => (
                    <TableRow key={u.id}>
                      <TableCell className="font-medium">{u.nombre}</TableCell>
                      <TableCell>{u.email}</TableCell>
                      <TableCell>{etiquetaRol[u.rol]}</TableCell>
                      <TableCell>
                        {u.competencias.length === 0 ? "—" : u.competencias.map((c) => {
                          const dias = diasHasta(c.vigenteHasta)
                          return (
                            <span key={c.normaClave} className={`text-xs ${dias < 60 ? "font-medium text-warning" : ""}`}>
                              {c.normaClave} · vence {fecha(c.vigenteHasta)}{dias < 60 && " (por vencer)"}
                            </span>
                          )
                        })}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="branding" className="mt-4">
          <Card className="max-w-2xl">
            <CardHeader>
              <CardTitle>Branding del tenant</CardTitle>
              <CardDescription>Se aplica al panel, al dictamen y a la verificación pública.</CardDescription>
            </CardHeader>
            <CardContent>
              <BrandingForm tenant={tenant} />
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </>
  )
}
