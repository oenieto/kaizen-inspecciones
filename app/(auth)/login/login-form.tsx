"use client"

import { useActionState, useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { etiquetaRol } from "@/lib/permisos"
import type { Rol } from "@/lib/types"
import { iniciarSesion } from "../actions"

export function LoginForm({
  tenantNombre,
  cuentas,
  contrasenaDemo,
}: {
  tenantNombre: string
  /** Atajos de la demo (vacío en productivo) */
  cuentas: { email: string; nombre: string; rol: Rol }[]
  contrasenaDemo?: string
}) {
  const [state, action, pending] = useActionState(iniciarSesion, {})
  const [email, setEmail] = useState(cuentas[0]?.email ?? "")

  return (
    <div className="w-full max-w-sm space-y-8">
      <div className="space-y-1.5">
        <h1 className="text-[32px] leading-tight font-bold tracking-tight">Iniciar sesión</h1>
        <p className="text-[15px] text-muted-foreground">Sistema de inspección de {tenantNombre}</p>
      </div>
      <div className="space-y-8">
        <form action={action} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="email">Correo</Label>
            <Input id="email" name="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required autoComplete="email" />
          </div>
          <div className="space-y-2">
            <Label htmlFor="password">Contraseña</Label>
            <Input id="password" name="password" type="password" defaultValue={contrasenaDemo} required autoComplete="current-password" />
          </div>
          {state.error && <p className="text-sm text-destructive" role="alert">{state.error}</p>}
          <Button type="submit" size="lg" className="w-full" disabled={pending}>
            {pending ? "Entrando…" : "Entrar"}
          </Button>
        </form>
        {cuentas.length > 0 && (
          <div className="space-y-2">
            <p className="text-xs font-semibold tracking-wider text-muted-foreground uppercase">Cuentas de demo · elige un rol</p>
            <div className="grid gap-1.5">
              {cuentas.map((c) => (
                <button
                  key={c.email}
                  type="button"
                  onClick={() => setEmail(c.email)}
                  className="flex min-h-11 items-center justify-between rounded-lg border border-transparent bg-muted px-4 py-2.5 text-left text-sm font-medium transition-colors hover:bg-secondary aria-pressed:border-primary aria-pressed:bg-background"
                  aria-pressed={email === c.email}
                >
                  <span>{c.nombre}</span>
                  <span className="text-xs font-normal text-muted-foreground">{etiquetaRol[c.rol]}</span>
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
