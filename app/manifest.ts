import type { MetadataRoute } from "next"

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "UV Energía · Inspección en campo",
    short_name: "UV Campo",
    description: "Checklist, evidencias y firma en campo, con o sin conexión.",
    start_url: "/campo",
    scope: "/",
    display: "standalone",
    background_color: "#fafafa",
    theme_color: "#18181b",
    icons: [{ src: "/icon.svg", sizes: "any", type: "image/svg+xml", purpose: "any" }],
  }
}
