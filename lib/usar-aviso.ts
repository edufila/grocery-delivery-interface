"use client"

import { useCallback, useEffect, useRef, useState } from "react"

/**
 * Un interruptor de avisos: suena, vibra y muestra una notificación.
 *
 * Lo usan el panel del shopper para los pedidos nuevos y el de administración
 * para los pagos reportados. Son la misma necesidad -- enterarse de algo sin
 * estar mirando la pantalla -- y antes estaba escrito dos veces.
 *
 * El aviso solo llega con la app abierta. Para que llegue cerrada hacen falta
 * notificaciones push, que necesitan servidor.
 */
export function useAviso(clave: string) {
  const [encendido, setEncendido] = useState(false)
  const [permiso, setPermiso] = useState<NotificationPermission | "no-soportado">("default")
  const audio = useRef<AudioContext | null>(null)

  useEffect(() => {
    setEncendido(localStorage.getItem(clave) === "1")
    setPermiso("Notification" in window ? Notification.permission : "no-soportado")
  }, [clave])

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

  /** Avisa por los tres canales a la vez. */
  const avisar = useCallback(
    (titulo: string, cuerpo: string, etiqueta?: string) => {
      sonar()
      navigator.vibrate?.([220, 90, 220])

      if ("Notification" in window && Notification.permission === "granted") {
        new Notification(titulo, {
          body: cuerpo,
          icon: "/icon-192.png",
          badge: "/icon-192.png",
          tag: etiqueta,
        })
      }
    },
    [sonar],
  )

  const alternar = useCallback(async () => {
    if (encendido) {
      setEncendido(false)
      localStorage.setItem(clave, "0")
      return
    }

    /**
     * El audio se prepara aquí y no al recibir el aviso: los navegadores solo
     * dejan sonar si hubo un toque de por medio, y este es el toque.
     */
    try {
      const Ctx =
        window.AudioContext ??
        (window as never as { webkitAudioContext: typeof AudioContext }).webkitAudioContext
      audio.current = audio.current ?? new Ctx()
      await audio.current.resume()
    } catch {
      // Igual queda la vibración.
    }

    if ("Notification" in window && Notification.permission === "default") {
      setPermiso(await Notification.requestPermission())
    }

    setEncendido(true)
    localStorage.setItem(clave, "1")
    sonar()
  }, [encendido, clave, sonar])

  return { encendido, alternar, avisar, bloqueado: permiso === "denied" }
}
