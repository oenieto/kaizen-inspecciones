"use client"

import { useEffect, useRef } from "react"

export interface Parada {
  id: string
  lat: number
  lng: number
  titulo: string
}

/**
 * Mapa de la ruta del día. Con NEXT_PUBLIC_MAPBOX_TOKEN usa Mapbox; sin token
 * dibuja un croquis con las paradas en orden, para que la demo funcione igual.
 * BACKEND/Fase 3: la ruta real (Directions API / optimización) reemplaza la
 * línea recta entre paradas.
 */
export function MapaRuta({ paradas, token, className = "h-72" }: { paradas: Parada[]; token: string; className?: string }) {
  if (!token) return <Croquis paradas={paradas} className={className} />
  return <MapaMapbox paradas={paradas} token={token} className={className} />
}

function MapaMapbox({ paradas, token, className }: { paradas: Parada[]; token: string; className: string }) {
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!ref.current) return
    let map: import("mapbox-gl").Map | undefined
    let cancelado = false
    // El CSS se carga junto con la librería: importarlo arriba lo precargaba en
    // cada página aunque sin token nunca se usa (aviso en consola).
    Promise.all([import("mapbox-gl"), import("mapbox-gl/dist/mapbox-gl.css")]).then(([{ default: mapboxgl }]) => {
      if (cancelado || !ref.current) return
      mapboxgl.accessToken = token
      map = new mapboxgl.Map({ container: ref.current, style: "mapbox://styles/mapbox/streets-v12", center: [-100.39, 20.62], zoom: 10 })
      const bounds = new mapboxgl.LngLatBounds()
      paradas.forEach((p, i) => {
        const el = document.createElement("div")
        el.className = "flex size-7 items-center justify-center rounded-full bg-primary text-xs font-semibold text-primary-foreground shadow"
        el.textContent = String(i + 1)
        new mapboxgl.Marker({ element: el }).setLngLat([p.lng, p.lat]).setPopup(new mapboxgl.Popup().setText(p.titulo)).addTo(map!)
        bounds.extend([p.lng, p.lat])
      })
      map.on("load", () => {
        if (paradas.length > 1) {
          map!.addSource("ruta", { type: "geojson", data: { type: "Feature", properties: {}, geometry: { type: "LineString", coordinates: paradas.map((p) => [p.lng, p.lat]) } } })
          map!.addLayer({ id: "ruta", type: "line", source: "ruta", paint: { "line-color": "#0b5cad", "line-width": 3, "line-dasharray": [2, 1] } })
        }
        if (paradas.length) map!.fitBounds(bounds, { padding: 48, maxZoom: 14 })
      })
    })
    return () => {
      cancelado = true
      map?.remove()
    }
  }, [paradas, token])

  return <div ref={ref} className={`w-full overflow-hidden rounded-lg ${className}`} />
}

function Croquis({ paradas, className }: { paradas: Parada[]; className: string }) {
  const W = 340
  const H = 240
  const pad = 28
  const lats = paradas.map((p) => p.lat)
  const lngs = paradas.map((p) => p.lng)
  const [minLat, maxLat, minLng, maxLng] = [Math.min(...lats), Math.max(...lats), Math.min(...lngs), Math.max(...lngs)]
  // Con una sola parada (o todas en el mismo punto) se centra en el croquis
  const x = (lng: number) => (maxLng === minLng ? W / 2 : pad + ((lng - minLng) / (maxLng - minLng)) * (W - 2 * pad))
  const y = (lat: number) => (maxLat === minLat ? H / 2 : H - pad - ((lat - minLat) / (maxLat - minLat)) * (H - 2 * pad))

  return (
    <div className={`relative w-full overflow-hidden rounded-lg border bg-muted/40 ${className}`}>
      <svg viewBox={`0 0 ${W} ${H}`} className="size-full" role="img" aria-label="Croquis de la ruta del día">
        <defs>
          <pattern id="grid" width="20" height="20" patternUnits="userSpaceOnUse">
            <path d="M20 0H0V20" fill="none" stroke="var(--border)" strokeWidth="1" />
          </pattern>
        </defs>
        <rect width={W} height={H} fill="url(#grid)" />
        {paradas.length > 1 && (
          <polyline points={paradas.map((p) => `${x(p.lng)},${y(p.lat)}`).join(" ")} fill="none" stroke="var(--primary)" strokeWidth="2.5" strokeDasharray="6 4" />
        )}
        {paradas.map((p, i) => (
          <g key={p.id}>
            <circle cx={x(p.lng)} cy={y(p.lat)} r="11" fill="var(--primary)" />
            <text x={x(p.lng)} y={y(p.lat) + 4} textAnchor="middle" fontSize="11" fontWeight="600" fill="white">{i + 1}</text>
          </g>
        ))}
      </svg>
      {paradas.length === 0 && <p className="absolute inset-0 flex items-center justify-center text-sm text-muted-foreground">Sin citas para este día</p>}
      <p className="absolute right-2 bottom-1.5 text-[10px] text-muted-foreground">Croquis · configura NEXT_PUBLIC_MAPBOX_TOKEN para el mapa real</p>
    </div>
  )
}
