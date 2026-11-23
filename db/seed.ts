import { getRama } from "@/config/ramas"
import type {
  Acta,
  Checklist,
  Cliente,
  Dictamen,
  EntradaBitacora,
  Evidencia,
  Inspeccion,
  Instalacion,
  Norma,
  Plantilla,
  RespuestaChecklist,
  Tenant,
  Usuario,
} from "@/lib/types"

/**
 * Datos de demo para el tenant UV Energía, rama gas natural.
 * Todo es ficticio (clientes, personas, RFC): nunca nombres reales.
 * Determinista (PRNG con semilla) pero relativo a la fecha de arranque, para
 * que la agenda siempre tenga citas en la semana actual.
 *
 * Antonio: este mismo contenido es el que debe insertar `pnpm seed` en Supabase.
 */

export interface DemoStore {
  tenant: Tenant
  usuarios: Usuario[]
  normas: Norma[]
  checklists: Checklist[]
  plantillas: Plantilla[]
  clientes: Cliente[]
  instalaciones: Instalacion[]
  inspecciones: Inspeccion[]
  evidencias: Evidencia[]
  actas: Acta[]
  dictamenes: Dictamen[]
  bitacora: EntradaBitacora[]
  /** Último consecutivo de folio por año */
  folios: Record<number, number>
  seq: number
}

