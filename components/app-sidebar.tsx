"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import {
  CalendarDaysIcon,
  ClipboardCheckIcon,
  FileBadgeIcon,
  LayoutDashboardIcon,
  LogOutIcon,
  SettingsIcon,
  SmartphoneIcon,
  UsersIcon,
} from "lucide-react"
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarRail,
} from "@/components/ui/sidebar"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { cerrarSesion } from "@/app/(auth)/actions"
import { etiquetaRol } from "@/lib/permisos"
import type { Rol } from "@/lib/types"

const nav: { href: string; label: string; icon: typeof UsersIcon; roles: Rol[] }[] = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboardIcon, roles: ["admin", "coordinador", "responsable"] },
  { href: "/agenda", label: "Agenda", icon: CalendarDaysIcon, roles: ["admin", "coordinador", "responsable"] },
  { href: "/clientes", label: "Clientes", icon: UsersIcon, roles: ["admin", "coordinador", "responsable"] },
  { href: "/inspecciones", label: "Inspecciones", icon: ClipboardCheckIcon, roles: ["admin", "coordinador", "responsable"] },
  { href: "/dictamenes", label: "Dictámenes", icon: FileBadgeIcon, roles: ["admin", "coordinador", "responsable"] },
  { href: "/configuracion", label: "Configuración", icon: SettingsIcon, roles: ["admin"] },
  { href: "/campo", label: "App de campo", icon: SmartphoneIcon, roles: ["admin", "inspector"] },
]

export function AppSidebar({
  usuario,
  tenant,
}: {
  usuario: { nombre: string; rol: Rol; iniciales: string; email: string }
  tenant: { nombreCorto: string; acreditacionEma: string }
}) {
  const pathname = usePathname()
  const items = nav.filter((n) => n.roles.includes(usuario.rol))

  return (
    <Sidebar collapsible="icon" className="no-print">
      <SidebarHeader>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton size="lg" render={<Link href="/dashboard" />}>
              <div className="flex aspect-square size-9 items-center justify-center rounded-lg bg-brand text-sm font-bold text-white">
                {tenant.nombreCorto.slice(0, 2).toUpperCase()}
              </div>
              <div className="grid flex-1 text-left text-sm leading-tight">
                <span className="truncate font-bold tracking-tight">{tenant.nombreCorto}</span>
                <span className="truncate text-xs text-muted-foreground">EMA {tenant.acreditacionEma}</span>
              </div>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel className="text-[11px] font-semibold tracking-wider uppercase">Operación</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {items.map((item) => (
                <SidebarMenuItem key={item.href}>
                  <SidebarMenuButton
                    isActive={pathname === item.href || pathname.startsWith(`${item.href}/`)}
                    tooltip={item.label}
                    render={<Link href={item.href} />}
                    className="h-10 rounded-lg px-3 font-medium text-muted-foreground transition-colors hover:text-foreground data-active:bg-primary data-active:text-primary-foreground data-active:hover:bg-primary data-active:hover:text-primary-foreground"
                  >
                    <item.icon />
                    <span>{item.label}</span>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
      <SidebarFooter>
        <SidebarMenu>
          <SidebarMenuItem>
            <DropdownMenu>
              <DropdownMenuTrigger render={<SidebarMenuButton size="lg" />}>
                <Avatar className="size-9 rounded-full">
                  <AvatarFallback className="rounded-full bg-primary text-xs font-semibold text-primary-foreground">{usuario.iniciales}</AvatarFallback>
                </Avatar>
                <div className="grid flex-1 text-left text-sm leading-tight">
                  <span className="truncate font-medium">{usuario.nombre}</span>
                  <span className="truncate text-xs text-muted-foreground">{etiquetaRol[usuario.rol]}</span>
                </div>
              </DropdownMenuTrigger>
              <DropdownMenuContent side="top" align="start" className="min-w-56">
                <DropdownMenuGroup>
                  <DropdownMenuLabel className="text-xs text-muted-foreground">{usuario.email}</DropdownMenuLabel>
                </DropdownMenuGroup>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={() => cerrarSesion()}>
                  <LogOutIcon />
                  Cerrar sesión
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>
      <SidebarRail />
    </Sidebar>
  )
}
