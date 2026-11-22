"use client"

import { FormDialog, TextField } from "@/components/form-dialog"
import { Label } from "@/components/ui/label"
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select"
import { crearCliente, crearInstalacion } from "./actions"

export function ClienteDialog({ giros }: { giros: string[] }) {
  return (
    <FormDialog
      trigger="Nuevo cliente"
      title="Nuevo cliente"
      action={(d) => crearCliente({ razonSocial: d.razonSocial, rfc: d.rfc, giro: d.giro, contacto: d.contacto, telefono: d.telefono, email: d.email })}
    >
      <TextField label="Razón social" name="razonSocial" required />
      <div className="grid grid-cols-2 gap-3">
        <TextField label="RFC" name="rfc" required maxLength={13} className="uppercase" />
        <div className="space-y-2">
          <Label htmlFor="giro">Giro</Label>
          <NativeSelect id="giro" name="giro" className="w-full" required>
            {giros.map((g) => <NativeSelectOption key={g} value={g}>{g}</NativeSelectOption>)}
          </NativeSelect>
        </div>
      </div>
      <TextField label="Contacto" name="contacto" required />
      <div className="grid grid-cols-2 gap-3">
        <TextField label="Teléfono" name="telefono" type="tel" required />
        <TextField label="Correo" name="email" type="email" required />
      </div>
    </FormDialog>
  )
}

export function InstalacionDialog({ clienteId, tipos }: { clienteId: string; tipos: string[] }) {
  return (
    <FormDialog
      trigger="Agregar instalación"
      title="Nueva instalación"
      description="Las coordenadas ubican la instalación en la ruta del día."
      action={(d) => crearInstalacion({ clienteId, nombre: d.nombre, tipo: d.tipo, direccion: d.direccion, municipio: d.municipio, lat: d.lat, lng: d.lng, permiso: d.permiso })}
    >
      <div className="grid grid-cols-2 gap-3">
        <TextField label="Nombre" name="nombre" required placeholder="Planta principal" />
        <div className="space-y-2">
          <Label htmlFor="tipo">Tipo</Label>
          <NativeSelect id="tipo" name="tipo" className="w-full">
            {tipos.map((t) => <NativeSelectOption key={t} value={t}>{t}</NativeSelectOption>)}
          </NativeSelect>
        </div>
      </div>
      <TextField label="Dirección" name="direccion" required />
      <div className="grid grid-cols-3 gap-3">
        <TextField label="Municipio" name="municipio" required defaultValue="Querétaro" />
        <TextField label="Latitud" name="lat" type="number" step="any" required defaultValue="20.5888" />
        <TextField label="Longitud" name="lng" type="number" step="any" required defaultValue="-100.3899" />
      </div>
      <TextField label="Permiso / constancia" name="permiso" placeholder="PER-GN-0000" />
    </FormDialog>
  )
}
