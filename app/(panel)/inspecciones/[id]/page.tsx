import type { Metadata } from "next"
import Link from "next/link"
import { notFound } from "next/navigation"
import { CheckCircle2Icon, CircleAlertIcon, FileTextIcon, MapPinIcon, SparklesIcon } from "lucide-react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Badge } from "@/components/ui/badge"
import { Progress } from "@/components/ui/progress"
import { PageHeader } from "@/components/page-header"
import { EstatusBadge } from "@/components/estatus-badge"
import { requireSession } from "@/lib/auth"
import { getRamaActual, listUsuarios } from "@/lib/data/catalogos"
import { getInspeccionDetalle } from "@/lib/data/inspecciones"
import { evaluarCompletitud, sugerirRedaccionNC } from "@/lib/ia/completitud"
import { fecha, fechaHora } from "@/lib/format"
import { puede } from "@/lib/permisos"
import { cn } from "@/lib/utils"
import type { ValorCumple } from "@/lib/types"
import { AccionesExpediente } from "./acciones"

export async function generateMetadata(props: PageProps<"/inspecciones/[id]">): Promise<Metadata> {
  const x = await getInspeccionDetalle((await props.params).id)
  return { title: x ? `Expediente · ${x.cliente.razonSocial}` : "Expediente" }
}

const valorUI: Record<ValorCumple, { label: string; className: string }> = {
  cumple: { label: "Cumple", className: "bg-positive-soft text-positive" },
  no_cumple: { label: "No cumple", className: "bg-negative-soft text-negative" },
  na: { label: "N/A", className: "bg-muted text-muted-foreground" },
}

const semaforo = { verde: "text-positive", amarillo: "text-warning", rojo: "text-negative" }

