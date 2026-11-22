"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import { useRouter } from "next/navigation"
import { CameraIcon, CloudOffIcon, SendIcon, Trash2Icon } from "lucide-react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Progress } from "@/components/ui/progress"
import { FirmaPad } from "@/components/firma-pad"
import { MAX_FOTOS, agregarFotos, aplicarRespuesta, porcentajeAvance } from "@/lib/offline/captura"
import { capturasDb, type CapturaLocal } from "@/lib/offline/db"
import { prepararFoto } from "@/lib/offline/fotos"
import { estaEnLinea, useEnLinea } from "@/lib/offline/red"
import { enviarCaptura } from "@/lib/offline/sync"
import { cn } from "@/lib/utils"
import type { Reactivo, RespuestaChecklist, ValorCumple } from "@/lib/types"

const opciones: { valor: ValorCumple; label: string; activo: string }[] = [
  { valor: "cumple", label: "Cumple", activo: "bg-black text-white border-black" },
  { valor: "no_cumple", label: "No cumple", activo: "bg-[#de1135] text-white border-[#de1135]" },
  { valor: "na", label: "N/A", activo: "bg-[#5e5e5e] text-white border-[#5e5e5e]" },
]

function respondido(r: Reactivo, a?: RespuestaChecklist) {
  if (!a) return false
  if (r.tipo === "medicion") return a.medicion != null
  if (r.tipo === "texto") return Boolean(a.observacion?.trim())
  return a.valor != null
}

