import type { Metadata } from "next"
import { PageHeader } from "@/components/page-header"
import { requireSession } from "@/lib/auth"
import { getRamaActual, listInspectores } from "@/lib/data/catalogos"
import { listInstalaciones } from "@/lib/data/clientes"
import { listAgenda } from "@/lib/data/inspecciones"
import { puede } from "@/lib/permisos"
import { AgendaCalendar } from "./agenda-calendar"
import { NuevaCitaDialog } from "./nueva-cita-dialog"
import { RutaDelDia } from "./ruta-del-dia"

export const metadata: Metadata = { title: "Agenda" }

export default async function AgendaPage() {
  const { usuario } = await requireSession()
  const [citas, instalaciones, inspectores, rama] = await Promise.all([
    listAgenda(),
    listInstalaciones(),
    listInspectores(),
    getRamaActual(),
  ])
  const editable = puede(usuario.rol, "agenda.editar")

  return (
    <>
      <PageHeader title="Agenda de verificaciones" description="Arrastra una cita programada para reprogramarla. Clic para abrir su expediente.">
        {editable && (
          <NuevaCitaDialog
            instalaciones={instalaciones.map((i) => ({ id: i.id, label: `${i.cliente} — ${i.nombre}` }))}
            inspectores={inspectores.map((i) => ({ id: i.id, nombre: i.nombre }))}
          />
        )}
      </PageHeader>
      <div className="grid gap-4 xl:grid-cols-[1fr_380px]">
        <AgendaCalendar
          citas={citas}
          inspectores={inspectores.map((i) => ({ id: i.id, nombre: i.nombre }))}
          etiquetas={rama.estatus}
          editable={editable}
        />
        <RutaDelDia
          citas={citas
            .filter((c) => c.estatus !== "cancelada")
            .map((c) => {
              const inst = instalaciones.find((i) => i.id === c.instalacionId)
              return { ...c, lat: inst?.lat ?? 0, lng: inst?.lng ?? 0, direccion: inst?.direccion ?? "" }
            })}
          inspectores={inspectores.map((i) => ({ id: i.id, nombre: i.nombre }))}
          mapboxToken={process.env.NEXT_PUBLIC_MAPBOX_TOKEN ?? ""}
        />
      </div>
    </>
  )
}
