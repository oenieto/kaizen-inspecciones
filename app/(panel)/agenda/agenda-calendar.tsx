"use client"

import { useMemo, useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import FullCalendar from "@fullcalendar/react"
import dayGridPlugin from "@fullcalendar/daygrid"
import timeGridPlugin from "@fullcalendar/timegrid"
import interactionPlugin from "@fullcalendar/interaction"
import esLocale from "@fullcalendar/core/locales/es"
import type { EventDropArg } from "@fullcalendar/core"
import { toast } from "sonner"
import { Card, CardContent } from "@/components/ui/card"
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select"
import { hexEstatus } from "@/components/estatus-badge"
import type { EstatusInspeccion, InspeccionFila } from "@/lib/types"
import { reprogramarCita } from "./actions"

export function AgendaCalendar({
  citas,
  inspectores,
  etiquetas,
  editable,
}: {
  citas: InspeccionFila[]
  inspectores: { id: string; nombre: string }[]
  etiquetas: Record<EstatusInspeccion, string>
  editable: boolean
}) {
  const router = useRouter()
  const [inspector, setInspector] = useState("")
  const [, startTransition] = useTransition()

  const eventos = useMemo(
    () =>
      citas
        .filter((c) => !inspector || c.inspectorId === inspector)
        .map((c) => ({
          id: c.id,
          title: `${c.cliente} · ${c.instalacion}`,
          start: c.fecha,
          end: new Date(new Date(c.fecha).getTime() + 2 * 3_600_000).toISOString(),
          backgroundColor: `${hexEstatus[c.estatus]}1f`,
          borderColor: hexEstatus[c.estatus],
          textColor: "var(--foreground)",
          editable: editable && c.estatus === "programada",
          extendedProps: { inspector: c.inspector, estatus: c.estatus },
        })),
    [citas, inspector, editable],
  )

  function onDrop(arg: EventDropArg) {
    const start = arg.event.start
    if (!start) return arg.revert()
    startTransition(async () => {
      const r = await reprogramarCita(arg.event.id, start.toISOString())
      if (r.ok) toast.success(r.mensaje)
      else {
        arg.revert()
        toast.error(r.error)
      }
    })
  }

  return (
    <Card>
      <CardContent className="space-y-3">
        <div className="flex flex-wrap items-center gap-3">
          <NativeSelect value={inspector} onChange={(e) => setInspector(e.target.value)} aria-label="Filtrar por inspector">
            <NativeSelectOption value="">Todos los inspectores</NativeSelectOption>
            {inspectores.map((i) => (
              <NativeSelectOption key={i.id} value={i.id}>{i.nombre}</NativeSelectOption>
            ))}
          </NativeSelect>
          <ul className="flex flex-wrap gap-3 text-xs text-muted-foreground">
            {(Object.keys(etiquetas) as EstatusInspeccion[]).map((e) => (
              <li key={e} className="flex items-center gap-1.5">
                <span className="size-2.5 rounded-full" style={{ background: hexEstatus[e] }} />
                {etiquetas[e]}
              </li>
            ))}
          </ul>
        </div>
        <div className="agenda-calendar min-h-[720px]">
          <FullCalendar
            plugins={[dayGridPlugin, timeGridPlugin, interactionPlugin]}
            locale={esLocale}
            initialView="timeGridWeek"
            headerToolbar={{ left: "prev,next today", center: "title", right: "dayGridMonth,timeGridWeek,timeGridDay" }}
            slotMinTime="07:00:00"
            slotMaxTime="20:00:00"
            weekends={[0, 6].includes(new Date().getDay())}
            allDaySlot={false}
            height="auto"
            nowIndicator
            events={eventos}
            eventDrop={onDrop}
            eventClick={(arg) => router.push(`/inspecciones/${arg.event.id}`)}
            eventContent={(arg) => (
              <div className="overflow-hidden px-1 text-[11px] leading-tight">
                <div className="font-medium">{arg.timeText}</div>
                <div className="truncate">{arg.event.title}</div>
                <div className="truncate opacity-80">{String(arg.event.extendedProps.inspector)}</div>
              </div>
            )}
          />
        </div>
      </CardContent>
    </Card>
  )
}