function prng(seed: number) {
  let a = seed
  return () => {
    a |= 0
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

const DAY = 86_400_000

/** Texto de la no conformidad según el reactivo incumplido (lo que verá el cliente en el dictamen). */
const OBSERVACION_NC: Record<string, string> = {
  r10: "Corrosión superficial en tramo visible junto al regulador; aplicar limpieza y recubrimiento anticorrosivo.",
  r12: "Tramo de tubería sin identificación de color ni leyenda «GAS NATURAL»; identificar en toda su trayectoria.",
  r19: "Recinto de calentadores sin rejilla de ventilación inferior; la ventilación es insuficiente para los aparatos instalados.",
  r21: "Falta señalización de la válvula de corte general y de «No fumar» en la zona de medidor.",
}

const OBSERVACIONES_GENERALES = [
  "Instalación en condiciones generales aceptables.",
  "Trayectoria conforme al isométrico; se recomienda mantenimiento preventivo del regulador.",
  "Instalación ordenada y accesible; bitácora al corriente.",
  "Sin fugas detectadas; se sugiere renovar señalización desgastada en el próximo mantenimiento.",
]

const HOMOCLAVE = "ABCDEFGHJKLMNPRSTUVWXYZ0123456789"

function atHour(base: Date, dayOffset: number, hour: number, minute = 0) {
  const d = new Date(base)
  d.setDate(d.getDate() + dayOffset)
  d.setHours(hour, minute, 0, 0)
  return d
}

export function createSeed(now = new Date()): DemoStore {
  const rand = prng(20200127)
  const pick = <T,>(arr: T[]) => arr[Math.floor(rand() * arr.length)]
  // Segundo PRNG solo para detalles (mediciones, RFC, hashes): así `rand` conserva
  // su secuencia y la agenda, clientes e inspecciones de la demo no cambian.
  const varia = prng(20261122)
  const entre = (min: number, max: number) => Math.round((min + varia() * (max - min)) * 10) / 10
  const sha256 = () => `sha256:${Array.from({ length: 8 }, () => Math.floor(varia() * 2 ** 32).toString(16).padStart(8, "0")).join("")}`
  const rfcMoral = () => {
    const fecha = new Date(Date.UTC(1988 + Math.floor(varia() * 30), Math.floor(varia() * 12), 1 + Math.floor(varia() * 28)))
    const homoclave = Array.from({ length: 3 }, () => HOMOCLAVE[Math.floor(varia() * HOMOCLAVE.length)]).join("")
    return `DEM${fecha.toISOString().slice(2, 10).replaceAll("-", "")}${homoclave}`
  }
  const rama = getRama("gas-natural")
  const tenantId = "t_uv"

  const tenant: Tenant = {
    id: tenantId,
    slug: "uv-energia",
    razonSocial: "UV Energía, S.A. de C.V.",
    nombreCorto: "UV Energía",
    acreditacionEma: "UVCRE 029",
    acreditacionDesde: "2020-01-27",
    rama: rama.clave,
    ciudad: "Juriquilla, Querétaro",
    sitioWeb: "https://uvenergia.com",
    logoUrl: null,
    colorPrimario: "#0b5cad",
    serieFolio: "UVCRE029",
  }

  const vigencia = new Date(now.getFullYear() + 1, 5, 30).toISOString()
  const usuarios: Usuario[] = [
    { id: "u_admin", tenantId, nombre: "Admin UV Energía", email: "admin@demo.uv", rol: "admin", iniciales: "AU", competencias: [] },
    { id: "u_coord", tenantId, nombre: "Laura Méndez", email: "coordinacion@demo.uv", rol: "coordinador", iniciales: "LM", competencias: [] },
    { id: "u_resp", tenantId, nombre: "Ing. Patricia Ortega", email: "responsable@demo.uv", rol: "responsable", iniciales: "PO", competencias: [{ normaClave: "NOM-002-SECRE-2010", vigenteHasta: vigencia }] },
    { id: "u_insp1", tenantId, nombre: "Carlos Ruiz", email: "cruiz@demo.uv", rol: "inspector", iniciales: "CR", competencias: [{ normaClave: "NOM-002-SECRE-2010", vigenteHasta: vigencia }] },
    { id: "u_insp2", tenantId, nombre: "Andrea Torres", email: "atorres@demo.uv", rol: "inspector", iniciales: "AT", competencias: [{ normaClave: "NOM-002-SECRE-2010", vigenteHasta: new Date(now.getTime() + 40 * DAY).toISOString() }] },
    { id: "u_insp3", tenantId, nombre: "Jorge Salinas", email: "jsalinas@demo.uv", rol: "inspector", iniciales: "JS", competencias: [{ normaClave: "NOM-002-SECRE-2010", vigenteHasta: vigencia }] },
  ]
  const inspectores = usuarios.filter((u) => u.rol === "inspector")

  const normas: Norma[] = rama.normas.map((n, i) => ({
    id: `n_${i + 1}`,
    tenantId,
    clave: n.clave,
    titulo: n.titulo,
    rama: rama.clave,
    vigente: n.vigente,
    nota: "nota" in n ? n.nota : undefined,
  }))

  const checklists: Checklist[] = rama.checklists.map((c, i) => ({
    id: `ck_${i + 1}`,
    normaId: normas.find((n) => n.clave === c.normaClave)!.id,
    version: c.version,
    nombre: c.nombre,
    reactivos: c.reactivos,
  }))
  const checklist = checklists[0]

  const plantillas: Plantilla[] = [
    { id: "p_acta", tenantId, tipo: "acta", nombre: "Acta circunstanciada de verificación", archivo: "templates/acta.docx", campos: ["folio_inspeccion", "cliente", "instalacion", "direccion", "fecha", "inspector", "respuestas", "observaciones", "firma_cliente", "firma_inspector"], actualizadaEn: now.toISOString() },
    { id: "p_dict", tenantId, tipo: "dictamen", nombre: "Dictamen de verificación", archivo: "templates/dictamen.docx", campos: ["folio", "cliente", "rfc", "instalacion", "direccion", "norma", "resultado", "no_conformidades", "responsable", "fecha_emision", "vigencia", "qr"], actualizadaEn: now.toISOString() },
  ]

  const nombresClientes: [string, string][] = [
    ["Autopartes Bajío Demo, S.A. de C.V.", "Manufactura automotriz"],
    ["Alimentos del Marqués Demo, S.A. de C.V.", "Alimentos y bebidas"],
    ["Plásticos Querétaro Demo, S. de R.L.", "Plásticos"],
    ["Hotel Plaza Centro Demo", "Hotel"],
    ["Hospital San Ángel Demo", "Hospital"],
    ["Restaurante La Hacienda Demo", "Restaurante"],
    ["Constructora Juriquilla Demo, S.A.", "Constructora"],
    ["Logística Bernardo Quintana Demo", "Logística"],
    ["Bebidas Cimatario Demo, S.A. de C.V.", "Alimentos y bebidas"],
    ["Metalmecánica El Colorado Demo", "Manufactura automotriz"],
    ["Suites Zibatá Demo", "Hotel"],
    ["Cocina Industrial Corregidora Demo", "Restaurante"],
  ]
  const contactos = ["Mariana López", "Ricardo Gómez", "Sofía Herrera", "Daniel Castro", "Valeria Núñez", "Miguel Ángel Rojas", "Fernanda Ibarra", "Luis Paredes", "Gabriela Soto", "Héctor Vega", "Paola Medina", "Raúl Cervantes"]

  const clientes: Cliente[] = nombresClientes.map(([razonSocial, giro], i) => ({
    id: `c_${i + 1}`,
    tenantId,
    rfc: rfcMoral(),
    razonSocial,
    giro,
    contacto: contactos[i],
    telefono: `442 ${String(100 + i * 13).padStart(3, "0")} ${String(1000 + i * 271).slice(0, 4)}`,
    email: `contacto${i + 1}@cliente-demo.mx`,
    creadoEn: new Date(now.getTime() - (400 - i * 20) * DAY).toISOString(),
  }))

  const zonas = [
    { municipio: "El Marqués", calle: "Parque Industrial El Marqués", lat: 20.6255, lng: -100.2585 },
    { municipio: "Querétaro", calle: "Parque Industrial Bernardo Quintana", lat: 20.6328, lng: -100.3172 },
    { municipio: "Querétaro", calle: "Juriquilla", lat: 20.7045, lng: -100.4472 },
    { municipio: "Querétaro", calle: "Centro Histórico", lat: 20.5931, lng: -100.3923 },
    { municipio: "Corregidora", calle: "El Pueblito", lat: 20.5389, lng: -100.4436 },
    { municipio: "El Marqués", calle: "Zibatá", lat: 20.6707, lng: -100.3389 },
  ]

  const instalaciones: Instalacion[] = []
  clientes.forEach((c, i) => {
    const n = i < 13 ? (i % 3 === 0 ? 3 : 2) : 1
    for (let k = 0; k < n && instalaciones.length < 25; k++) {
      const z = zonas[(i + k) % zonas.length]
      const idx = instalaciones.length + 1
      const venceEnDias = Math.floor(rand() * 330) - 30
      instalaciones.push({
        id: `i_${idx}`,
        tenantId,
        clienteId: c.id,
        nombre: k === 0 ? "Planta principal" : k === 1 ? "Nave 2" : "Comedor industrial",
        tipo: c.giro === "Hotel" ? "Hotelera" : c.giro === "Hospital" ? "Hospitalaria" : c.giro === "Restaurante" ? "Comercial" : c.giro === "Constructora" ? "Habitacional multifamiliar" : "Industrial",
        direccion: `${z.calle}, ${["Av. de la Luz", "Calle Acceso", "Blvd. Bernardo Quintana", "Av. Constituyentes", "Calle Industria"][idx % 5]} ${100 + idx * 7}`,
        municipio: z.municipio,
        lat: z.lat + (rand() - 0.5) * 0.02,
        lng: z.lng + (rand() - 0.5) * 0.02,
        permiso: `PER-GN-${String(3000 + idx * 11)}`,
        vencimiento: new Date(now.getTime() + venceEnDias * DAY).toISOString(),
      })
    }
  })

  const inspecciones: Inspeccion[] = []
  const dictamenes: Dictamen[] = []
  const actas: Acta[] = []
  const evidencias: Evidencia[] = []
  const bitacora: EntradaBitacora[] = []
  const folios: Record<number, number> = {}
  let seq = 0
  const nid = (p: string) => `${p}_${++seq}`

  const respuestasCompletas = (conNC: boolean): RespuestaChecklist[] =>
    checklist.reactivos.map((r) => {
      if (r.tipo === "medicion") {
        // Operación en baja presión, prueba de hermeticidad y su duración
        const medicion = r.unidad === "min" ? [15, 20, 30][Math.floor(varia() * 3)] : r.id === "r13" ? entre(9.8, 11.5) : entre(1.9, 2.7)
        return { reactivoId: r.id, valor: "cumple", medicion }
      }
      if (r.tipo === "texto") return { reactivoId: r.id, valor: null, observacion: OBSERVACIONES_GENERALES[Math.floor(varia() * OBSERVACIONES_GENERALES.length)] }
      const nc = conNC && r.id in OBSERVACION_NC && rand() < 0.6
      return {
        reactivoId: r.id,
        valor: nc ? "no_cumple" : !r.requerido && rand() < 0.3 ? "na" : "cumple",
        observacion: nc ? OBSERVACION_NC[r.id] : undefined,
      }
    })

  const log = (e: Omit<EntradaBitacora, "id" | "tenantId">) =>
    bitacora.push({ id: nid("b"), tenantId, ...e })

  const contactoDe = (inst: Instalacion) => clientes.find((c) => c.id === inst.clienteId)?.contacto ?? "Representante del cliente"

  // Foto del medidor y memoria técnica. Los id del historial van en su propia serie
  // para no recorrer `seq` (y con él los id de inspecciones y dictámenes).
  let evHistorial = 0
  const agregarEvidencias = (inspeccionId: string, inst: Instalacion, fecha: Date, id: () => string) => {
    evidencias.push({ id: id(), inspeccionId, tipo: "foto", nombre: "Medidor y regulador.jpg", url: "/demo/evidencia-medidor.svg", lat: inst.lat, lng: inst.lng, tomadaEn: fecha.toISOString(), hash: sha256() })
    evidencias.push({ id: id(), inspeccionId, tipo: "documento", nombre: "Memoria técnica.pdf", url: "/demo/memoria-tecnica.svg", lat: null, lng: null, tomadaEn: fecha.toISOString(), hash: sha256() })
  }

  const base = new Date(now)
  base.setHours(0, 0, 0, 0)

  // Historial: 6 meses de inspecciones dictaminadas
  for (let d = 180; d >= 3; d -= 1 + Math.floor(rand() * 4)) {
    const fecha = atHour(base, -d, 8 + Math.floor(rand() * 8))
    if (fecha.getDay() === 0 || fecha.getDay() === 6) continue
    const inst = pick(instalaciones)
    const insp = pick(inspectores)
    const conNC = rand() < 0.3
    const id = nid("ins")
    const respuestas = respuestasCompletas(conNC)
    const emitido = new Date(fecha.getTime() + (1 + Math.floor(rand() * 3)) * DAY)
    inspecciones.push({
      id, tenantId, instalacionId: inst.id, normaId: checklist.normaId, checklistId: checklist.id,
      inspectorId: insp.id, fecha: fecha.toISOString(), duracionMin: 120, estatus: "dictaminada", version: 3,
      respuestas, observaciones: conNC ? "Se levantan no conformidades menores." : "",
      iniciadaEn: fecha.toISOString(), sincronizadaEn: new Date(fecha.getTime() + 3 * 3600_000).toISOString(),
      enviadaRevisionEn: new Date(fecha.getTime() + 4 * 3600_000).toISOString(),
    })
    actas.push({ id: nid("a"), inspeccionId: id, version: 1, firmaCliente: null, firmaInspector: null, nombreFirmaCliente: contactoDe(inst), generadaEn: fecha.toISOString() })
    agregarEvidencias(id, inst, fecha, () => `ev_h${++evHistorial}`)
    const year = emitido.getFullYear()
    folios[year] = (folios[year] ?? 0) + 1
    const resultado = respuestas.some((r) => r.valor === "no_cumple") ? "no_cumple" : "cumple"
    dictamenes.push({
      id: nid("d"), tenantId, inspeccionId: id,
      folio: `${tenant.serieFolio}-${year}-${String(folios[year]).padStart(4, "0")}`,
      resultado, tokenQr: `q${seq.toString(36)}${Math.floor(rand() * 1e9).toString(36)}`,
      aprobadoPor: "u_resp", emitidoEn: emitido.toISOString(),
      vigenteHasta: resultado === "cumple" ? new Date(emitido.getTime() + 365 * DAY).toISOString() : null,
    })
    log({ entidad: "inspeccion", entidadId: id, accion: "emitir_dictamen", descripcion: "Dictamen emitido", usuarioId: "u_resp", timestamp: emitido.toISOString() })
  }

  // Semana actual y siguiente: citas operativas
  const dow = (base.getDay() + 6) % 7 // lunes = 0
  for (let day = -dow; day < 12 - dow; day++) {
    const fechaDia = atHour(base, day, 0)
    // Fines de semana sin citas, salvo hoy (para que la demo siempre tenga ruta del día)
    if (day !== 0 && (fechaDia.getDay() === 0 || fechaDia.getDay() === 6)) continue
    inspectores.forEach((insp, k) => {
      const citas = 1 + Math.floor(rand() * 2)
      for (let c = 0; c < citas; c++) {
        const fecha = atHour(base, day, 8 + c * 3 + k, k * 15)
        const inst = instalaciones[(seq + k * 5 + c) % instalaciones.length]
        const id = nid("ins")
        let estatus: Inspeccion["estatus"] = "programada"
        if (day < 0) estatus = rand() < 0.15 ? "cancelada" : "en_revision"
        if (day === 0 && c === 0) estatus = "en_curso"
        const respuestas = estatus === "en_revision" ? respuestasCompletas(rand() < 0.4) : []
        inspecciones.push({
          id, tenantId, instalacionId: inst.id, normaId: checklist.normaId, checklistId: checklist.id,
          inspectorId: insp.id, fecha: fecha.toISOString(), duracionMin: 120, estatus, version: 1,
          respuestas, observaciones: "",
          iniciadaEn: estatus !== "programada" && estatus !== "cancelada" ? fecha.toISOString() : null,
          sincronizadaEn: estatus === "en_revision" ? new Date(fecha.getTime() + 3 * 3600_000).toISOString() : null,
          enviadaRevisionEn: estatus === "en_revision" ? new Date(fecha.getTime() + 4 * 3600_000).toISOString() : null,
        })
        log({ entidad: "inspeccion", entidadId: id, accion: "crear", descripcion: "Cita programada", usuarioId: "u_coord", timestamp: new Date(fecha.getTime() - 5 * DAY).toISOString() })
        if (estatus === "en_revision") {
          log({ entidad: "inspeccion", entidadId: id, accion: "sincronizar", descripcion: "Checklist y evidencias sincronizados desde campo", usuarioId: insp.id, timestamp: new Date(fecha.getTime() + 3 * 3600_000).toISOString() })
          agregarEvidencias(id, inst, fecha, () => nid("ev"))
          actas.push({ id: nid("a"), inspeccionId: id, version: 1, firmaCliente: null, firmaInspector: null, nombreFirmaCliente: contactoDe(inst), generadaEn: fecha.toISOString() })
        }
      }
    })
  }

  return { tenant, usuarios, normas, checklists, plantillas, clientes, instalaciones, inspecciones, evidencias, actas, dictamenes, bitacora, folios, seq }
}
