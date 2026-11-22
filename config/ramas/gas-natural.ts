import type { EstatusInspeccion, Reactivo } from "@/lib/types"

/**
 * Configuración de la rama «gas natural». Todo lo que cambia entre leads vive
 * aquí y no en los componentes: normas, checklist, catálogos y textos.
 * Nuevo giro = nuevo archivo en config/ramas/ (p. ej. electrica.ts).
 *
 * El checklist es un resumen de demo (~25 reactivos). Los numerales son
 * internos (R-xx); los numerales oficiales los valida el cliente.
 */

const reactivosNom002: Reactivo[] = [
  // Documentación
  { id: "r01", numeral: "R-01", seccion: "Documentación", texto: "Memoria técnica descriptiva de la instalación disponible", tipo: "cumple", requerido: true },
  { id: "r02", numeral: "R-02", seccion: "Documentación", texto: "Plano isométrico actualizado con trayectoria, diámetros y longitudes", tipo: "cumple", requerido: true },
  { id: "r03", numeral: "R-03", seccion: "Documentación", texto: "Bitácora de operación y mantenimiento al corriente", tipo: "cumple", requerido: true },
  // Diseño y materiales
  { id: "r04", numeral: "R-04", seccion: "Diseño y materiales", texto: "Materiales de tubería y conexiones aprobados para gas natural", tipo: "cumple", requerido: true },
  { id: "r05", numeral: "R-05", seccion: "Diseño y materiales", texto: "Presión de operación conforme al diseño", tipo: "medicion", requerido: true, unidad: "kPa" },
  { id: "r06", numeral: "R-06", seccion: "Diseño y materiales", texto: "Regulador y medidor en lugar ventilado y accesible", tipo: "cumple", requerido: true },
  { id: "r07", numeral: "R-07", seccion: "Diseño y materiales", texto: "Válvula de corte general accesible y operable", tipo: "cumple", requerido: true },
  // Construcción
  { id: "r08", numeral: "R-08", seccion: "Construcción", texto: "Tubería visible soportada y protegida contra daño mecánico", tipo: "cumple", requerido: true },
  { id: "r09", numeral: "R-09", seccion: "Construcción", texto: "Tubería enterrada con profundidad y protección adecuadas", tipo: "cumple", requerido: false },
  { id: "r10", numeral: "R-10", seccion: "Construcción", texto: "Protección anticorrosiva en buen estado", tipo: "cumple", requerido: true },
  { id: "r11", numeral: "R-11", seccion: "Construcción", texto: "Distancias de seguridad a instalaciones eléctricas", tipo: "cumple", requerido: true },
  { id: "r12", numeral: "R-12", seccion: "Construcción", texto: "Tubería identificada con color y leyenda", tipo: "cumple", requerido: true },
  // Pruebas
  { id: "r13", numeral: "R-13", seccion: "Prueba de hermeticidad", texto: "Presión de prueba aplicada", tipo: "medicion", requerido: true, unidad: "kPa" },
  { id: "r14", numeral: "R-14", seccion: "Prueba de hermeticidad", texto: "Duración de la prueba", tipo: "medicion", requerido: true, unidad: "min" },
  { id: "r15", numeral: "R-15", seccion: "Prueba de hermeticidad", texto: "Sin caída de presión durante la prueba", tipo: "cumple", requerido: true },
  { id: "r16", numeral: "R-16", seccion: "Prueba de hermeticidad", texto: "Detección de fugas en uniones con detector o solución jabonosa", tipo: "cumple", requerido: true },
  // Aparatos de consumo
  { id: "r17", numeral: "R-17", seccion: "Aparatos de consumo", texto: "Cada aparato cuenta con válvula de corte individual", tipo: "cumple", requerido: true },
  { id: "r18", numeral: "R-18", seccion: "Aparatos de consumo", texto: "Conectores flexibles aprobados y en buen estado", tipo: "cumple", requerido: true },
  { id: "r19", numeral: "R-19", seccion: "Aparatos de consumo", texto: "Ventilación suficiente en recintos con aparatos", tipo: "cumple", requerido: true },
  { id: "r20", numeral: "R-20", seccion: "Aparatos de consumo", texto: "Desalojo de gases de combustión al exterior", tipo: "cumple", requerido: true },
  // Seguridad
  { id: "r21", numeral: "R-21", seccion: "Seguridad", texto: "Señalización de seguridad visible", tipo: "cumple", requerido: true },
  { id: "r22", numeral: "R-22", seccion: "Seguridad", texto: "Extintores vigentes y en ubicación adecuada", tipo: "cumple", requerido: false },
  { id: "r23", numeral: "R-23", seccion: "Seguridad", texto: "Detectores de gas operativos (si aplica)", tipo: "cumple", requerido: false },
  { id: "r24", numeral: "R-24", seccion: "Seguridad", texto: "Personal capacitado en procedimiento de emergencia", tipo: "cumple", requerido: false },
  { id: "r25", numeral: "R-25", seccion: "Observaciones", texto: "Observaciones generales del inspector", tipo: "texto", requerido: false },
]

export const gasNatural = {
  clave: "gas-natural",
  nombre: "Gas natural",
  normas: [
    {
      clave: "NOM-002-SECRE-2010",
      titulo: "Instalaciones de aprovechamiento de gas natural",
      vigente: true,
    },
    {
      clave: "NOM-020-ASEA-2024",
      titulo: "Transporte de gas natural por ductos",
      vigente: true,
      nota: "Sustituye a NOM-007-SECRE-2010 (cancelada). Confirmar aprobación del cliente.",
    },
  ],
  checklists: [
    {
      normaClave: "NOM-002-SECRE-2010",
      version: "demo-1.0",
      nombre: "Verificación de instalación de aprovechamiento (resumido)",
      reactivos: reactivosNom002,
    },
  ],
  tiposInstalacion: [
    "Industrial",
    "Comercial",
    "Hospitalaria",
    "Hotelera",
    "Habitacional multifamiliar",
  ],
  giros: [
    "Manufactura automotriz",
    "Alimentos y bebidas",
    "Plásticos",
    "Restaurante",
    "Hotel",
    "Hospital",
    "Constructora",
    "Logística",
  ],
  /** Vigencia del dictamen en meses, para calcular vencimientos */
  vigenciaDictamenMeses: 12,
  /** Etiquetas visibles de estatus (el estatus en sí es núcleo del producto) */
  estatus: {
    programada: "Programada",
    en_curso: "En curso",
    en_revision: "En revisión",
    dictaminada: "Dictaminada",
    cancelada: "Cancelada",
  } satisfies Record<EstatusInspeccion, string>,
  textos: {
    tipoServicio: "Verificación de instalación de gas natural",
    leyendaDictamen:
      "La Unidad de Inspección hace constar que la instalación fue verificada conforme a la norma indicada.",
  },
}

export type RamaConfig = typeof gasNatural
