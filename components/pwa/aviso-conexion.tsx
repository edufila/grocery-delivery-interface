"use client"

import { useEffect, useState } from "react"
import { Wifi, WifiOff } from "lucide-react"

type Estado = "en-linea" | "sin-senal" | "volvio"

/**
 * Una pastilla arriba cuando se cae la señal con la app ya abierta.
 *
 * El service worker cubre el caso de abrir una pantalla sin red. Pero con la
 * app ya cargada no pasaba nada visible: los botones dejaban de responder, el
 * seguimiento se quedaba quieto, y no había forma de distinguir "no tengo
 * datos" de "la app se colgó". En la calle, con datos móviles, eso es a diario.
 *
 * Al volver avisa un momento y se va, para que se sepa que ya se puede seguir.
 */
export function AvisoConexion() {
  const [estado, setEstado] = useState<Estado>("en-linea")

  useEffect(() => {
    let temporizador: number | undefined

    const caer = () => {
      window.clearTimeout(temporizador)
      setEstado("sin-senal")
    }
    const volver = () => {
      setEstado((antes) => (antes === "sin-senal" ? "volvio" : "en-linea"))
      temporizador = window.setTimeout(() => setEstado("en-linea"), 2500)
    }

    if (!navigator.onLine) caer()
    window.addEventListener("offline", caer)
    window.addEventListener("online", volver)
    return () => {
      window.clearTimeout(temporizador)
      window.removeEventListener("offline", caer)
      window.removeEventListener("online", volver)
    }
  }, [])

  if (estado === "en-linea") return null

  const sinSenal = estado === "sin-senal"

  return (
    <div
      className="pointer-events-none fixed inset-x-0 top-0 z-[60] flex justify-center px-4 pt-[calc(env(safe-area-inset-top)+0.5rem)]"
      role="status"
      aria-live="polite"
    >
      <p
        className={`flex animate-[entra_0.25s_ease-out] items-center gap-2 rounded-full px-4 py-2 text-sm font-semibold text-white shadow-lg ${
          sinSenal ? "bg-gray-900" : "bg-emerald-700"
        }`}
      >
        {sinSenal ? (
          <WifiOff className="h-4 w-4" aria-hidden="true" />
        ) : (
          <Wifi className="h-4 w-4" aria-hidden="true" />
        )}
        {sinSenal ? "Sin conexión. Revisa tus datos." : "Volvió la conexión"}
      </p>
    </div>
  )
}
