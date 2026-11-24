"use client"

import { hashEvidencia } from "./captura"
import type { FotoLocal } from "./db"

/** Reduce la foto a ≤1280 px en JPEG para que quepa en IndexedDB y en la sincronización. */
async function comprimir(file: File, maxLado = 1280, calidad = 0.72) {
  const bitmap = await createImageBitmap(file)
  const escala = Math.min(1, maxLado / Math.max(bitmap.width, bitmap.height))
  const canvas = document.createElement("canvas")
  canvas.width = Math.round(bitmap.width * escala)
  canvas.height = Math.round(bitmap.height * escala)
  canvas.getContext("2d")!.drawImage(bitmap, 0, 0, canvas.width, canvas.height)
  return canvas.toDataURL("image/jpeg", calidad)
}

function ubicacion(): Promise<{ lat: number; lng: number } | null> {
  if (!("geolocation" in navigator)) return Promise.resolve(null)
  return new Promise((resolve) =>
    navigator.geolocation.getCurrentPosition(
      (p) => resolve({ lat: p.coords.latitude, lng: p.coords.longitude }),
      () => resolve(null),
      { enableHighAccuracy: true, timeout: 8000, maximumAge: 60_000 },
    ),
  )
}

/**
 * Foto de evidencia con fecha/hora, geolocalización (si el permiso lo da) y
 * hash SHA-256 de los bytes JPEG exactos que se subirán a Storage; el servidor
 * lo recalcula al sincronizar.
 */
export async function prepararFoto(file: File): Promise<FotoLocal> {
  const [dataUrl, geo] = await Promise.all([comprimir(file), ubicacion()])
  const bytes = await (await fetch(dataUrl)).arrayBuffer()
  return {
    id: crypto.randomUUID(),
    nombre: file.name || "foto.jpg",
    dataUrl,
    lat: geo?.lat ?? null,
    lng: geo?.lng ?? null,
    tomadaEn: new Date().toISOString(),
    hash: await hashEvidencia(bytes),
  }
}
