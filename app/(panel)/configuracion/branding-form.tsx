"use client"

import { useTransition } from "react"
import { RotateCcwIcon } from "lucide-react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { TextField } from "@/components/form-dialog"
import { Label } from "@/components/ui/label"
import type { Tenant } from "@/lib/types"
import { guardarBranding, reiniciarDemo } from "./actions"

export function BrandingForm({ tenant }: { tenant: Tenant }) {
  const [pending, startTransition] = useTransition()

  function onSubmit(fd: FormData) {
    startTransition(async () => {
      const r = await guardarBranding({
        nombreCorto: String(fd.get("nombreCorto")),
        razonSocial: String(fd.get("razonSocial")),
        acreditacionEma: String(fd.get("acreditacionEma")),
        colorPrimario: String(fd.get("colorPrimario")),
        logoUrl: String(fd.get("logoUrl")),
      })
      if (r.ok) toast.success(r.mensaje)
      else toast.error(r.error)
    })
  }

  return (
    <form action={onSubmit} className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-2">
        <TextField label="Nombre corto" name="nombreCorto" defaultValue={tenant.nombreCorto} required />
        <TextField label="Acreditación EMA" name="acreditacionEma" defaultValue={tenant.acreditacionEma} required />
      </div>
      <TextField label="Razón social" name="razonSocial" defaultValue={tenant.razonSocial} required />
      <div className="grid gap-3 sm:grid-cols-[160px_1fr]">
        <div className="space-y-2">
          <Label htmlFor="colorPrimario">Color primario</Label>
          <input id="colorPrimario" name="colorPrimario" type="color" defaultValue={tenant.colorPrimario} className="h-8 w-full cursor-pointer rounded-md border" />
        </div>
        <TextField label="URL del logo (opcional)" name="logoUrl" type="url" defaultValue={tenant.logoUrl ?? ""} placeholder="https://…" />
      </div>
      <Button type="submit" disabled={pending}>{pending ? "Guardando…" : "Guardar branding"}</Button>
    </form>
  )
}

export function ReiniciarDemo() {
  const [pending, startTransition] = useTransition()
  return (
    <Button
      variant="outline"
      disabled={pending}
      onClick={() =>
        startTransition(async () => {
          if (!window.confirm("¿Reiniciar todos los datos de la demo? Se pierden los cambios hechos.")) return
          const r = await reiniciarDemo()
          if (r.ok) toast.success(r.mensaje)
          else toast.error(r.error)
        })
      }
    >
      <RotateCcwIcon /> Reiniciar datos de demo
    </Button>
  )
}
