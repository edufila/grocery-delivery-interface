"use client"

import { useCallback, useEffect, useRef, useState } from "react"

import { borrarPush, sePuedeRecibirPush, suscribirPush } from "@/lib/push-cliente"

/**
 * Un interruptor de avisos: suena, vibra y muestra una notificación.
 *
 * Lo usan el panel del shopper para los pedidos nuevos y el de administración
 * para los pagos reportados. Son la misma necesidad -- enterarse de algo sin
 * estar mirando la pantalla -- y antes estaba escrito dos veces.
 *
 * Encenderlo hace dos cosas a la vez, y es a propósito: prepara el aviso en
 * pantalla -- sonido, vibración, notificación -- y registra este navegador para
 * recibir avisos con la app cerrada. Es la misma intención dicha una sola vez;
 * pedir dos permisos para lo mismo solo consigue que la gente conceda uno.
 *
 * `cerrado` dice si lo segundo funcionó. No siempre funciona: en iPhone hace
 * falta tener la app instalada en la pantalla de inicio, y quien no la instaló
 * merece enterarse de por qué no le llega nada en vez de creer que sí.
 */
export function useAviso(clave: string) {
  const [encendido, setEncendido] = useState(false)
  const [permiso, setPermiso] = useState<NotificationPermission | "no-soportado">("default")
  const [cerrado, setCerrado] = useState(false)
  const audio = useRef<AudioContext | null>(null)

  useEffect(() => {
    const estaba = localStorage.getItem(clave) === "1"
    setEncendido(estaba)
    setPermiso("Notification" in window ? Notification.permission : "no-soportado")

    /**
     * Si ya estaba encendido de antes, se vuelve a registrar. Las suscripciones
     * de push caducan solas cada tanto y el navegador no avisa cuando pasa: sin
     * esto, un shopper dejaría de recibir avisos sin enterarse nunca.
     */
    if (estaba && sePuedeRecibirPush()) {
      void suscribirPush().then(setCerrado)
    }
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
      setCerrado(false)
      localStorage.setItem(clave, "0")
      void borrarPush()
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

    // Después de encender y no antes: sin permiso concedido no hay a qué
    // suscribirse, y el permiso se acaba de pedir justo arriba.
    setCerrado(await suscribirPush())
  }, [encendido, clave, sonar])

  return { encendido, alternar, avisar, cerrado, bloqueado: permiso === "denied" }
}
