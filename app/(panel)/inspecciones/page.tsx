import type { Metadata } from "next"
import Link from "next/link"
import { Card, CardContent } from "@/components/ui/card"
import { PageHeader } from "@/components/page-header"
import { SearchInput } from "@/components/search-input"
import { InspeccionesTabla } from "@/components/inspecciones-tabla"
import { getRamaActual } from "@/lib/data/catalogos"
import { listInspecciones } from "@/lib/data/inspecciones"
import { cn } from "@/lib/utils"
import type { EstatusInspeccion } from "@/lib/types"

export const metadata: Metadata = { title: "Inspecciones" }

const ESTATUS: EstatusInspeccion[] = ["programada", "en_curso", "en_revision", "dictaminada", "cancelada"]

export default async function InspeccionesPage(props: PageProps<"/inspecciones">) {
  const sp = await props.searchParams
  const q = typeof sp.q === "string" ? sp.q : undefined
  const estatus = ESTATUS.find((e) => e === sp.estatus)
  const [filas, rama] = await Promise.all([listInspecciones({ estatus, q }), getRamaActual()])

  const href = (e?: EstatusInspeccion) => {
    const p = new URLSearchParams()
    if (e) p.set("estatus", e)
    if (q) p.set("q", q)
    const s = p.toString()
    return s ? `/inspecciones?${s}` : "/inspecciones"
  }

  return (
    <>
      <PageHeader title="Inspecciones" description={`${filas.length} resultados`} />
      <Card>
        <CardContent className="space-y-4">
          <SearchInput defaultValue={q} placeholder="Buscar cliente, instalación o folio">
            {estatus && <input type="hidden" name="estatus" value={estatus} />}
          </SearchInput>
          <nav className="flex flex-wrap gap-1.5" aria-label="Filtrar por estatus">
            {[undefined, ...ESTATUS].map((e) => (
              <Link
                key={e ?? "todas"}
                href={href(e)}
                aria-current={estatus === e ? "page" : undefined}
                className={cn(
                  "flex h-9 items-center rounded-full bg-secondary px-4 text-sm font-medium transition-colors hover:bg-[color-mix(in_oklch,var(--secondary),var(--foreground)_6%)]",
                  estatus === e && "bg-primary text-primary-foreground hover:bg-primary",
                )}
              >
                {e ? rama.estatus[e] : "Todas"}
              </Link>
            ))}
          </nav>
          <InspeccionesTabla filas={filas} etiquetas={rama.estatus} />
        </CardContent>
      </Card>
    </>
  )
}