export default async function ExpedientePage(props: PageProps<"/inspecciones/[id]">) {
  const { id } = await props.params
  const [{ usuario }, x, rama, usuarios] = await Promise.all([requireSession(), getInspeccionDetalle(id), getRamaActual(), listUsuarios()])
  if (!x) notFound()

  const completitud = evaluarCompletitud(x)
  const respuestas = new Map(x.respuestas.map((r) => [r.reactivoId, r]))
  const secciones = [...new Set(x.checklist.reactivos.map((r) => r.seccion))]
  const nc = x.respuestas.filter((r) => r.valor === "no_cumple").length
  const fotos = x.evidencias.filter((e) => e.tipo === "foto")
  const documentos = x.evidencias.filter((e) => e.tipo === "documento")

  return (
    <>
      <PageHeader title={`${x.cliente.razonSocial} — ${x.instalacion.nombre}`} description={`Expediente ${x.id} · versión ${x.version}`}>
        <EstatusBadge estatus={x.estatus} etiqueta={rama.estatus[x.estatus]} />
        <AccionesExpediente
          id={x.id}
          estatus={x.estatus}
          dictamenId={x.dictamen?.id ?? null}
          puedeAprobar={puede(usuario.rol, "dictamen.aprobar")}
          puedeRevisar={puede(usuario.rol, "inspecciones.revisar")}
          puedeAgenda={puede(usuario.rol, "agenda.editar")}
          completitud={completitud.puntaje}
        />
      </PageHeader>

      <div className="grid gap-4 xl:grid-cols-[1fr_340px]">
        <Card>
          <CardContent>
            <Tabs defaultValue="checklist">
              <TabsList>
                <TabsTrigger value="checklist">Checklist {nc > 0 && <Badge variant="destructive" className="ml-1">{nc} NC</Badge>}</TabsTrigger>
                <TabsTrigger value="evidencias">Evidencias ({x.evidencias.length})</TabsTrigger>
                <TabsTrigger value="acta">Acta</TabsTrigger>
                <TabsTrigger value="bitacora">Bitácora</TabsTrigger>
              </TabsList>

              <TabsContent value="checklist" className="mt-4 space-y-6">
                <p className="text-sm text-muted-foreground">{x.norma.clave} · {x.checklist.nombre} (v{x.checklist.version})</p>
                {x.respuestas.length === 0 && (
                  <p className="rounded-md border border-dashed p-6 text-center text-sm text-muted-foreground">
                    Aún no hay captura de campo. El inspector la llena desde la app de campo y se sincroniza aquí.
                  </p>
                )}
                {x.respuestas.length > 0 &&
                  secciones.map((sec) => (
                    <section key={sec}>
                      <h3 className="mb-2 text-sm font-semibold">{sec}</h3>
                      <ul className="divide-y rounded-md border">
                        {x.checklist.reactivos
                          .filter((r) => r.seccion === sec)
                          .map((r) => {
                            const a = respuestas.get(r.id)
                            return (
                              <li key={r.id} className="grid gap-1 p-3 text-sm sm:grid-cols-[56px_1fr_auto] sm:items-start sm:gap-3">
                                <span className="font-mono text-xs text-muted-foreground">{r.numeral}</span>
                                <div className="space-y-1">
                                  <p>{r.texto}{r.requerido && <span className="text-destructive"> *</span>}</p>
                                  {a?.observacion && <p className="text-xs text-muted-foreground">{a.observacion}</p>}
                                  {a?.valor === "no_cumple" && (
                                    <p className="flex gap-1.5 rounded-md bg-review-soft p-2.5 text-xs text-review">
                                      <SparklesIcon className="mt-0.5 size-3.5 shrink-0" />
                                      <span><b>Redacción sugerida:</b> {sugerirRedaccionNC(r, a.observacion)}</span>
                                    </p>
                                  )}
                                </div>
                                <div className="flex items-center gap-2 sm:justify-end">
                                  {r.tipo === "medicion" && <span className="tabular-nums">{a?.medicion ?? "—"} {r.unidad}</span>}
                                  {r.tipo !== "texto" && a?.valor && (
                                    <Badge variant="secondary" className={cn("border-0", valorUI[a.valor].className)}>{valorUI[a.valor].label}</Badge>
                                  )}
                                  {!a && r.requerido && <Badge variant="outline">Sin respuesta</Badge>}
                                </div>
                              </li>
                            )
                          })}
                      </ul>
                    </section>
                  ))}
              </TabsContent>

              <TabsContent value="evidencias" className="mt-4 space-y-6">
                {x.evidencias.length === 0 && <p className="py-8 text-center text-sm text-muted-foreground">Sin evidencias todavía.</p>}
                {fotos.length > 0 && (
                  <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                    {fotos.map((e) => (
                      <figure key={e.id} className="overflow-hidden rounded-lg border">
                        {/* eslint-disable-next-line @next/next/no-img-element -- evidencias: data URLs o Storage */}
                        <img src={e.url} alt={e.nombre} className="aspect-4/3 w-full bg-muted object-cover" />
                        <figcaption className="space-y-0.5 p-2 text-xs">
                          <p className="font-medium">{e.nombre}</p>
                          <p className="flex items-center gap-1 text-muted-foreground">
                            <MapPinIcon className="size-3" />
                            {e.lat != null ? `${e.lat.toFixed(5)}, ${e.lng?.toFixed(5)}` : "Sin ubicación"} · {fechaHora(e.tomadaEn)}
                          </p>
                          <p className="truncate font-mono text-[10px] text-muted-foreground">{e.hash}</p>
                        </figcaption>
                      </figure>
                    ))}
                  </div>
                )}
                {documentos.length > 0 && (
                  <ul className="divide-y rounded-md border">
                    {documentos.map((e) => (
                      <li key={e.id} className="flex items-center gap-3 p-3 text-sm">
                        <FileTextIcon className="size-4 text-muted-foreground" />
                        <a href={e.url} target="_blank" rel="noreferrer" className="hover:underline">{e.nombre}</a>
                        <span className="ml-auto text-xs text-muted-foreground">{fechaHora(e.tomadaEn)}</span>
                      </li>
                    ))}
                  </ul>
                )}
              </TabsContent>

              <TabsContent value="acta" className="mt-4">
                {!x.acta ? (
                  <p className="py-8 text-center text-sm text-muted-foreground">El acta circunstanciada se genera al firmar en campo.</p>
                ) : (
                  <div className="space-y-4 text-sm">
                    <p>Acta circunstanciada v{x.acta.version} · {fechaHora(x.acta.generadaEn)}</p>
                    <div className="grid gap-4 sm:grid-cols-2">
                      {[
                        ["Firma del cliente", x.acta.firmaCliente, x.acta.nombreFirmaCliente],
                        ["Firma del inspector", x.acta.firmaInspector, x.inspector.nombre],
                      ].map(([titulo, firma, nombre]) => (
                        <div key={titulo} className="rounded-md border p-3">
                          <p className="text-xs text-muted-foreground">{titulo}</p>
                          {firma ? (
                            // eslint-disable-next-line @next/next/no-img-element -- firma capturada como data URL
                            <img src={firma} alt={String(titulo)} className="h-24 w-full object-contain" />
                          ) : (
                            <div className="flex h-24 items-center justify-center text-xs text-muted-foreground">Firma en papel (histórico)</div>
                          )}
                          <p className="border-t pt-1 text-center">{nombre}</p>
                        </div>
                      ))}
                    </div>
                    {x.observaciones && <p><b>Observaciones:</b> {x.observaciones}</p>}
                  </div>
                )}
              </TabsContent>

              <TabsContent value="bitacora" className="mt-4">
                <ol className="relative space-y-4 border-l pl-5">
                  {x.bitacora.map((b) => (
                    <li key={b.id} className="text-sm">
                      <span className="absolute -left-1.5 mt-1.5 size-3 rounded-full border-2 border-background bg-primary" />
                      <p>{b.descripcion}</p>
                      <p className="text-xs text-muted-foreground">{fechaHora(b.timestamp)} · {usuarios.find((u) => u.id === b.usuarioId)?.nombre ?? b.usuarioId}</p>
                    </li>
                  ))}
                </ol>
                <p className="mt-4 text-xs text-muted-foreground">Registro de solo inserción (ISO/IEC 17020): no se edita ni se borra.</p>
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>

        <div className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2"><SparklesIcon className="size-4" /> Completitud del expediente</CardTitle>
              <CardDescription>Revisión asistida por IA antes de dictaminar</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex items-center gap-3">
                <span className={cn("text-2xl font-semibold tabular-nums", semaforo[completitud.nivel])}>{completitud.puntaje}%</span>
                <Progress value={completitud.puntaje} className="flex-1" />
              </div>
              <ul className="space-y-1.5 text-sm">
                {completitud.hallazgos.map((h) => (
                  <li key={h.texto} className="flex gap-2">
                    {h.ok ? <CheckCircle2Icon className="mt-0.5 size-4 shrink-0 text-positive" /> : <CircleAlertIcon className="mt-0.5 size-4 shrink-0 text-warning" />}
                    {h.texto}
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle>Datos de la inspección</CardTitle></CardHeader>
            <CardContent>
              <dl className="space-y-3 text-sm">
                {[
                  ["Cliente", <Link key="c" href={`/clientes/${x.cliente.id}`} className="hover:underline">{x.cliente.razonSocial}</Link>],
                  ["Instalación", `${x.instalacion.nombre} · ${x.instalacion.tipo}`],
                  ["Dirección", `${x.instalacion.direccion}, ${x.instalacion.municipio}`],
                  ["Permiso", x.instalacion.permiso],
                  ["Norma", x.norma.clave],
                  ["Inspector", x.inspector.nombre],
                  ["Fecha programada", fechaHora(x.fecha)],
                  ["Sincronizada", x.sincronizadaEn ? fechaHora(x.sincronizadaEn) : "—"],
                ].map(([k, v]) => (
                  <div key={String(k)}>
                    <dt className="text-xs text-muted-foreground">{k}</dt>
                    <dd>{v}</dd>
                  </div>
                ))}
              </dl>
            </CardContent>
          </Card>

          {x.dictamen && (
            <Card>
              <CardHeader>
                <CardTitle>Dictamen</CardTitle>
                <CardDescription className="font-mono">{x.dictamen.folio}</CardDescription>
              </CardHeader>
              <CardContent className="space-y-1 text-sm">
                <p>Resultado: <b>{x.dictamen.resultado === "cumple" ? "Cumple" : "No cumple"}</b></p>
                <p>Emitido: {fecha(x.dictamen.emitidoEn)}{x.dictamen.vigenteHasta && ` · vigente hasta ${fecha(x.dictamen.vigenteHasta)}`}</p>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </>
  )
}
