"use client"

import { useEffect } from "react"
import { useRouter } from "next/navigation"
import { useLiveQuery } from "dexie-react-hooks"
import { CloudOffIcon, CloudUploadIcon, WifiIcon } from "lucide-react"
import { toast } from "sonner"
import { capturasDb } from "@/lib/offline/db"
import { setSimularOffline, useEnLinea } from "@/lib/offline/red"
import { sincronizarPendientes } from "@/lib/offline/sync"
import { cn } from "@/lib/utils"

/**
 * Indicador de red de la PWA: muestra pendientes, permite simular sin
 * conexión y dispara la cola de sincronización al recuperar señal.
 */
export function BarraRed() {
  const router = useRouter()
  const enLinea = useEnLinea()
  const pendientes = useLiveQuery(() => capturasDb.where("estado").equals("pendiente").count(), [], 0)

  useEffect(() => {
    if (!enLinea) return
    let activo = true
    sincronizarPendientes().then(({ enviadas, errores }) => {
      if (!activo) return
      if (enviadas) {
        toast.success(`${enviadas} inspección(es) sincronizada(s)`)
        router.refresh()
      }
      if (errores) toast.error(`${errores} no se pudieron sincronizar; se reintentará`)
    })
    return () => {
      activo = false
    }
  }, [enLinea, router])

  useEffect(() => {
    if (process.env.NODE_ENV === "production" && "serviceWorker" in navigator) {
      navigator.serviceWorker.register("/sw.js", { scope: "/", updateViaCache: "none" }).catch(() => {})
    }
  }, [])

  return (
    <div className="flex items-center gap-2">
      {pendientes > 0 && (
        <span className="flex h-7 items-center gap-1 rounded-full bg-[#ffc043] px-2.5 text-[11px] font-semibold whitespace-nowrap text-black" title="Capturas finalizadas pendientes de enviar">
          <CloudUploadIcon className={cn("size-3", enLinea && "animate-pulse")} /> {pendientes} en cola
        </span>
      )}
      <button
        type="button"
        onClick={() => setSimularOffline(enLinea)}
        className={cn(
          "flex h-7 items-center gap-1.5 rounded-full px-3 text-xs font-semibold whitespace-nowrap transition-colors",
          enLinea ? "bg-white/12 text-white hover:bg-white/20" : "bg-[#de1135] text-white",
        )}
        title="Tocar para simular modo avión"
      >
        {enLinea ? <WifiIcon className="size-3" /> : <CloudOffIcon className="size-3" />}
        {enLinea ? "En línea" : "Sin conexión"}
      </button>
    </div>
  )
}
