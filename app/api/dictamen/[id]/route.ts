import { NextResponse, type NextRequest } from "next/server"
import { getSession } from "@/lib/auth"
import { getArchivoPlantilla, getRamaActual } from "@/lib/data/catalogos"
import { getDictamenCompleto } from "@/lib/data/dictamenes"
import { camposDictamen, docxAPdf, llenarPlantilla } from "@/lib/documentos/dictamen"

const DOCX = "application/vnd.openxmlformats-officedocument.wordprocessingml.document"

/**
 * Dictamen con la plantilla .docx del cliente (docxtemplater).
 * ?formato=docx (por defecto) o ?formato=pdf (requiere GOTENBERG_URL).
 */
export async function GET(request: NextRequest, ctx: RouteContext<"/api/dictamen/[id]">) {
  if (!(await getSession())) return NextResponse.json({ error: "Sesión expirada" }, { status: 401 })
  const { id } = await ctx.params
  const formato = request.nextUrl.searchParams.get("formato") === "pdf" ? "pdf" : "docx"
  if (formato === "pdf" && !process.env.GOTENBERG_URL)
    return NextResponse.json({ error: "La conversión a PDF no está configurada (GOTENBERG_URL)" }, { status: 501 })

  const [d, rama] = await Promise.all([getDictamenCompleto(id), getRamaActual()])
  if (!d) return NextResponse.json({ error: "Dictamen no encontrado" }, { status: 404 })

  const origen = `${request.headers.get("x-forwarded-proto") ?? request.nextUrl.protocol.replace(":", "")}://${request.headers.get("host")}`
  let docx: Buffer
  try {
    docx = await llenarPlantilla(await getArchivoPlantilla("dictamen"), await camposDictamen(d, `${origen}/verificar/${d.dictamen.tokenQr}`, rama))
  } catch (e) {
    console.error("[dictamen] plantilla:", e)
    return NextResponse.json({ error: "La plantilla del dictamen tiene etiquetas inválidas" }, { status: 422 })
  }

  const nombre = `Dictamen ${d.dictamen.folio}`
  let cuerpo: Buffer = docx
  if (formato === "pdf") {
    try {
      cuerpo = (await docxAPdf(docx, nombre))!
    } catch (e) {
      console.error("[dictamen] gotenberg:", e)
      return NextResponse.json({ error: "No se pudo convertir a PDF" }, { status: 502 })
    }
  }
  return new NextResponse(new Uint8Array(cuerpo), {
    headers: {
      "Content-Type": formato === "pdf" ? "application/pdf" : DOCX,
      "Content-Disposition": `attachment; filename="${nombre}.${formato}"`,
      "Cache-Control": "private, no-store",
    },
  })
}
