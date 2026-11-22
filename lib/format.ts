const TZ = "America/Mexico_City"

const fFecha = new Intl.DateTimeFormat("es-MX", { day: "2-digit", month: "short", year: "numeric", timeZone: TZ })
const fHora = new Intl.DateTimeFormat("es-MX", { hour: "2-digit", minute: "2-digit", timeZone: TZ })
const fFechaHora = new Intl.DateTimeFormat("es-MX", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit", timeZone: TZ })
const fDia = new Intl.DateTimeFormat("es-MX", { weekday: "long", day: "numeric", month: "long", timeZone: TZ })

export const fecha = (iso: string) => fFecha.format(new Date(iso))
export const hora = (iso: string) => fHora.format(new Date(iso))
export const fechaHora = (iso: string) => fFechaHora.format(new Date(iso))
export const diaLargo = (d: Date | string) => fDia.format(new Date(d))

export function diasHasta(iso: string) {
  return Math.ceil((new Date(iso).getTime() - Date.now()) / 86_400_000)
}
