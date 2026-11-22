import { TZ } from "@/lib/format"

/** Cálculo de días y meses en la zona horaria de la operación, sin depender de la del servidor. */

const fmt = new Intl.DateTimeFormat("en-CA", {
  timeZone: TZ,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  second: "2-digit",
  hourCycle: "h23",
})

export function partesLocales(d: Date) {
  const p = Object.fromEntries(fmt.formatToParts(d).map((x) => [x.type, Number(x.value)]))
  return { anio: p.year, mes: p.month, dia: p.day, hora: p.hour, minuto: p.minute, segundo: p.second }
}

/** Diferencia (ms) entre la hora local de TZ y UTC en ese instante. */
function desfase(d: Date) {
  const p = partesLocales(d)
  return Date.UTC(p.anio, p.mes - 1, p.dia, p.hora, p.minuto, p.segundo) - Math.floor(d.getTime() / 1000) * 1000
}

/** Instante de las 00:00 locales del día indicado (mes 1-12; admite desbordes, p. ej. día 32). */
export function medianocheLocal(anio: number, mes: number, dia: number) {
  const t = Date.UTC(anio, mes - 1, dia)
  return new Date(t - desfase(new Date(t - desfase(new Date(t)))))
}

/** [inicio, fin) del día local que contiene `d`. */
export function rangoDelDia(d: Date) {
  const p = partesLocales(d)
  return { inicio: medianocheLocal(p.anio, p.mes, p.dia), fin: medianocheLocal(p.anio, p.mes, p.dia + 1) }
}
