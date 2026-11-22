"use client"

import { FormDialog, TextField } from "@/components/form-dialog"
import { Label } from "@/components/ui/label"
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select"
import { crearCita } from "./actions"

function mananaALas9() {
  const d = new Date(Date.now() + 86_400_000)
  const pad = (n: number) => String(n).padStart(2, "0")
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T09:00`
}

export function NuevaCitaDialog({
  instalaciones,
  inspectores,
}: {
  instalaciones: { id: string; label: string }[]
  inspectores: { id: string; nombre: string }[]
}) {
  return (
    <FormDialog
      trigger="Nueva cita"
      title="Nueva cita de verificación"
      description="Se crea en estatus «Programada» y aparece en la app del inspector."
      submitLabel="Programar"
      action={(d) => crearCita({ instalacionId: d.instalacionId, inspectorId: d.inspectorId, fecha: d.fecha, duracionMin: d.duracionMin })}
    >
      <div className="space-y-2">
        <Label htmlFor="instalacionId">Cliente e instalación</Label>
        <NativeSelect id="instalacionId" name="instalacionId" required className="w-full" defaultValue="">
          <NativeSelectOption value="" disabled>Selecciona…</NativeSelectOption>
          {instalaciones.map((i) => (
            <NativeSelectOption key={i.id} value={i.id}>{i.label}</NativeSelectOption>
          ))}
        </NativeSelect>
      </div>
      <div className="space-y-2">
        <Label htmlFor="inspectorId">Inspector</Label>
        <NativeSelect id="inspectorId" name="inspectorId" required className="w-full" defaultValue={inspectores[0]?.id}>
          {inspectores.map((i) => (
            <NativeSelectOption key={i.id} value={i.id}>{i.nombre}</NativeSelectOption>
          ))}
        </NativeSelect>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <TextField label="Fecha y hora" name="fecha" type="datetime-local" required defaultValue={mananaALas9()} />
        <TextField label="Duración (min)" name="duracionMin" type="number" min={30} max={480} step={30} defaultValue={120} />
      </div>
    </FormDialog>
  )
}
