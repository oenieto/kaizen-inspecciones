import type { Metadata } from "next"
import Link from "next/link"
import { headers } from "next/headers"
import { notFound } from "next/navigation"
import QRCode from "qrcode"
import { ArrowLeftIcon } from "lucide-react"
import { Button } from "@/components/ui/button"
import { getRamaActual } from "@/lib/data/catalogos"
import { getDictamenCompleto } from "@/lib/data/dictamenes"
import { fecha, fechaHora } from "@/lib/format"
import { ImprimirButton } from "./imprimir-button"

export async function generateMetadata(props: PageProps<"/dictamenes/[id]">): Promise<Metadata> {
  const d = await getDictamenCompleto((await props.params).id)
  return { title: d ? `Dictamen ${d.dictamen.folio}` : "Dictamen" }
}

/**
 * Vista del dictamen con el formato aproximado de la demo. «Imprimir / PDF»
 * usa el navegador. BACKEND: /api/dictamen/[id] generará Word/PDF con
 * docxtemplater + Gotenberg usando la plantilla .docx del cliente y estos
 * mismos campos (ver Plantilla.campos en el seed).
 */
export default async function DictamenPage(props: PageProps<"/dictamenes/[id]">) {
  const { id } = await props.params
  const [d, rama] = await Promise.all([getDictamenCompleto(id), getRamaActual()])
  if (!d) notFound()
  const { dictamen, inspeccion: x, responsable, tenant } = d

  const h = await headers()
  const origen = `${h.get("x-forwarded-proto") ?? "http"}://${h.get("host")}`
  const urlVerificacion = `${origen}/verificar/${dictamen.tokenQr}`
  const qr = await QRCode.toDataURL(urlVerificacion, { margin: 1, width: 240 })

  const ncs = x.respuestas
    .filter((r) => r.valor === "no_cumple")
    .map((r) => ({ ...r, reactivo: x.checklist.reactivos.find((c) => c.id === r.reactivoId)! }))

  return (
    <>
      <div className="no-print mb-4 flex flex-wrap items-center gap-2">
        <Button variant="ghost" render={<Link href={`/inspecciones/${x.id}`} />}>
          <ArrowLeftIcon /> Expediente
        </Button>
        <div className="ml-auto flex gap-2">
          <Button variant="outline" render={<a href={urlVerificacion} target="_blank" rel="noreferrer" />}>Verificación pública</Button>
          <ImprimirButton />
        </div>
      </div>

      <article className="mx-auto max-w-3xl space-y-6 rounded-lg border bg-white p-10 text-sm text-foreground shadow-sm print:border-0 print:shadow-none">
        <header className="flex items-start justify-between gap-6 border-b pb-4" style={{ borderColor: tenant.colorPrimario }}>
          <div>
            <p className="text-lg font-semibold" style={{ color: tenant.colorPrimario }}>{tenant.razonSocial}</p>
            <p className="text-xs text-muted-foreground">Unidad de Inspección acreditada por EMA · No. {tenant.acreditacionEma} · {tenant.ciudad}</p>
          </div>
          <div className="text-right">
            <p className="text-xs text-muted-foreground">Folio</p>
            <p className="font-mono font-semibold">{dictamen.folio}</p>
          </div>
        </header>

        <h1 className="text-center text-xl font-semibold tracking-wide">DICTAMEN DE VERIFICACIÓN</h1>
        <p className="text-center text-muted-foreground">{x.norma.clave} — {x.norma.titulo}</p>

        <dl className="grid grid-cols-2 gap-x-6 gap-y-2">
          {[
            ["Cliente", x.cliente.razonSocial],
            ["RFC", x.cliente.rfc],
            ["Instalación", `${x.instalacion.nombre} (${x.instalacion.tipo})`],
            ["Permiso", x.instalacion.permiso],
            ["Domicilio", `${x.instalacion.direccion}, ${x.instalacion.municipio}`],
            ["Fecha de visita", fechaHora(x.fecha)],
            ["Inspector", x.inspector.nombre],
            ["Emisión", fecha(dictamen.emitidoEn)],
          ].map(([k, v]) => (
            <div key={k}>
              <dt className="text-xs text-muted-foreground">{k}</dt>
              <dd>{v}</dd>
            </div>
          ))}
        </dl>

        <section className={`rounded-md p-4 ${dictamen.resultado === "cumple" ? "bg-positive-soft" : "bg-negative-soft"}`}>
          <p className="text-xs text-muted-foreground">Resultado</p>
          <p className="text-lg font-semibold">{dictamen.resultado === "cumple" ? "CUMPLE" : "NO CUMPLE"}</p>
          <p className="mt-1 text-foreground">{rama.textos.leyendaDictamen}</p>
          {dictamen.vigenteHasta && <p className="mt-1">Vigente hasta: <b>{fecha(dictamen.vigenteHasta)}</b></p>}
        </section>

        {ncs.length > 0 && (
          <section>
            <h2 className="mb-2 font-semibold">No conformidades</h2>
            <ol className="list-decimal space-y-1 pl-5">
              {ncs.map((n) => (
                <li key={n.reactivoId}>
                  <span className="font-mono text-xs">{n.reactivo.numeral}</span> {n.reactivo.texto}
                  {n.observacion && <span className="text-muted-foreground"> — {n.observacion}</span>}
                </li>
              ))}
            </ol>
          </section>
        )}

        <footer className="flex items-end justify-between gap-6 border-t pt-6">
          <div className="text-center">
            <div className="mb-1 h-12 w-56 border-b border-input" />
            <p className="font-medium">{responsable.nombre}</p>
            <p className="text-xs text-muted-foreground">Responsable técnico · aprobó el {fechaHora(dictamen.emitidoEn)}</p>
          </div>
          <div className="text-center">
            {/* eslint-disable-next-line @next/next/no-img-element -- QR generado como data URL */}
            <img src={qr} alt="Código QR de verificación" className="size-28" />
            <p className="text-[10px] text-muted-foreground">Verifica la autenticidad</p>
          </div>
        </footer>
      </article>
    </>
  )
}
