import { Suspense, type CSSProperties } from "react"
import type { Metadata } from "next"
import Link from "next/link"
import { redirect } from "next/navigation"
import { LogOutIcon } from "lucide-react"
import { requireSession } from "@/lib/auth"
import { puede } from "@/lib/permisos"
import { cerrarSesion } from "@/app/(auth)/actions"
import { BarraRed } from "./barra-red"

export const metadata: Metadata = { title: "Campo" }

export default function CampoLayout({ children }: LayoutProps<"/campo">) {
  return (
    <div className="min-h-svh bg-black">
      <div className="mx-auto flex min-h-svh max-w-md flex-col bg-surface text-foreground">
        <Suspense fallback={<p className="p-6 text-sm text-muted-foreground">Cargando…</p>}>
          <CampoShell>{children}</CampoShell>
        </Suspense>
      </div>
    </div>
  )
}

async function CampoShell({ children }: { children: React.ReactNode }) {
  const { usuario, tenant } = await requireSession()
  if (!puede(usuario.rol, "campo.capturar")) redirect("/dashboard")
  const marca = { "--brand": tenant.colorPrimario } as CSSProperties

  return (
    <div style={marca} className="flex flex-1 flex-col">
      <header className="sticky top-0 z-10 flex h-16 items-center justify-between gap-2 bg-black px-4 text-white">
        <Link href="/campo" className="min-w-0">
          <p className="truncate text-[15px] font-bold tracking-tight">{tenant.nombreCorto} · Campo</p>
          <p className="truncate text-xs text-white/60">{usuario.nombre}</p>
        </Link>
        <div className="flex items-center gap-2">
          <BarraRed />
          <form action={cerrarSesion}>
            <button type="submit" className="flex size-10 items-center justify-center rounded-full text-white/70 hover:bg-background/10" aria-label="Cerrar sesión">
              <LogOutIcon className="size-4" />
            </button>
          </form>
        </div>
      </header>
      <main className="flex-1 p-4">{children}</main>
    </div>
  )
}
