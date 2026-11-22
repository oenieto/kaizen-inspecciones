"use client"

import { useEffect, useRef } from "react"
import { EraserIcon } from "lucide-react"

/** Firma en pantalla con puntero (dedo, lápiz o mouse). Devuelve un PNG en data URL. */
export function FirmaPad({ value, onChange, label }: { value: string | null; onChange: (dataUrl: string | null) => void; label: string }) {
  const ref = useRef<HTMLCanvasElement>(null)
  const dibujando = useRef(false)

  useEffect(() => {
    const c = ref.current
    if (!c) return
    const ratio = window.devicePixelRatio || 1
    c.width = c.offsetWidth * ratio
    c.height = c.offsetHeight * ratio
    const ctx = c.getContext("2d")!
    ctx.scale(ratio, ratio)
    ctx.lineWidth = 2.2
    ctx.lineCap = "round"
    ctx.strokeStyle = "#111827"
    if (value) {
      const img = new Image()
      img.onload = () => ctx.drawImage(img, 0, 0, c.offsetWidth, c.offsetHeight)
      img.src = value
    }
    // Solo al montar: el valor inicial viene de IndexedDB
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const pos = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const r = e.currentTarget.getBoundingClientRect()
    return [e.clientX - r.left, e.clientY - r.top] as const
  }

  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between">
        <span className="text-xs font-medium text-muted-foreground">{label}</span>
        <button
          type="button"
          className="flex items-center gap-1 text-xs text-muted-foreground"
          onClick={() => {
            const c = ref.current!
            c.getContext("2d")!.clearRect(0, 0, c.width, c.height)
            onChange(null)
          }}
        >
          <EraserIcon className="size-3" /> Borrar
        </button>
      </div>
      <canvas
        ref={ref}
        aria-label={label}
        className="h-32 w-full touch-none rounded-lg border border-dashed bg-background"
        onPointerDown={(e) => {
          dibujando.current = true
          e.currentTarget.setPointerCapture(e.pointerId)
          const ctx = e.currentTarget.getContext("2d")!
          ctx.beginPath()
          ctx.moveTo(...pos(e))
        }}
        onPointerMove={(e) => {
          if (!dibujando.current) return
          const ctx = e.currentTarget.getContext("2d")!
          ctx.lineTo(...pos(e))
          ctx.stroke()
        }}
        onPointerUp={(e) => {
          dibujando.current = false
          onChange(e.currentTarget.toDataURL("image/png"))
        }}
      />
    </div>
  )
}
