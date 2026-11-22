"use server"

import { revalidatePath } from "next/cache"
import { z } from "zod"
import { requirePermiso } from "@/lib/auth"
import { ejecutar } from "@/lib/action-result"
import { createCliente, createInstalacion } from "@/lib/data/clientes"

const clienteSchema = z.object({
  razonSocial: z.string().trim().min(3, "Razón social requerida"),
  rfc: z.string().trim().toUpperCase().regex(/^[A-ZÑ&]{3,4}\d{6}[A-Z0-9]{3}$/, "RFC con formato inválido"),
  giro: z.string().min(1, "Elige un giro"),
  contacto: z.string().trim().min(2, "Contacto requerido"),
  telefono: z.string().trim().min(7, "Teléfono requerido"),
  email: z.email("Correo inválido"),
})

export async function crearCliente(input: z.input<typeof clienteSchema>) {
  return ejecutar(async () => {
    const s = await requirePermiso("clientes.editar")
    const c = await createCliente(clienteSchema.parse(input), s.usuario.id)
    revalidatePath("/clientes")
    return c.id
  }, "Cliente creado")
}

const instalacionSchema = z.object({
  clienteId: z.string().min(1),
  nombre: z.string().trim().min(2, "Nombre requerido"),
  tipo: z.string().min(1, "Elige un tipo"),
  direccion: z.string().trim().min(5, "Dirección requerida"),
  municipio: z.string().trim().min(2, "Municipio requerido"),
  lat: z.coerce.number().min(14).max(33),
  lng: z.coerce.number().min(-118).max(-86),
  permiso: z.string().trim(),
})

export async function crearInstalacion(input: z.input<typeof instalacionSchema>) {
  return ejecutar(async () => {
    const s = await requirePermiso("clientes.editar")
    const data = instalacionSchema.parse(input)
    await createInstalacion({ ...data, vencimiento: null }, s.usuario.id)
    revalidatePath(`/clientes/${data.clienteId}`)
  }, "Instalación agregada")
}
