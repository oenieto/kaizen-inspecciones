import type { Metadata } from "next"
import { Suspense } from "react"
import { getTenant, listCuentasDemo } from "@/lib/data/catalogos"
import { LoginForm } from "./login-form"

export const metadata: Metadata = { title: "Iniciar sesión" }

export default function LoginPage() {
  return (
    <Suspense>
      <Login />
    </Suspense>
  )
}

async function Login() {
  const [tenant, cuentas] = await Promise.all([getTenant(), listCuentasDemo()])
  return (
    <main className="grid min-h-svh lg:grid-cols-[1.1fr_1fr]">
      <section className="hidden flex-col justify-between bg-black p-12 text-white lg:flex">
        <div className="flex items-center gap-3">
          <span className="flex size-9 items-center justify-center rounded-lg text-sm font-bold" style={{ background: tenant.colorPrimario }}>
            {tenant.nombreCorto.slice(0, 2).toUpperCase()}
          </span>
          <span className="text-lg font-bold tracking-tight">{tenant.nombreCorto}</span>
        </div>
        <div className="max-w-lg space-y-5">
          <p className="text-5xl leading-[1.05] font-bold tracking-tight">De la solicitud al dictamen en minutos, no en horas.</p>
          <p className="text-lg text-white/65">
            Unidad de Inspección acreditada por EMA · {tenant.acreditacionEma} · {tenant.ciudad}
          </p>
        </div>
        <p className="text-sm text-white/50">Demo con datos ficticios · Kaizen Code</p>
      </section>
      <section className="flex items-center justify-center bg-background p-6">
        <LoginForm
          tenantNombre={tenant.nombreCorto}
          cuentas={cuentas}
          contrasenaDemo={cuentas.length ? process.env.SEED_PASSWORD : undefined}
        />
      </section>
    </main>
  )
}
