import type { NextConfig } from "next"

const nextConfig: NextConfig = {
  cacheComponents: true,
  partialPrefetching: true,
  // Plantilla .docx por defecto que lee /api/dictamen/[id] en tiempo de ejecución
  outputFileTracingIncludes: { "/api/dictamen/[id]": ["./templates/**"] },
  experimental: {
    // La sincronización de campo envía fotos (comprimidas) y firmas en una sola acción
    serverActions: { bodySizeLimit: "15mb" },
  },
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
  async headers() {
    return [
      {
        source: "/sw.js",
        headers: [
          { key: "Content-Type", value: "application/javascript; charset=utf-8" },
          { key: "Cache-Control", value: "no-cache, no-store, must-revalidate" },
          { key: "Content-Security-Policy", value: "default-src 'self'; script-src 'self'" },
        ],
      },
    ]
  },
}

export default nextConfig
