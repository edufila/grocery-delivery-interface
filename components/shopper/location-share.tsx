"use client"

import { useEffect, useRef, useState } from "react"
import { Loader2, MapPin, MapPinOff } from "lucide-react"

import { createClient } from "@/lib/supabase/client"

/** Cada cuánto se manda la posición. Más seguido no aporta y gasta batería. */
const SEND_EVERY_MS = 15_000

/**
 * Máxima imprecisión aceptable, en metros. Un GPS de celular anda en 5 a 50;
 * la ubicación por IP se va a miles, y con VPN además cae en otro país.
 */
const MAX_ACCURACY_M = 500

type Estado = {
  sharing: boolean
  lastSent: Date | null
  error: string
  buscandoSenal: boolean
}

export function LocationShare({
  orderId,
  onSharingChange,
  onPosition,
}: {
  orderId: string
  onSharingChange?: (sharing: boolean) => void
  onPosition?: (coords: { lat: number; lng: number }) => void
}) {
  const [estado, setEstado] = useState<Estado>({
    sharing: false,
    lastSent: null,
    error: "",
    buscandoSenal: false,
  })
  const watchRef = useRef<number | null>(null)
  const lastSentAt = useRef(0)
  const wakeLockRef = useRef<WakeLockSentinel | null>(null)

  /**
   * Al desmontarse se corta el seguimiento y se suelta la pantalla. Es lo que
   * apaga la ubicación al entregar: el pedido cambia de estado, quien nos
   * renderiza deja de hacerlo, y esto se ejecuta. Seguir transmitiendo la
   * posición de alguien cuando ya nadie la mira gasta su batería y sus datos.
   */
  useEffect(() => {
    return () => {
      if (watchRef.current !== null) navigator.geolocation.clearWatch(watchRef.current)
      void wakeLockRef.current?.release()
    }
  }, [])

  /**
   * Volver a pedir la pantalla encendida al regresar a la app.
   *
   * El sistema suelta el bloqueo solo en cuanto la pantalla se apaga o el
   * shopper se va a otra app -- a ver el mapa, a contestar un mensaje -- y no
   * lo devuelve al volver. Sin esto, el bloqueo servía una sola vez: a la
   * primera interrupción la pantalla volvía a apagarse sola, el navegador
   * suspendía el JavaScript, y la ubicación dejaba de viajar en mitad de la
   * entrega. Que es justo cuando el cliente está mirando el mapa.
   */
  useEffect(() => {
    if (!estado.sharing) return

    const alVolver = async () => {
      if (document.visibilityState !== "visible" || wakeLockRef.current) return
      try {
        wakeLockRef.current = (await navigator.wakeLock?.request("screen")) ?? null
        // El sistema avisa cuando lo suelta; sin limpiar la referencia,
        // creeríamos que sigue tomado y no lo volveríamos a pedir.
        wakeLockRef.current?.addEventListener("release", () => {
          wakeLockRef.current = null
        })
      } catch {
        // Navegador que no lo permite, o pantalla ya apagada. Se reintenta la
        // próxima vez que vuelva a primer plano.
      }
    }

    document.addEventListener("visibilitychange", alVolver)
    return () => document.removeEventListener("visibilitychange", alVolver)
  }, [estado.sharing])

  async function start() {
    if (!("geolocation" in navigator)) {
      setEstado((e) => ({ ...e, error: "Este navegador no da acceso a la ubicación." }))
      return
    }

    const supabase = createClient()

    watchRef.current = navigator.geolocation.watchPosition(
      async (position) => {
        // Antes de que el GPS resuelva, el navegador contesta con la ubicación
        // de red, que con VPN cae en otro país. Esas lecturas vienen con
        // precisión de kilómetros: se descartan y se espera la buena.
        if (position.coords.accuracy > MAX_ACCURACY_M) {
          setEstado((e) => ({ ...e, buscandoSenal: true }))
          return
        }
        setEstado((e) => (e.buscandoSenal ? { ...e, buscandoSenal: false } : e))

        // El mapa de al lado se mueve con cada lectura, aunque a la base solo
        // le mandemos una cada tanto.
        onPosition?.({ lat: position.coords.latitude, lng: position.coords.longitude })

        const now = Date.now()
        if (now - lastSentAt.current < SEND_EVERY_MS) return
        lastSentAt.current = now

        const { error } = await supabase
          .from("orders")
          .update({
            shopper_lat: position.coords.latitude,
            shopper_lng: position.coords.longitude,
            shopper_located_at: new Date().toISOString(),
          })
          .eq("id", orderId)

        setEstado((e) => ({
          ...e,
          lastSent: error ? e.lastSent : new Date(),
          error: error ? "No pudimos enviar la posición." : "",
        }))
      },
      (geoError) => {
        onSharingChange?.(false)
        setEstado((e) => ({
          ...e,
          sharing: false,
          error:
            geoError.code === geoError.PERMISSION_DENIED
              ? "Bloqueaste el permiso de ubicación. Habilítalo en los ajustes del navegador."
              : "No pudimos leer tu ubicación.",
        }))
      },
      // maximumAge 0: nada de lecturas guardadas, que suelen ser las de red.
      { enableHighAccuracy: true, maximumAge: 0, timeout: 20_000 },
    )

    setEstado((e) => ({ ...e, sharing: true, error: "" }))
    onSharingChange?.(true)

    // Mantiene la pantalla encendida: con el teléfono bloqueado el navegador
    // suspende el JavaScript y la posición deja de viajar.
    try {
      wakeLockRef.current = await navigator.wakeLock?.request("screen")
    } catch {
      // No todos los navegadores lo permiten. No es motivo para no compartir.
    }
  }

  function stop() {
    if (watchRef.current !== null) {
      navigator.geolocation.clearWatch(watchRef.current)
      watchRef.current = null
    }
    void wakeLockRef.current?.release()
    wakeLockRef.current = null
    setEstado((e) => ({ ...e, sharing: false }))
    onSharingChange?.(false)
  }

  return (
    <section className="rounded-2xl border border-gray-100 bg-white p-4">
      <div className="flex items-start gap-3">
        <span
          className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full ${
            estado.sharing ? "bg-emerald-50" : "bg-gray-100"
          }`}
        >
          {estado.sharing ? (
            <MapPin className="h-5 w-5 text-emerald-600" aria-hidden="true" />
          ) : (
            <MapPinOff className="h-5 w-5 text-gray-400" aria-hidden="true" />
          )}
        </span>
        <div className="min-w-0 flex-1">
          <h2 className="text-sm font-semibold text-gray-900">
            {estado.sharing ? "Compartiendo tu ubicación" : "Ubicación apagada"}
          </h2>
          <p className="mt-0.5 text-sm leading-relaxed text-gray-500">
            {estado.sharing
              ? "El cliente ve por dónde vas. Deja esta pantalla abierta: si bloqueas el teléfono, se corta."
              : "Enciéndela cuando salgas, para que el cliente sepa que estás en camino."}
          </p>
          {estado.buscandoSenal && (
            <p className="mt-1 text-sm text-amber-700">
              Buscando señal de GPS. La primera lectura viene de la red y no sirve.
            </p>
          )}
          {estado.lastSent && (
            <p className="mt-1 text-xs text-gray-500">
              Última posición enviada a las{" "}
              {estado.lastSent.toLocaleTimeString("es-VE", {
                hour: "numeric",
                minute: "2-digit",
                second: "2-digit",
              })}
            </p>
          )}
          {estado.error && (
            <p role="alert" className="mt-1 text-sm text-rose-600">
              {estado.error}
            </p>
          )}
        </div>
      </div>

      <button
        type="button"
        onClick={() => (estado.sharing ? stop() : void start())}
        className={`mt-4 flex h-12 w-full items-center justify-center gap-2 rounded-xl text-sm font-semibold transition active:scale-[0.99] ${
          estado.sharing
            ? "border border-gray-200 bg-white text-gray-700"
            : "bg-emerald-600 text-white"
        }`}
      >
        {estado.sharing ? "Dejar de compartir" : "Compartir mi ubicación"}
      </button>
    </section>
  )
}
