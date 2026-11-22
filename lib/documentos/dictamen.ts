import "server-only"
import Docxtemplater from "docxtemplater"
import ImageModule from "docxtemplater-image-module-free"
import PizZip from "pizzip"
import QRCode from "qrcode"
import type { RamaConfig } from "@/config/ramas"
import type { getDictamenCompleto } from "@/lib/data/dictamenes"
import { fecha, fechaHora } from "@/lib/format"

type DictamenCompleto = NonNullable<Awaited<ReturnType<typeof getDictamenCompleto>>>

/** Tamaño del QR en el documento (px a 96 dpi ≈ 3 cm) */
const LADO_QR = 113

/** Campos que recibe la plantilla .docx (ver scripts/plantilla-dictamen.ts). */
export async function camposDictamen(d: DictamenCompleto, urlVerificacion: string, rama: RamaConfig) {
  const { dictamen, inspeccion: x, responsable, tenant } = d
  const reactivos = new Map(x.checklist.reactivos.map((r) => [r.id, r]))
  const noConformidades = x.respuestas
    .filter((r) => r.valor === "no_cumple")
    .map((r) => ({ numeral: reactivos.get(r.reactivoId)?.numeral ?? r.reactivoId, texto: reactivos.get(r.reactivoId)?.texto ?? "", observacion: r.observacion ?? "" }))
  return {
    unidad: tenant.razonSocial,
    acreditacion: tenant.acreditacionEma,
    ciudad: tenant.ciudad,
    folio: dictamen.folio,
    norma: x.norma.clave,
    norma_titulo: x.norma.titulo,
    cliente: x.cliente.razonSocial,
    rfc: x.cliente.rfc,
    instalacion: `${x.instalacion.nombre} (${x.instalacion.tipo})`,
    permiso: x.instalacion.permiso,
    direccion: `${x.instalacion.direccion}, ${x.instalacion.municipio}`,
    fecha_visita: fechaHora(x.fecha),
    inspector: x.inspector.nombre,
    fecha_emision: fecha(dictamen.emitidoEn),
    fecha_aprobacion: fechaHora(dictamen.emitidoEn),
    resultado: dictamen.resultado === "cumple" ? "CUMPLE" : "NO CUMPLE",
    leyenda: rama.textos.leyendaDictamen,
    vigencia: dictamen.vigenteHasta ? fecha(dictamen.vigenteHasta) : "",
    hay_nc: noConformidades.length > 0,
    no_conformidades: noConformidades,
    responsable: responsable.nombre,
    url_verificacion: urlVerificacion,
    qr: await QRCode.toBuffer(urlVerificacion, { margin: 1, width: 300 }),
  }
}

/** Llena la plantilla del cliente (.docx) con docxtemplater (el módulo de imagen requiere el render asíncrono). */
export async function llenarPlantilla(plantilla: Buffer, campos: Record<string, unknown>) {
  const doc = new Docxtemplater(new PizZip(plantilla), {
    paragraphLoop: true,
    linebreaks: true,
    nullGetter: () => "",
    modules: [
      new ImageModule({
        centered: false,
        getImage: (valor: unknown) => valor as Buffer,
        getSize: () => [LADO_QR, LADO_QR],
      }),
    ],
  })
  await doc.renderAsync(campos)
  return doc.getZip().generate({ type: "nodebuffer", compression: "DEFLATE" }) as Buffer
}

/** Convierte el .docx a PDF con Gotenberg (LibreOffice). */
export async function docxAPdf(docx: Buffer, nombre: string) {
  const base = process.env.GOTENBERG_URL
  if (!base) return null
  const form = new FormData()
  form.append("files", new Blob([new Uint8Array(docx)]), `${nombre}.docx`)
  const r = await fetch(`${base.replace(/\/$/, "")}/forms/libreoffice/convert`, {
    method: "POST",
    body: form,
    signal: AbortSignal.timeout(30_000),
  })
  if (!r.ok) throw new Error(`Gotenberg respondió ${r.status}: ${(await r.text()).slice(0, 200)}`)
  return Buffer.from(await r.arrayBuffer())
}
