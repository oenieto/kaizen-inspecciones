import Link from "next/link"
import { ChevronRightIcon, MapPinIcon } from "lucide-react"
import { EstatusBadge } from "@/components/estatus-badge"
import { MapaRuta } from "@/components/mapa-ruta"
import { requireSession } from "@/lib/auth"
import { getRamaActual, listInspectores } from "@/lib/data/catalogos"
import { listRutaDelDia } from "@/lib/data/inspecciones"
import { diaLargo, hora } from "@/lib/format"

/** Ruta del día del inspector. Un admin ve la del inspector elegido (?inspector=). */
export default async function CampoPage(props: PageProps<"/campo">) {
  const { usuario } = await requireSession()
  const sp = await props.searchParams
  const inspectores = usuario.rol === "admin" ? await listInspectores() : []
  const inspectorId = usuario.rol === "inspector" ? usuario.id : typeof sp.inspector === "string" ? sp.inspector : inspectores[0]?.id
  const [citas, rama] = await Promise.all([listRutaDelDia(inspectorId, new Date()), getRamaActual()])

  return (
    <div className="space-y-4">
      <div>
        <p className="text-xs text-muted-foreground first-letter:uppercase">{diaLargo(new Date())}</p>
        <h1 className="text-[28px] leading-tight font-bold tracking-tight">Ruta del día</h1>
        <p className="text-sm text-muted-foreground">{citas.length} {citas.length === 1 ? "visita" : "visitas"}</p>
      </div>

      {usuario.rol === "admin" && (
        <form className="flex gap-2 text-sm">
          <select name="inspector" defaultValue={inspectorId} className="flex-1 rounded-md border bg-background px-2 py-1.5">
            {inspectores.map((i) => <option key={i.id} value={i.id}>{i.nombre}</option>)}
          </select>
          <button type="submit" className="rounded-md border bg-background px-3">Ver</button>
        </form>
      )}

      <MapaRuta
        className="h-52"
        token={process.env.NEXT_PUBLIC_MAPBOX_TOKEN ?? ""}
        paradas={citas.map((c) => ({ id: c.id, lat: c.instalacion.lat, lng: c.instalacion.lng, titulo: c.cliente.razonSocial }))}
      />

      <ol className="space-y-2">
        {citas.map((c, i) => (
          <li key={c.id}>
            <Link href={`/campo/${c.id}`} className="flex items-center gap-3 rounded-xl bg-background p-4 ring-1 ring-border transition-colors active:bg-muted">
              <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-primary text-sm font-bold text-primary-foreground">{i + 1}</span>
              <div className="min-w-0 flex-1 space-y-1">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-[15px] font-bold tabular-nums">{hora(c.fecha)}</span>
                  <EstatusBadge estatus={c.estatus} etiqueta={rama.estatus[c.estatus]} />
                </div>
                <p className="truncate text-sm font-medium">{c.cliente.razonSocial}</p>
                <p className="flex items-center gap-1 truncate text-xs text-muted-foreground">
                  <MapPinIcon className="size-3 shrink-0" /> {c.instalacion.nombre} · {c.instalacion.direccion}
                </p>
              </div>
              <ChevronRightIcon className="size-4 text-muted-foreground" />
            </Link>
          </li>
        ))}
        {citas.length === 0 && <p className="rounded-xl border border-dashed p-8 text-center text-sm text-muted-foreground">No tienes visitas programadas hoy.</p>}
      </ol>
    </div>
  )
}
