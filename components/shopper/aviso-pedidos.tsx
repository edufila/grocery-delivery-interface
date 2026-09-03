"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import { useRouter } from "next/navigation"
import { Bell, BellOff } from "lucide-react"

import { createClient } from "@/lib/supabase/client"
import { isSupabaseConfigured } from "@/lib/supabase/config"

const GUARDADO = "abasto:avisos-shopper"

/**
 * Avisa al shopper cuando entra un pedido sin dueño.
 *
 * Hasta ahora la lista se actualizaba sola pero en silencio: había que estar
 * mirando la pantalla. Con el teléfono en el bolsillo, el pedido se enfriaba.
 *
 * Suena, vibra y muestra una notificación del sistema. Eso último solo llega
 * mientras la app esté abierta -- para que avise con la app cerrada hacen falta
 * notificaciones push, que necesitan servidor. Esto cubre el turno de guardia,
 * que es cuando importa.
 */
export function AvisoPedidos({ userId }: { userId: string }) {
  const router = useRouter()
  const [encendido, setEncendido] = useState(false)
  const [permiso, setPermiso] = useState<NotificationPermission | "no-soportado">("default")
  const audio = useRef<AudioContext | null>(null)

  useEffect(() => {
    setEncendido(localStorage.getItem(GUARDADO) === "1")
    setPermiso("Notification" in window ? Notification.permission : "no-soportado")
  }, [])

  /**
   * Un pitido armado en el momento. Un archivo de sonido habría que cargarlo, y
   * si justo no hay señal el aviso se queda mudo.
   */
  const sonar = useCallback(() => {
    try {
      const ctx = audio.current
      if (!ctx) return

      const ahora = ctx.currentTime
      // Dos notas cortas: se distingue de la notificación de cualquier otra app.
      for (const [desfase, hz] of [
        [0, 880],
        [0.18, 1174],
      ] as const) {
        const osc = ctx.createOscillator()
        const vol = ctx.createGain()
        osc.frequency.value = hz
        osc.type = "sine"
        // Con un corte seco se escucha un chasquido; esto lo apaga suave.
        vol.gain.setValueAtTime(0.0001, ahora + desfase)
        vol.gain.exponentialRampToValueAtTime(0.35, ahora + desfase + 0.02)
        vol.gain.exponentialRampToValueAtTime(0.0001, ahora + desfase + 0.16)
        osc.connect(vol).connect(ctx.destination)
        osc.start(ahora + desfase)
        osc.stop(ahora + desfase + 0.18)
      }
    } catch {
      // Sin audio queda la vibración y la notificación.
    }
  }, [])

  useEffect(() => {
    if (!encendido || !isSupabaseConfigured) return

    const supabase = createClient()
    const canal = supabase
      .channel("aviso-pedidos")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "orders" },
        (payload) => {
          const fila = payload.new as { shopper_id: string | null; code: string }
          // Solo los que están esperando a alguien. Los propios ya se saben.
          if (fila.shopper_id) return

          sonar()
          navigator.vibrate?.([220, 90, 220])

          if ("Notification" in window && Notification.permission === "granted") {
            new Notification("Pedido nuevo", {
              body: `El ${fila.code} está esperando shopper.`,
              icon: "/icon-192.png",
              badge: "/icon-192.png",
              tag: `pedido-${fila.code}`,
            })
          }

          router.refresh()
        },
      )
      .subscribe()

    return () => {
      void supabase.removeChannel(canal)
    }
  }, [encendido, sonar, router, userId])

  async function alternar() {
    if (encendido) {
      setEncendido(false)
      localStorage.setItem(GUARDADO, "0")
      return
    }

    /**
     * El audio se prepara aquí y no al escuchar el pedido: los navegadores solo
     * dejan sonar si hubo un toque de por medio, y este es el toque.
     */
    try {
      const Ctx = window.AudioContext ?? (window as never as { webkitAudioContext: typeof AudioContext }).webkitAudioContext
      audio.current = audio.current ?? new Ctx()
      await audio.current.resume()
    } catch {
      // Igual queda la vibración.
    }

    if ("Notification" in window && Notification.permission === "default") {
      setPermiso(await Notification.requestPermission())
    }

    setEncendido(true)
    localStorage.setItem(GUARDADO, "1")
    sonar()
  }

  const bloqueado = permiso === "denied"

  return (
    <section className="rounded-2xl border border-gray-100 bg-white p-4">
      <div className="flex items-center gap-3">
        <span
          className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full ${
            encendido ? "bg-emerald-50" : "bg-gray-100"
          }`}
        >
          {encendido ? (
            <Bell className="h-5 w-5 text-emerald-600" aria-hidden="true" />
          ) : (
            <BellOff className="h-5 w-5 text-gray-400" aria-hidden="true" />
          )}
        </span>

        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold text-gray-900">Avisarme de pedidos nuevos</p>
          <p className="text-sm leading-relaxed text-gray-500">
            {encendido
              ? "Suena y vibra cuando entra uno. Deja esta pantalla abierta."
              : "Ahora mismo tienes que estar mirando la pantalla."}
          </p>
        </div>

        <button
          type="button"
          onClick={() => void alternar()}
          role="switch"
          aria-checked={encendido}
          aria-label="Avisarme de pedidos nuevos"
          className={`relative h-7 w-12 shrink-0 rounded-full transition ${
            encendido ? "bg-emerald-600" : "bg-gray-200"
          }`}
        >
          <span
            className={`absolute top-1 h-5 w-5 rounded-full bg-white transition-all ${
              encendido ? "left-6" : "left-1"
            }`}
          />
        </button>
      </div>

      {encendido && bloqueado && (
        <p className="mt-3 rounded-xl bg-amber-50 px-3 py-2.5 text-sm leading-relaxed text-amber-800">
          Bloqueaste las notificaciones para este sitio, así que solo va a sonar y vibrar. Para
          verlas en la pantalla hay que habilitarlas en los ajustes del navegador.
        </p>
      )}
    </section>
  )
}
