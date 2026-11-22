"use server"

import { cookies } from "next/headers"
import { redirect } from "next/navigation"
import { SESSION_COOKIE } from "@/lib/auth"
import { listUsuarios } from "@/lib/data/catalogos"
import { inicioPorRol } from "@/lib/permisos"

/** BACKEND: sustituir por supabase.auth.signInWithPassword / signInWithOtp. */
export async function iniciarSesion(_prev: { error?: string }, formData: FormData): Promise<{ error?: string }> {
  const email = String(formData.get("email") ?? "").trim().toLowerCase()
  const usuario = (await listUsuarios()).find((u) => u.email === email)
  if (!usuario) return { error: "No existe una cuenta de demo con ese correo" }
  ;(await cookies()).set(SESSION_COOKIE, usuario.id, { httpOnly: true, sameSite: "lax", path: "/", maxAge: 60 * 60 * 12 })
  redirect(inicioPorRol(usuario.rol))
}

export async function cerrarSesion() {
  ;(await cookies()).delete(SESSION_COOKIE)
  redirect("/login")
}
