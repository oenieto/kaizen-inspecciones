/*
 * Service worker de la PWA de campo.
 * - Estáticos de Next (/_next/static): cache-first (son inmutables).
 * - Navegaciones a /campo: network-first con respaldo en caché, para abrir
 *   la ruta del día y las capturas ya visitadas sin señal.
 * La captura en sí vive en IndexedDB (Dexie); este archivo solo sirve la app.
 */
const CACHE = "uv-campo-v1"

self.addEventListener("install", () => self.skipWaiting())
self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))).then(() => self.clients.claim()),
  )
})

self.addEventListener("fetch", (event) => {
  const req = event.request
  if (req.method !== "GET") return
  const url = new URL(req.url)
  if (url.origin !== self.location.origin) return

  if (url.pathname.startsWith("/_next/static/") || url.pathname === "/icon.svg") {
    event.respondWith(
      caches.match(req).then(
        (hit) =>
          hit ||
          fetch(req).then((res) => {
            const copy = res.clone()
            caches.open(CACHE).then((c) => c.put(req, copy))
            return res
          }),
      ),
    )
    return
  }

  if (url.pathname.startsWith("/campo")) {
    event.respondWith(
      fetch(req)
        .then((res) => {
          if (res.ok) {
            const copy = res.clone()
            caches.open(CACHE).then((c) => c.put(req, copy))
          }
          return res
        })
        .catch(() => caches.match(req).then((hit) => hit || caches.match("/campo")).then((hit) => hit || Response.error())),
    )
  }
})
