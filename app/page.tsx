import { Suspense } from "react"
import { redirect } from "next/navigation"
import { getSession } from "@/lib/auth"
import { inicioPorRol } from "@/lib/permisos"

async function Redirigir() {
  const s = await getSession()
  redirect(s ? inicioPorRol(s.usuario.rol) : "/login")
  return null
}

export default function Home() {
  return (
    <Suspense>
      <Redirigir />
    </Suspense>
  )
}
