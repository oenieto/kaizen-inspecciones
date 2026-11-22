import { Badge } from "@/components/ui/badge"
import { cn } from "@/lib/utils"
import type { EstatusInspeccion } from "@/lib/types"

/** Tonos por estatus (núcleo del producto). Las etiquetas vienen de la rama. */
export const colorEstatus: Record<EstatusInspeccion, string> = {
  programada: "bg-info-soft text-info",
  en_curso: "bg-warning-soft text-warning",
  en_revision: "bg-review-soft text-review",
  dictaminada: "bg-positive-soft text-positive",
  cancelada: "bg-muted text-muted-foreground line-through",
}

/** Color sólido para eventos del calendario y marcadores */
export const hexEstatus: Record<EstatusInspeccion, string> = {
  programada: "#276ef1",
  en_curso: "#b07a00",
  en_revision: "#6c4bd1",
  dictaminada: "#0b7a43",
  cancelada: "#afafaf",
}

export function EstatusBadge({ estatus, etiqueta }: { estatus: EstatusInspeccion; etiqueta: string }) {
  return (
    <Badge variant="secondary" className={cn("h-6 gap-1.5 rounded-full border-0 px-2.5 font-medium", colorEstatus[estatus])}>
      <span aria-hidden className="size-1.5 rounded-full bg-current" />
      {etiqueta}
    </Badge>
  )
}
