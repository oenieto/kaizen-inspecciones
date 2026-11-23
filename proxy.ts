import { NextResponse, type NextRequest } from "next/server"
import { actualizarSesion } from "@/lib/supabase/proxy"

const PROTEGIDAS = ["/dashboard", "/agenda", "/clientes", "/inspecciones", "/dictamenes", "/configuracion", "/campo"]

/** Refresca la sesión de Supabase; sin usuario no se entra al panel ni a campo. */
export async function proxy(request: NextRequest) {
  const { response, usuarioId } = await actualizarSesion(request)
  const ruta = request.nextUrl.pathname
  if (!usuarioId && PROTEGIDAS.some((p) => ruta === p || ruta.startsWith(`${p}/`))) {
    return NextResponse.redirect(new URL("/login", request.url))
  }
  return response
}

export const config = {
  matcher: [
    "/dashboard/:path*",
    "/agenda/:path*",
    "/clientes/:path*",
    "/inspecciones/:path*",
    "/dictamenes/:path*",
    "/configuracion/:path*",
    "/campo/:path*",
    "/api/:path*",
    "/login",
  ],
}
