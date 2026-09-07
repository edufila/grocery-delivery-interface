"use client"

import { createClient } from "@/lib/supabase/client"
import { isSupabaseConfigured } from "@/lib/supabase/config"

/**
 * Apuntarse -- y darse de baja -- para recibir avisos con la app cerrada.
 *
 * Lo dispara el mismo interruptor de "avísame" que ya existía: encenderlo pide
 * permiso, prepara el sonido y, ahora, deja al navegador registrado para que le
 * lleguen avisos aunque nadie tenga la pantalla abierta. Son la misma intención
 * y no había razón para pedir dos permisos distintos.
 *
 * Nada de esto lanza. Un navegador viejo, un permiso negado o una tabla que
 * todavía no existe no pueden impedir que el aviso en pantalla siga sonando,
 * que es lo que funcionaba antes de todo esto.
 */

/**
 * La clave pública viaja como texto en base64url y `subscribe` la quiere en
 * bytes. Es la misma que está en el código y en Vercel: es pública a propósito.
 */
function aBytes(base64url: string) {
  const relleno = "=".repeat((4 - (base64url.length % 4)) % 4)
  const normal = (base64url + relleno).replace(/-/g, "+").replace(/_/g, "/")
  const crudo = atob(normal)
  const bytes = new Uint8Array(crudo.length)
  for (let i = 0; i < crudo.length; i += 1) bytes[i] = crudo.charCodeAt(i)
  return bytes
}

/** Las dos claves con las que el servicio de push cifraría el aviso. */
function clavesDe(sub: PushSubscription) {
  const leer = (nombre: "p256dh" | "auth") => {
    const buffer = sub.getKey(nombre)
    if (!buffer) return null
    return btoa(String.fromCharCode(...new Uint8Array(buffer)))
      .replace(/\+/g, "-")
      .replace(/\//g, "_")
      .replace(/=+$/, "")
  }

  const p256dh = leer("p256dh")
  const auth = leer("auth")
  return p256dh && auth ? { p256dh, auth } : null
}

export function sePuedeRecibirPush() {
  return (
    typeof window !== "undefined" &&
    "serviceWorker" in navigator &&
    "PushManager" in window &&
    Boolean(process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY)
  )
}

/**
 * Registra este navegador para recibir avisos.
 *
 * Devuelve si quedó registrado, para poder decirlo en pantalla: en iPhone la
 * diferencia entre estar y no estar es haber instalado la app en la pantalla de
 * inicio, y quien no lo hizo merece enterarse de por qué no le llega nada.
 */
export async function suscribirPush(): Promise<boolean> {
  if (!sePuedeRecibirPush() || !isSupabaseConfigured) return false
  if (Notification.permission !== "granted") return false

  try {
    const registro = await navigator.serviceWorker.ready

    const sub =
      (await registro.pushManager.getSubscription()) ??
      (await registro.pushManager.subscribe({
        // Obligatorio en todos los navegadores: nos comprometemos a que cada
        // golpe termine en un aviso visible. El service worker lo cumple, y por
        // eso muestra uno genérico cuando no puede preguntar qué decir.
        userVisibleOnly: true,
        applicationServerKey: aBytes(process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY as string),
      }))

    const claves = clavesDe(sub)
    if (!claves) return false

    const supabase = createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) return false

    /**
     * `upsert` y no `insert`: el mismo navegador vuelve a dar el mismo endpoint
     * cada vez, y reinstalar la app o volver a encender el interruptor no debe
     * fallar por una fila que ya estaba.
     */
    const { error } = await supabase.from("push_subscriptions").upsert(
      {
        endpoint: sub.endpoint,
        user_id: user.id,
        p256dh: claves.p256dh,
        auth: claves.auth,
      },
      { onConflict: "endpoint" },
    )

    // Falta correr la 0036. El aviso en pantalla sigue funcionando igual.
    return !error
  } catch {
    return false
  }
}

/**
 * Deja de recibir avisos cerrados.
 *
 * Se borra la fila pero no se cancela la suscripción del navegador: cancelarla
 * obliga a pedir permiso otra vez al volver a encender, y en iPhone eso a veces
 * significa reinstalar la app. Sin fila, nadie tiene a dónde mandar nada.
 */
export async function borrarPush() {
  if (!sePuedeRecibirPush() || !isSupabaseConfigured) return

  try {
    const registro = await navigator.serviceWorker.ready
    const sub = await registro.pushManager.getSubscription()
    if (!sub) return

    await createClient().from("push_subscriptions").delete().eq("endpoint", sub.endpoint)
  } catch {
    // Si no se pudo borrar, lo peor que pasa es un aviso de más.
  }
}

/**
 * Le pide al servidor que despierte a quien corresponda.
 *
 * Quién es "quien corresponda" lo decide el servidor mirando qué tiene esta
 * persona, no lo que diga este llamado: ver `/api/avisar`.
 */
export async function avisarAlEquipo(motivo: "pago-reportado" | "pedido-listo") {
  try {
    await fetch("/api/avisar", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ motivo }),
    })
  } catch {
    // El aviso es un extra: que no llegue no puede romper lo que lo disparó.
  }
}
