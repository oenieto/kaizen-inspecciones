"use client"

import { useSyncExternalStore } from "react"

/**
 * Estado de red de la PWA. Además de navigator.onLine permite «simular sin
 * conexión» para la demo (modo avión en el escenario sin apagar el wifi).
 */
const KEY = "uv-simular-offline"
const listeners = new Set<() => void>()

function simulado() {
  try {
    return localStorage.getItem(KEY) === "1"
  } catch {
    return false
  }
}

export function setSimularOffline(v: boolean) {
  try {
    localStorage.setItem(KEY, v ? "1" : "0")
  } catch {}
  listeners.forEach((l) => l())
  if (!v) window.dispatchEvent(new Event("online"))
}

function subscribe(cb: () => void) {
  listeners.add(cb)
  window.addEventListener("online", cb)
  window.addEventListener("offline", cb)
  return () => {
    listeners.delete(cb)
    window.removeEventListener("online", cb)
    window.removeEventListener("offline", cb)
  }
}

export function estaEnLinea() {
  return navigator.onLine && !simulado()
}

export function useEnLinea() {
  return useSyncExternalStore(subscribe, estaEnLinea, () => true)
}
