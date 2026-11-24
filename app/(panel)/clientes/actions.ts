"use server"

import { revalidatePath } from "next/cache"
import { z } from "zod"
import { requirePermiso } from "@/lib/auth"
import { ejecutar } from "@/lib/action-result"
import { getRamaActual } from "@/lib/data/catalogos"
import { createCliente, createInstalacion, getRfcCliente } from "@/lib/data/clientes"
import { resolverSugerenciaIA } from "@/lib/data/ia"
import { MAX_BYTES_PERMISO, TIPOS_ARCHIVO_PERMISO, leerPermiso } from "@/lib/ia/ocr-permiso"
import { sugerenciaInstalacion } from "@/lib/ia/permiso-reglas"
import { conLimiteIA, iaConfigurada } from "@/lib/ia/uso"

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
    await requirePermiso("clientes.editar")
    const c = await createCliente(clienteSchema.parse(input))
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
  /** Vigencia del permiso del cliente (YYYY-MM-DD) */
  permisoVigencia: z.iso.date("Fecha inválida").nullish(),
  /** Si el formulario se prellenó con leerPermisoConIA: id de esa solicitud */
  sugerenciaIaId: z.uuid().optional(),
})

export async function crearInstalacion(input: z.input<typeof instalacionSchema>) {
  return ejecutar(async () => {
    await requirePermiso("clientes.editar")
    const { sugerenciaIaId, ...data } = instalacionSchema.parse(input)
    const instalacion = await createInstalacion({ ...data, permisoVigencia: data.permisoVigencia ?? null, vencimiento: null })
    if (sugerenciaIaId) {
      // Bitácora: lo que sugirió la IA vs. lo que la persona guardó, y quién.
      // La instalación ya existe; si el registro falla se avisa en logs y no se deshace el alta.
      try {
        await resolverSugerenciaIA(sugerenciaIaId, {
          entidad: "instalacion",
          entidadId: instalacion.id,
          final: {
            nombre: data.nombre,
            tipo: data.tipo,
            direccion: data.direccion,
            municipio: data.municipio,
            permiso: data.permiso || null,
            permisoVigencia: data.permisoVigencia ?? null,
          },
        })
      } catch (e) {
        console.error("[ia] no se registró la decisión sobre la sugerencia", sugerenciaIaId, e)
      }
    }
    revalidatePath(`/clientes/${data.clienteId}`)
    return instalacion.id
  }, "Instalación agregada")
}

/**
 * OCR del permiso o constancia del cliente con IA. No guarda la instalación:
 * devuelve la sugerencia para prellenar el formulario; la persona la revisa y
 * al guardar manda `sugerenciaIaId` a crearInstalacion.
 *
 * FormData: `archivo` (JPG, PNG, WEBP o PDF ≤ 10 MB) y `clienteId` (opcional,
 * para cotejar el RFC del titular).
 */
export async function leerPermisoConIA(formData: FormData) {
  return ejecutar(async () => {
    const s = await requirePermiso("clientes.editar")
    if (!iaConfigurada()) throw new Error("La lectura con IA no está configurada (ANTHROPIC_API_KEY)")
    const archivo = formData.get("archivo")
    if (!(archivo instanceof File) || archivo.size === 0) throw new Error("Adjunta la foto o el PDF del permiso")
    if (archivo.size > MAX_BYTES_PERMISO) throw new Error("El archivo pasa de 10 MB")
    const tipo = TIPOS_ARCHIVO_PERMISO.find((t) => t === archivo.type)
    if (!tipo) throw new Error("Formato no admitido: usa JPG, PNG, WEBP o PDF")
    const clienteId = z.uuid().optional().catch(undefined).parse(formData.get("clienteId") ?? undefined)

    const [rama, rfcCliente] = await Promise.all([getRamaActual(), clienteId ? getRfcCliente(clienteId) : null])
    const base64 = Buffer.from(await archivo.arrayBuffer()).toString("base64")
    const { salida, solicitudId } = await conLimiteIA(
      { tenantId: s.tenant.id, usuarioId: s.usuario.id, funcion: "ocr_permiso" },
      () => leerPermiso({ base64, tipo }, { tiposInstalacion: rama.tiposInstalacion, rama: rama.nombre }),
      // Se guarda en la forma que ve el formulario: así se compara con lo que se guarde
      (l) => {
        const sug = sugerenciaInstalacion(l, { rfcCliente })
        return { ...sug.campos, titular: sug.titular, rfc: sug.rfc, tipoDocumento: sug.tipoDocumento, avisos: sug.avisos }
      },
    )
    return { sugerenciaIaId: solicitudId, ...sugerenciaInstalacion(salida, { rfcCliente }) }
  }, "Permiso leído: revisa los datos antes de guardar")
}

/** La persona decidió no usar la sugerencia de la IA (queda en bitácora). */
export async function descartarSugerenciaIA(sugerenciaIaId: string) {
  return ejecutar(async () => {
    await requirePermiso("clientes.editar")
    await resolverSugerenciaIA(z.uuid().parse(sugerenciaIaId), { descartar: true })
  })
}
