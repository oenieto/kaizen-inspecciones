import { Suspense, type CSSProperties } from "react"
import { redirect } from "next/navigation"
import { AppSidebar } from "@/components/app-sidebar"
import { SidebarInset, SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar"
import { Separator } from "@/components/ui/separator"
import { requireSession } from "@/lib/auth"

export default function PanelLayout({ children }: LayoutProps<"/">) {
  return (
    <Suspense fallback={<div className="flex min-h-svh items-center justify-center text-sm text-muted-foreground">Cargando…</div>}>
      <PanelShell>{children}</PanelShell>
    </Suspense>
  )
}

async function PanelShell({ children }: { children: React.ReactNode }) {
  const { usuario, tenant } = await requireSession()
  if (usuario.rol === "inspector") redirect("/campo")

  // Branding por tenant: su color es un acento (logo, documentos); la interfaz se mantiene monocromática
  const marca = { "--brand": tenant.colorPrimario } as CSSProperties

  return (
    <SidebarProvider style={marca}>
      <AppSidebar
        usuario={{ nombre: usuario.nombre, rol: usuario.rol, iniciales: usuario.iniciales, email: usuario.email }}
        tenant={{ nombreCorto: tenant.nombreCorto, acreditacionEma: tenant.acreditacionEma }}
      />
      <SidebarInset>
        <header className="no-print sticky top-0 z-20 flex h-16 shrink-0 items-center gap-3 border-b bg-background px-4 md:px-8">
          <SidebarTrigger className="-ml-2" />
          <Separator orientation="vertical" className="h-5" />
          <span className="truncate text-sm font-medium">{tenant.razonSocial}</span>
          <span className="ml-auto rounded-full bg-muted px-3 py-1 text-xs font-medium text-muted-foreground">Demo · datos ficticios</span>
        </header>
        <div className="flex-1 bg-surface px-4 py-6 md:px-8 md:py-8 print:bg-background">
          <div className="mx-auto w-full max-w-[1400px]">{children}</div>
        </div>
      </SidebarInset>
    </SidebarProvider>
  )
}
