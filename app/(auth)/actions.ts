"use server"

import { redirect } from "next/navigation"
import { createClient } from "@/lib/supabase/server"
import { inicioPorRol } from "@/lib/permisos"

export async function iniciarSesion(_prev: { error?: string }, formData: FormData): Promise<{ error?: string }> {
  const email = String(formData.get("email") ?? "").trim().toLowerCase()
  const password = String(formData.get("password") ?? "")
  if (!email || !password) return { error: "Escribe tu correo y contraseña" }

  const supabase = await createClient()
  const { data, error } = await supabase.auth.signInWithPassword({ email, password })
  if (error) {
    if (error.code === "invalid_credentials") return { error: "Correo o contraseña incorrectos" }
    if (error.status === 429) return { error: "Demasiados intentos. Espera unos minutos." }
    console.error("[auth]", error.code, error.message)
    return { error: "No se pudo iniciar sesión" }
  }

  const { data: usuario } = await supabase.from("usuarios").select("rol").eq("id", data.user.id).eq("activo", true).maybeSingle()
  if (!usuario) {
    await supabase.auth.signOut()
    return { error: "Tu cuenta no tiene acceso a este sistema" }
  }
  redirect(inicioPorRol(usuario.rol))
}

export async function cerrarSesion() {
  const supabase = await createClient()
  await supabase.auth.signOut()
  redirect("/login")
}
