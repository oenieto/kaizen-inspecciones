"use client"

import { useState, useTransition } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { CheckIcon, FileBadgeIcon, Undo2Icon, XIcon } from "lucide-react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { Textarea } from "@/components/ui/textarea"
import type { EstatusInspeccion } from "@/lib/types"
import { cancelarCita } from "../../agenda/actions"
import { aprobarInspeccion, devolverInspeccion } from "../actions"

export function AccionesExpediente({
  id,
  estatus,
  dictamenId,
  puedeAprobar,
  puedeRevisar,
  puedeAgenda,
  completitud,
}: {
  id: string
  estatus: EstatusInspeccion
  dictamenId: string | null
  puedeAprobar: boolean
  puedeRevisar: boolean
  puedeAgenda: boolean
  completitud: number
}) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const [motivo, setMotivo] = useState("")
  const [devolverOpen, setDevolverOpen] = useState(false)

  const aprobar = () =>
    startTransition(async () => {
      const r = await aprobarInspeccion(id)
      if (!r.ok) return void toast.error(r.error)
      toast.success(`${r.mensaje}: ${r.data?.folio}`)
      router.push(`/dictamenes/${r.data?.dictamenId}`)
    })

  const devolver = () =>
    startTransition(async () => {
      const r = await devolverInspeccion(id, motivo)
      if (!r.ok) return void toast.error(r.error)
      toast.success(r.mensaje)
      setDevolverOpen(false)
    })

  const cancelar = () =>
    startTransition(async () => {
      const r = await cancelarCita(id)
      if (r.ok) toast.success(r.mensaje)
      else toast.error(r.error)
    })

  return (
    <>
      {dictamenId && (
        <Button variant="outline" render={<Link href={`/dictamenes/${dictamenId}`} />}>
          <FileBadgeIcon /> Ver dictamen
        </Button>
      )}
      {estatus === "programada" && puedeAgenda && (
        <Button variant="outline" onClick={cancelar} disabled={pending}>
          <XIcon /> Cancelar cita
        </Button>
      )}
      {estatus === "en_revision" && puedeRevisar && (
        <Dialog open={devolverOpen} onOpenChange={setDevolverOpen}>
          <DialogTrigger render={<Button variant="outline" />}>
            <Undo2Icon /> Devolver a campo
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Devolver al inspector</DialogTitle>
              <DialogDescription>La inspección regresa a «En curso» para completar o corregir la captura.</DialogDescription>
            </DialogHeader>
            <Textarea value={motivo} onChange={(e) => setMotivo(e.target.value)} placeholder="Motivo (p. ej. falta foto del regulador)" />
            <DialogFooter>
              <Button onClick={devolver} disabled={pending}>Devolver</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
      {estatus === "en_revision" && puedeAprobar && (
        <Button onClick={aprobar} disabled={pending} title={completitud < 100 ? "El expediente tiene faltantes; revisa antes de aprobar" : undefined}>
          <CheckIcon /> {pending ? "Emitiendo…" : "Aprobar y emitir dictamen"}
        </Button>
      )}
    </>
  )
}
