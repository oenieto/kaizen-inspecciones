import Link from "next/link"
import { notFound } from "next/navigation"
import { ArrowLeftIcon } from "lucide-react"
import { EstatusBadge } from "@/components/estatus-badge"
import { requireSession } from "@/lib/auth"
import { getRamaActual } from "@/lib/data/catalogos"
import { getInspeccionDetalle } from "@/lib/data/inspecciones"
import { hora } from "@/lib/format"
import { Captura } from "./captura"

export default async function CapturaPage(props: PageProps<"/campo/[inspeccionId]">) {
  const { inspeccionId } = await props.params
  const [{ usuario }, x, rama] = await Promise.all([requireSession(), getInspeccionDetalle(inspeccionId), getRamaActual()])
  if (!x || (usuario.rol === "inspector" && x.inspectorId !== usuario.id)) notFound()
  const editable = x.estatus === "programada" || x.estatus === "en_curso"

  return (
    <div className="space-y-4">
      <Link href="/campo" className="inline-flex items-center gap-1 text-sm text-muted-foreground">
        <ArrowLeftIcon className="size-4" /> Ruta del día
      </Link>
      <div className="space-y-1">
        <div className="flex items-center justify-between gap-2">
          <span className="text-sm text-muted-foreground tabular-nums">{hora(x.fecha)} · {x.norma.clave}</span>
          <EstatusBadge estatus={x.estatus} etiqueta={rama.estatus[x.estatus]} />
        </div>
        <h1 className="text-lg leading-tight font-semibold">{x.cliente.razonSocial}</h1>
        <p className="text-sm text-muted-foreground">{x.instalacion.nombre} · {x.instalacion.direccion}, {x.instalacion.municipio}</p>
        <p className="text-xs text-muted-foreground">Contacto: {x.cliente.contacto} · {x.cliente.telefono}</p>
      </div>
      {editable ? (
        <Captura
          inspeccionId={x.id}
          reactivos={x.checklist.reactivos}
          respuestasIniciales={x.respuestas}
          observacionesIniciales={x.observaciones}
          nombreContacto={x.cliente.contacto}
        />
      ) : (
        <p className="rounded-xl border bg-background p-6 text-center text-sm text-muted-foreground">
          Esta inspección ya fue enviada ({rama.estatus[x.estatus]}). No admite más captura en campo.
        </p>
      )}
    </div>
  )
}
