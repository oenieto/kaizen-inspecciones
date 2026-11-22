import { mkdirSync, writeFileSync } from "node:fs"
import PizZip from "pizzip"

/**
 * Genera templates/dictamen.docx: la plantilla por defecto mientras el cliente
 * entrega su formato oficial. Usa las mismas etiquetas que lib/documentos/dictamen.ts
 * (sintaxis docxtemplater: {campo}, {#lista}…{/lista}, {%qr} para la imagen).
 *   pnpm tsx scripts/plantilla-dictamen.ts
 */

const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")

interface Estilo {
  b?: boolean
  pt?: number
  color?: string
  centro?: boolean
  derecha?: boolean
  despues?: number
}

const run = (texto: string, e: Estilo = {}) =>
  `<w:r><w:rPr>${e.b ? "<w:b/>" : ""}${e.color ? `<w:color w:val="${e.color}"/>` : ""}<w:sz w:val="${(e.pt ?? 10) * 2}"/></w:rPr><w:t xml:space="preserve">${esc(texto)}</w:t></w:r>`

const p = (runs: string | string[], e: Estilo = {}) =>
  `<w:p><w:pPr>${e.centro ? '<w:jc w:val="center"/>' : e.derecha ? '<w:jc w:val="right"/>' : ""}<w:spacing w:after="${e.despues ?? 80}"/></w:pPr>${
    Array.isArray(runs) ? runs.join("") : run(runs, e)
  }</w:p>`

const campo = (etiqueta: string, valor: string) => p([run(`${etiqueta}: `, { b: true }), run(valor)])

const cuerpo = [
  p("{unidad}", { b: true, pt: 14, color: "0B5CAD", despues: 0 }),
  p("Unidad de Inspección acreditada por EMA · No. {acreditacion} · {ciudad}", { pt: 8, color: "666666" }),
  p([run("Folio: ", { b: true }), run("{folio}", { b: true, pt: 11 })], { derecha: true, despues: 240 }),
  p("DICTAMEN DE VERIFICACIÓN", { b: true, pt: 16, centro: true, despues: 40 }),
  p("{norma} — {norma_titulo}", { centro: true, color: "666666", despues: 240 }),
  campo("Cliente", "{cliente}"),
  campo("RFC", "{rfc}"),
  campo("Instalación", "{instalacion}"),
  campo("Permiso", "{permiso}"),
  campo("Domicilio", "{direccion}"),
  campo("Fecha de visita", "{fecha_visita}"),
  campo("Inspector", "{inspector}"),
  campo("Emisión", "{fecha_emision}"),
  p([run("Resultado: ", { b: true, pt: 12 }), run("{resultado}", { b: true, pt: 12 })], { despues: 40 }),
  p("{leyenda}"),
  p("{#vigencia}"),
  campo("Vigente hasta", "{vigencia}"),
  p("{/vigencia}"),
  p("{#hay_nc}"),
  p("No conformidades", { b: true, pt: 11, despues: 40 }),
  p("{/hay_nc}"),
  p("{#no_conformidades}"),
  p([run("{numeral} ", { b: true }), run("{texto}{#observacion} — {observacion}{/observacion}")]),
  p("{/no_conformidades}"),
  p("", { despues: 480 }),
  p("______________________________", { despues: 0 }),
  p("{responsable}", { b: true, despues: 0 }),
  p("Responsable técnico · aprobó el {fecha_aprobacion}", { pt: 8, color: "666666", despues: 240 }),
  p("{%qr}", { derecha: true, despues: 0 }),
  p("Verifica la autenticidad: {url_verificacion}", { pt: 7, color: "666666", derecha: true }),
].join("")

const NS = [
  'xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"',
  'xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"',
  'xmlns:wp="http://schemas.openxmlformats.org/drawingml/2006/wordprocessingDrawing"',
  'xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main"',
  'xmlns:pic="http://schemas.openxmlformats.org/drawingml/2006/picture"',
].join(" ")

const zip = new PizZip()
zip.file(
  "[Content_Types].xml",
  `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Default Extension="png" ContentType="image/png"/><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/></Types>`,
)
zip.file(
  "_rels/.rels",
  `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/></Relationships>`,
)
zip.file(
  "word/_rels/document.xml.rels",
  `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"></Relationships>`,
)
zip.file(
  "word/document.xml",
  `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><w:document ${NS}><w:body>${cuerpo}<w:sectPr><w:pgSz w:w="12240" w:h="15840"/><w:pgMar w:top="1134" w:right="1134" w:bottom="1134" w:left="1134" w:header="567" w:footer="567" w:gutter="0"/></w:sectPr></w:body></w:document>`,
)

mkdirSync("templates", { recursive: true })
writeFileSync("templates/dictamen.docx", zip.generate({ type: "nodebuffer", compression: "DEFLATE" }))
console.log("templates/dictamen.docx generado")
