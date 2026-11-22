"use client"

import { useState, useTransition, type ReactNode } from "react"
import { PlusIcon } from "lucide-react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import type { ActionResult } from "@/lib/action-result"

/**
 * Diálogo de alta: envía los campos del form como objeto a una server action
 * (que valida con zod) y muestra el resultado en un toast.
 */
export function FormDialog({
  trigger,
  title,
  description,
  submitLabel = "Guardar",
  action,
  children,
}: {
  trigger: string
  title: string
  description?: string
  submitLabel?: string
  action: (data: Record<string, string>) => Promise<ActionResult<unknown>>
  children: ReactNode
}) {
  const [open, setOpen] = useState(false)
  const [pending, startTransition] = useTransition()

  function onSubmit(formData: FormData) {
    const data = Object.fromEntries([...formData.entries()].map(([k, v]) => [k, String(v)]))
    startTransition(async () => {
      const r = await action(data)
      if (r.ok) {
        toast.success(r.mensaje ?? "Guardado")
        setOpen(false)
      } else toast.error(r.error)
    })
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button />}>
        <PlusIcon /> {trigger}
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          {description && <DialogDescription>{description}</DialogDescription>}
        </DialogHeader>
        <form action={onSubmit} className="space-y-4">
          {children}
          <DialogFooter>
            <Button type="submit" disabled={pending}>{pending ? "Guardando…" : submitLabel}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

/** Campo de texto con etiqueta, para usar dentro de FormDialog. */
export function TextField({ label, name, className, ...props }: { label: string; name: string } & React.ComponentProps<typeof Input>) {
  return (
    <div className={`space-y-2 ${className ?? ""}`}>
      <Label htmlFor={name}>{label}</Label>
      <Input id={name} name={name} {...props} />
    </div>
  )
}
