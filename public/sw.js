/**
 * Service worker de Abasto.
 *
 * Hace dos cosas y ninguna más, a propósito:
 *
 *  1. Da una pantalla decente cuando se cae la señal, en vez del dinosaurio.
 *  2. Existe. Chrome no ofrece instalar la app si no hay un service worker con
 *     un manejador de fetch, y sin instalar no hay notificaciones push en
 *     iPhone. O sea que este archivo es el permiso de entrada a las dos cosas.
 *
 * Lo que NO hace es guardar páginas en caché. Esta app muestra pedidos en
 * curso: servir una versión vieja sería peor que no mostrar nada. Siempre va a
 * la red primero y solo si no hay red muestra la pantalla de sin conexión.
 */
const CACHE = "abasto-v1"
const SIN_CONEXION = "/sin-conexion"

self.addEventListener("install", (evento) => {
  evento.waitUntil(
    caches
      .open(CACHE)
      .then((cache) => cache.addAll([SIN_CONEXION]))
      // Sin esto, la versión nueva espera a que se cierren todas las pestañas.
      .then(() => self.skipWaiting())
      .catch(() => self.skipWaiting()),
  )
})

self.addEventListener("activate", (evento) => {
  evento.waitUntil(
    caches
      .keys()
      .then((claves) =>
        Promise.all(claves.filter((c) => c !== CACHE).map((c) => caches.delete(c))),
      )
      .then(() => self.clients.claim()),
  )
})

self.addEventListener("fetch", (evento) => {
  const pedido = evento.request

  // Solo la navegación entre pantallas. Todo lo demás -- la API de Supabase,
  // las fotos, los archivos del build -- pasa derecho a la red.
  if (pedido.method !== "GET" || pedido.mode !== "navigate") return

  evento.respondWith(
    fetch(pedido).catch(() =>
      caches.match(SIN_CONEXION).then((r) => r ?? new Response("Sin conexión", { status: 503 })),
    ),
  )
})
