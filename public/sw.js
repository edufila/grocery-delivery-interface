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

/**
 * El aviso llega sin contenido a propósito: mandarlo con texto obliga a
 * cifrarlo con el esquema del navegador, que es fácil de equivocar y falla en
 * silencio. Aquí se recibe el golpe y se le pregunta a la app qué mostrar; la
 * app sabe quién es esta persona por su sesión.
 *
 * Si la consulta falla -- sin señal, sesión vencida -- se muestra un aviso
 * genérico igual. Un push recibido y no mostrado hace que el navegador deje de
 * mandarlos, así que callarse no es una opción.
 */
self.addEventListener("push", (evento) => {
  evento.waitUntil(
    (async () => {
      let aviso = { titulo: "Abasto", cuerpo: "Tienes algo pendiente.", url: "/" }

      try {
        const r = await fetch("/api/aviso-pendiente", {
          credentials: "include",
          cache: "no-store",
        })
        if (r.ok) {
          const d = await r.json()
          if (d?.titulo) aviso = { titulo: d.titulo, cuerpo: d.cuerpo, url: d.url ?? "/" }
        }
      } catch {
        // Queda el aviso genérico.
      }

      await self.registration.showNotification(aviso.titulo, {
        body: aviso.cuerpo,
        icon: "/icon-192.png",
        badge: "/icon-192.png",
        // Un tema fijo: si entran tres pedidos, se reemplaza el aviso en vez de
        // apilar tres que dicen casi lo mismo.
        tag: "abasto",
        data: { url: aviso.url },
      })
    })(),
  )
})

/** Tocar el aviso lleva a donde hay que hacer algo, no a la portada. */
self.addEventListener("notificationclick", (evento) => {
  evento.notification.close()
  const destino = evento.notification.data?.url ?? "/"

  evento.waitUntil(
    (async () => {
      const abiertas = await self.clients.matchAll({
        type: "window",
        includeUncontrolled: true,
      })

      // Si ya hay una ventana de la app, se reusa: abrir otra deja al shopper
      // con tres copias de la app y el mapa corriendo en todas.
      for (const cliente of abiertas) {
        if ("focus" in cliente) {
          await cliente.navigate(destino).catch(() => {})
          return cliente.focus()
        }
      }

      return self.clients.openWindow(destino)
    })(),
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
