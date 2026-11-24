import "server-only"
import { createAdminClient } from "@/lib/supabase/admin"
import type { Json } from "@/lib/supabase/database.types"

/**
 * Límite de uso y registro de cada llamada a Claude (tabla ia_solicitudes).
 * Usa service_role a propósito: también corre dentro de funciones "use cache"
 * (sin cookies). Quien llama ya validó sesión y permiso.
 */

export type FuncionIA = "ocr_permiso" | "completitud"

export const modeloIA = () => process.env.ANTHROPIC_MODEL || "claude-opus-5-5"
export const iaConfigurada = () => Boolean(process.env.ANTHROPIC_API_KEY)

/** Lo que se necesita de la respuesta del modelo para registrar el consumo. */
interface RespuestaModelo {
  model: string
  usage: { input_tokens: number; output_tokens: number }
}

interface Contexto {
  tenantId: string
  /** null = proceso automático (sin persona que lo dispare) */
  usuarioId: string | null
  funcion: FuncionIA
}

/**
 * Reserva un lugar dentro del límite mensual del tenant, ejecuta la llamada y
 * registra modelo, tokens y la sugerencia (o el error). Si el límite se
 * alcanzó, lanza un error con el mensaje para el usuario y no llama al modelo.
 */
export async function conLimiteIA<T>(
  ctx: Contexto,
  llamar: () => Promise<{ salida: T; respuesta: RespuestaModelo }>,
  /** Qué se guarda como sugerencia (por defecto, la salida completa) */
  aSugerencia: (salida: T) => unknown = (s) => s,
): Promise<{ salida: T; solicitudId: string }> {
  const admin = createAdminClient()
  const reserva = await admin.rpc("ia_reservar", { p_tenant: ctx.tenantId, p_usuario: ctx.usuarioId, p_funcion: ctx.funcion })
  if (reserva.error) throw new Error(reserva.error.message)
  const solicitudId = reserva.data

  try {
    const { salida, respuesta } = await llamar()
    await completar(solicitudId, {
      p_modelo: respuesta.model,
      p_tokens_entrada: respuesta.usage.input_tokens,
      p_tokens_salida: respuesta.usage.output_tokens,
      p_sugerencia: aSugerencia(salida) as Json,
      p_error: null,
    })
    return { salida, solicitudId }
  } catch (e) {
    await completar(solicitudId, {
      p_modelo: modeloIA(),
      p_tokens_entrada: null,
      p_tokens_salida: null,
      p_sugerencia: null,
      p_error: e instanceof Error ? e.message : String(e),
    })
    throw e
  }
}

interface Cierre {
  p_modelo: string
  p_tokens_entrada: number | null
  p_tokens_salida: number | null
  p_sugerencia: Json | null
  p_error: string | null
}

async function completar(id: string, datos: Cierre) {
  const { error } = await createAdminClient().rpc("ia_completar", { p_id: id, ...datos })
  // No tumba la respuesta al usuario, pero se ve en los logs del servidor.
  if (error) console.error("[ia] no se pudo registrar la solicitud", id, error.message)
}