export function Captura({
  inspeccionId,
  reactivos,
  respuestasIniciales,
  observacionesIniciales,
  nombreContacto,
}: {
  inspeccionId: string
  reactivos: Reactivo[]
  respuestasIniciales: RespuestaChecklist[]
  observacionesIniciales: string
  nombreContacto: string
}) {
  const router = useRouter()
  const enLinea = useEnLinea()
  const [c, setC] = useState<CapturaLocal | null>(null)
  const [enviando, setEnviando] = useState(false)
  const [procesandoFoto, setProcesandoFoto] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)

  // Carga lo guardado en el dispositivo; si no hay, parte de lo que trae el servidor
  useEffect(() => {
    capturasDb.get(inspeccionId).then((local) =>
      setC(
        local ?? {
          inspeccionId,
          respuestas: respuestasIniciales,
          observaciones: observacionesIniciales,
          fotos: [],
          firmaCliente: null,
          firmaInspector: null,
          nombreFirmaCliente: nombreContacto,
          estado: "borrador",
          actualizadaEn: new Date().toISOString(),
        },
      ),
    )
  }, [inspeccionId, respuestasIniciales, observacionesIniciales, nombreContacto])

  // Autoguardado local en cada cambio. El cambio se calcula siempre sobre el
  // estado más reciente (`prev`): con toques seguidos o tras procesar una foto,
  // el `c` del render anterior ya está viejo y pisaría respuestas.
  function actualizar(cambio: Partial<CapturaLocal> | ((prev: CapturaLocal) => Partial<CapturaLocal>)) {
    setC((prev) => {
      if (!prev) return prev
      const parcial = typeof cambio === "function" ? cambio(prev) : cambio
      const next = { ...prev, ...parcial, actualizadaEn: new Date().toISOString() }
      capturasDb.put(next)
      return next
    })
  }

  function responder(reactivoId: string, cambio: Partial<RespuestaChecklist>) {
    actualizar((prev) => ({ respuestas: aplicarRespuesta(prev.respuestas, reactivoId, cambio) }))
  }

  const secciones = useMemo(() => [...new Set(reactivos.map((r) => r.seccion))], [reactivos])
  const mapa = new Map(c?.respuestas.map((r) => [r.reactivoId, r]))
  const requeridos = reactivos.filter((r) => r.requerido)
  const listos = requeridos.filter((r) => respondido(r, mapa.get(r.id))).length
  const progreso = porcentajeAvance(listos, requeridos.length)

  async function tomarFotos(files: FileList | null) {
    if (!files?.length || !c) return
    const espacio = MAX_FOTOS - c.fotos.length
    if (espacio <= 0) return void toast.error(`Máximo ${MAX_FOTOS} fotos por inspección`)
    const elegidas = [...files].slice(0, espacio)
    if (elegidas.length < files.length) toast.warning(`Solo caben ${espacio} foto(s) más (máximo ${MAX_FOTOS})`)
    setProcesandoFoto(true)
    try {
      const nuevas = await Promise.all(elegidas.map(prepararFoto))
      actualizar((prev) => ({ fotos: agregarFotos(prev.fotos, nuevas).fotos }))
      if (nuevas.some((f) => f.lat == null)) toast.warning("Sin permiso de ubicación: la foto se guardó sin coordenadas")
    } catch {
      toast.error("No se pudo procesar la foto")
    } finally {
      setProcesandoFoto(false)
      if (fileRef.current) fileRef.current.value = ""
    }
  }

  async function finalizar() {
    if (!c) return
    const faltantes = requeridos.filter((r) => !respondido(r, mapa.get(r.id)))
    if (faltantes.length) return void toast.error(`Faltan ${faltantes.length} reactivos obligatorios (p. ej. ${faltantes[0].numeral})`)
    const ncSinObs = c.respuestas.filter((r) => r.valor === "no_cumple" && !r.observacion?.trim())
    if (ncSinObs.length) return void toast.error("Cada «No cumple» necesita una observación")
    if (!c.firmaCliente || !c.firmaInspector) return void toast.error("Faltan las firmas del acta")

    const pendiente: CapturaLocal = { ...c, estado: "pendiente", actualizadaEn: new Date().toISOString() }
    await capturasDb.put(pendiente)
    setC(pendiente)

    if (!estaEnLinea()) {
      toast.info("Guardado en el dispositivo. Se enviará solo al recuperar señal.")
      return router.push("/campo")
    }
    setEnviando(true)
    try {
      const r = await enviarCaptura(pendiente, true)
      if (!r.ok) return void toast.error(r.error)
      toast.success(r.mensaje)
      router.push("/campo")
      router.refresh()
    } catch {
      toast.info("Sin señal estable: quedó en cola y se enviará al reconectar.")
      router.push("/campo")
    } finally {
      setEnviando(false)
    }
  }

  if (!c) return <p className="text-sm text-muted-foreground">Cargando captura…</p>

  return (
    <div className="space-y-5 pb-28">
      <div className="sticky top-16 z-[5] -mx-4 space-y-1.5 bg-surface/95 px-4 py-3 backdrop-blur">
        <div className="flex justify-between text-xs text-muted-foreground">
          <span>Obligatorios {listos}/{requeridos.length}</span>
          {!enLinea && <span className="flex items-center gap-1 text-negative"><CloudOffIcon className="size-3" /> Guardando en el dispositivo</span>}
        </div>
        <Progress value={progreso} />
      </div>

      {c.estado === "pendiente" && (
        <p className="rounded-lg bg-warning-soft p-3 text-sm text-warning">Finalizada y en cola de sincronización. Puedes seguir corrigiendo hasta que se envíe.</p>
      )}

      {secciones.map((sec) => (
        <section key={sec} className="space-y-2">
          <h2 className="text-sm font-semibold text-foreground">{sec}</h2>
          {reactivos
            .filter((r) => r.seccion === sec)
            .map((r) => {
              const a = mapa.get(r.id)
              return (
                <div key={r.id} className={cn("space-y-3 rounded-xl bg-background p-4 ring-1 ring-border", a?.valor === "no_cumple" && "ring-2 ring-[#de1135]")}>
                  <p className="text-sm">
                    <span className="mr-1 font-mono text-xs text-muted-foreground">{r.numeral}</span>
                    {r.texto}
                    {r.requerido && <span className="text-negative"> *</span>}
                  </p>
                  {r.tipo === "cumple" && (
                    <div className="grid grid-cols-3 gap-1.5" role="radiogroup" aria-label={r.texto}>
                      {opciones.map((o) => (
                        <button
                          key={o.valor}
                          type="button"
                          role="radio"
                          aria-checked={a?.valor === o.valor}
                          onClick={() => responder(r.id, { valor: o.valor })}
                          className={cn("min-h-11 rounded-lg border text-sm font-medium transition-colors", a?.valor === o.valor ? o.activo : "border-transparent bg-muted text-foreground")}
                        >
                          {o.label}
                        </button>
                      ))}
                    </div>
                  )}
                  {r.tipo === "medicion" && (
                    <label className="flex items-center gap-2">
                      <input
                        type="number"
                        inputMode="decimal"
                        step="any"
                        value={a?.medicion ?? ""}
                        onChange={(e) => responder(r.id, { medicion: e.target.value === "" ? null : Number(e.target.value), valor: "cumple" })}
                        className="w-32 rounded-lg border px-3 py-2 text-sm"
                        aria-label={`${r.texto} (${r.unidad})`}
                      />
                      <span className="text-sm text-muted-foreground">{r.unidad}</span>
                    </label>
                  )}
                  {(r.tipo === "texto" || a?.valor === "no_cumple") && (
                    <textarea
                      value={a?.observacion ?? ""}
                      onChange={(e) => responder(r.id, { observacion: e.target.value })}
                      placeholder={r.tipo === "texto" ? "Escribe tus observaciones" : "Describe la no conformidad"}
                      className="min-h-16 w-full rounded-lg border px-3 py-2 text-sm"
                    />
                  )}
                </div>
              )
            })}
        </section>
      ))}

      <section className="space-y-2">
        <h2 className="text-sm font-semibold text-foreground">Evidencias fotográficas</h2>
        <div className="grid grid-cols-3 gap-2">
          {c.fotos.map((f) => (
            <div key={f.id} className="relative">
              {/* eslint-disable-next-line @next/next/no-img-element -- foto local en data URL */}
              <img src={f.dataUrl} alt={f.nombre} className="aspect-square w-full rounded-lg object-cover" />
              <button
                type="button"
                onClick={() => actualizar((prev) => ({ fotos: prev.fotos.filter((x) => x.id !== f.id) }))}
                className="absolute top-1 right-1 rounded-full bg-black/60 p-1 text-white"
                aria-label="Quitar foto"
              >
                <Trash2Icon className="size-3" />
              </button>
            </div>
          ))}
          <button
            type="button"
            onClick={() => fileRef.current?.click()}
            disabled={procesandoFoto}
            className="flex aspect-square flex-col items-center justify-center gap-1 rounded-lg border border-dashed bg-background text-xs text-muted-foreground"
          >
            <CameraIcon className="size-5" />
            {procesandoFoto ? "Procesando…" : "Tomar foto"}
          </button>
        </div>
        <input ref={fileRef} type="file" accept="image/*" capture="environment" multiple hidden onChange={(e) => tomarFotos(e.target.files)} />
      </section>

      <section className="space-y-3">
        <h2 className="text-sm font-semibold text-foreground">Acta circunstanciada · firmas</h2>
        <label className="block space-y-1">
          <span className="text-xs font-medium text-muted-foreground">Nombre de quien firma por el cliente</span>
          <input value={c.nombreFirmaCliente} onChange={(e) => actualizar({ nombreFirmaCliente: e.target.value })} className="w-full rounded-lg border px-3 py-2 text-sm" />
        </label>
        <FirmaPad label="Firma del cliente" value={c.firmaCliente} onChange={(v) => actualizar({ firmaCliente: v })} />
        <FirmaPad label="Firma del inspector" value={c.firmaInspector} onChange={(v) => actualizar({ firmaInspector: v })} />
      </section>

      <div className="fixed inset-x-0 bottom-0 z-10 mx-auto max-w-md border-t bg-background p-4 pb-[max(1rem,env(safe-area-inset-bottom))]">
        <Button size="lg" className="w-full" onClick={finalizar} disabled={enviando}>
          <SendIcon /> {enviando ? "Enviando…" : enLinea ? "Finalizar y enviar a revisión" : "Finalizar (se envía al reconectar)"}
        </Button>
      </div>
    </div>
  )
}
