import { gasNatural, type RamaConfig } from "./gas-natural"

const ramas: Record<string, RamaConfig> = {
  [gasNatural.clave]: gasNatural,
}

export function getRama(clave: string): RamaConfig {
  const rama = ramas[clave]
  if (!rama) throw new Error(`Rama no configurada: ${clave}`)
  return rama
}

export type { RamaConfig }
