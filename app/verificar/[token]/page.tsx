import { Suspense } from "react"
import type { Metadata } from "next"
import { BadgeCheckIcon, ShieldAlertIcon } from "lucide-react"
import { verificarToken } from "@/lib/data/dictamenes"
import { fecha } from "@/lib/format"

export const metadata: Metadata = { title: "Verificación de dictamen", robots: { index: false } }

/** Página pública (sin sesión) a la que apunta el QR del dictamen. */
export default function VerificarPage(props: PageProps<"/verificar/[token]">) {
  return (
    <main className="flex min-h-svh items-center justify-center bg-surface p-4">
      <Suspense fallback={<p className="text-sm text-muted-foreground">Verificando…</p>}>
        <Resultado params={props.params} />
      </Suspense>
    </main>
  )
}

async function Resultado({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params
  const d = await verificarToken(token)

  if (!d) {
    return (
      <div className="w-full max-w-md rounded-2xl bg-background p-8 text-center shadow-sm">
        <ShieldAlertIcon className="mx-auto size-12 text-negative" />
        <h1 className="mt-3 text-xl font-semibold">Dictamen no válido</h1>
        <p className="mt-1 text-sm text-muted-foreground">El código no corresponde a ningún dictamen emitido. Podría tratarse de un documento alterado.</p>
      </div>
    )
  }

  const favorable = d.resultado === "cumple"
  const vigente = favorable && d.vigenteHasta !== null && new Date(d.vigenteHasta) > new Date()
  const estado = !favorable ? "Resultado no favorable" : vigente ? "Vigente" : "Vencido"
  return (
    <div className="w-full max-w-md rounded-2xl bg-background p-8 shadow-sm">
      <BadgeCheckIcon className={`mx-auto size-12 ${vigente ? "text-positive" : "text-warning"}`} />
      <h1 className="mt-3 text-center text-xl font-semibold">Dictamen auténtico</h1>
      <p className="text-center text-sm text-muted-foreground">{estado} · emitido por {d.unidad}</p>
      <dl className="mt-6 space-y-3 text-sm">
        {[
          ["Folio", d.folio],
          ["Resultado", d.resultado === "cumple" ? "Cumple" : "No cumple"],
          ["Norma", d.norma],
          ["Cliente", d.cliente],
          ["Instalación", d.instalacion],
          ["Emitido", fecha(d.emitidoEn)],
          ["Vigente hasta", d.vigenteHasta ? fecha(d.vigenteHasta) : "No aplica"],
          ["Acreditación EMA", d.acreditacion],
        ].map(([k, v]) => (
          <div key={k} className="flex justify-between gap-4 border-b pb-2 last:border-0">
            <dt className="text-muted-foreground">{k}</dt>
            <dd className="text-right font-medium">{v}</dd>
          </div>
        ))}
      </dl>
    </div>
  )
}
