import { NextResponse, type NextRequest } from "next/server"

const SESSION_COOKIE = "uv_demo_session"

/** Revisión optimista: sin cookie de sesión no se entra al panel ni a campo. */
export function proxy(request: NextRequest) {
  if (!request.cookies.has(SESSION_COOKIE)) {
    return NextResponse.redirect(new URL("/login", request.url))
  }
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
  ],
}
