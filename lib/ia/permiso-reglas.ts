/**
 * Reglas deterministas sobre la lectura del permiso. Sin dependencias para
 * probarlas solas (permiso-reglas.test.ts).
 */

/** Lo que devuelve el modelo (ver esquema en ocr-permiso.ts) */
export interface LecturaPermiso {
  legible: boolean
  tipoDocumento: string | null
  permiso: string | null
  titular: string | null
  rfc: string | null
  nombre: string | null
  tipo: string | null
  direccion: string | null
  municipio: string | null
  /** YYYY-MM-DD */
  vigencia: string | null
  observaciones: string
}

/**
 * Sugerencia para el formulario de instalación. Las llaves de `campos` son las
 * mismas que se mandan al guardar: así la BD compara lo sugerido con lo
 * guardado y registra si la persona lo aceptó o lo editó.
 */
export interface SugerenciaInstalacion {
  campos: {
    nombre: string | null
    tipo: string | null
    direccion: string | null
    municipio: string | null
    permiso: string | null
    permisoVigencia: string | null
  }
  titular: string | null
  rfc: string | null
  tipoDocumento: string | null
  legible: boolean
  /** Lo que la persona debe revisar (del modelo y de estas reglas) */
  avisos: string[]
}

const fechaIso = /^\d{4}-\d{2}-\d{2}$/
export const RFC_VALIDO = /^[A-ZÑ&]{3,4}\d{6}[A-Z0-9]{3}$/

const limpio = (v: string | null) => {
  const t = v?.trim()
  return t ? t : null
}

/** Formatos que no cuadran se vacían y se avisan; nunca se «corrigen». */
export function normalizarLectura(l: LecturaPermiso): LecturaPermiso {
  const avisos: string[] = []
  const rfc = l.rfc?.replace(/[\s-]/g, "").toUpperCase() || null
  const rfcOk = rfc != null && RFC_VALIDO.test(rfc)
  if (rfc && !rfcOk) avisos.push(`El RFC leído («${l.rfc}») no tiene formato válido`)
  const vigenciaOk = l.vigencia != null && fechaIso.test(l.vigencia) && !Number.isNaN(Date.parse(l.vigencia))
  if (l.vigencia && !vigenciaOk) avisos.push(`La vigencia leída («${l.vigencia}») no es una fecha válida`)
  return {
    ...l,
    permiso: limpio(l.permiso),
    titular: limpio(l.titular),
    nombre: limpio(l.nombre),
    direccion: limpio(l.direccion),
    municipio: limpio(l.municipio),
    rfc: rfcOk ? rfc : null,
    vigencia: vigenciaOk ? l.vigencia : null,
    observaciones: [l.observaciones.trim(), ...avisos].filter(Boolean).join(". "),
  }
}

/**
 * Arma la sugerencia del formulario. Con el RFC del cliente al que se agrega la
 * instalación, avisa si el permiso está a nombre de otro titular.
 */
export function sugerenciaInstalacion(
  l: LecturaPermiso,
  opciones: { rfcCliente?: string | null; hoy?: Date } = {},
): SugerenciaInstalacion {
  const avisos = l.observaciones ? l.observaciones.split(". ").filter(Boolean) : []
  if (!l.legible) avisos.unshift("El archivo no parece un permiso legible: captura los datos a mano")
  if (opciones.rfcCliente && l.rfc && l.rfc !== opciones.rfcCliente.toUpperCase())
    avisos.push(`El permiso está a nombre de otro RFC (${l.rfc}); el cliente tiene ${opciones.rfcCliente.toUpperCase()}`)
  const hoy = (opciones.hoy ?? new Date()).toISOString().slice(0, 10)
  if (l.vigencia && l.vigencia < hoy) avisos.push(`El permiso venció el ${l.vigencia}`)
  return {
    campos: {
      nombre: l.nombre,
      tipo: l.tipo,
      direccion: l.direccion,
      municipio: l.municipio,
      permiso: l.permiso,
      permisoVigencia: l.vigencia,
    },
    titular: l.titular,
    rfc: l.rfc,
    tipoDocumento: l.tipoDocumento,
    legible: l.legible,
    avisos,
  }
}
