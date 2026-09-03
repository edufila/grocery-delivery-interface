"use client"

import { useState } from "react"
import { Check, Crosshair, Loader2 } from "lucide-react"

export type Coords = { lat: number; lng: number } | null

/**
 * Botón para fijar la dirección con el GPS del teléfono. Es opcional a
 * propósito: si la persona rechaza el permiso, la dirección se guarda igual
 * con el texto escrito.
 */
export function UseMyLocation({
  coords,
  onCapture,
}: {
  coords: Coords
  onCapture: (coords: Coords) => void
}) {
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState("")

  function capture() {
    if (!("geolocation" in navigator)) {
      setError("Este navegador no da acceso a la ubicación.")
      return
    }

    setBusy(true)
    setError("")

    navigator.geolocation.getCurrentPosition(
      (position) => {
        onCapture({ lat: position.coords.latitude, lng: position.coords.longitude })
        setBusy(false)
      },
      (geoError) => {
        setBusy(false)
        setError(
          geoError.code === geoError.PERMISSION_DENIED
            ? "Bloqueaste el permiso de ubicación. Podés guardar igual sin fijarla."
            : "No pudimos leer tu ubicación. Probá de nuevo o guardá sin fijarla.",
        )
      },
      { enableHighAccuracy: true, timeout: 15_000 },
    )
  }

  return (
    <div>
      <button
        type="button"
        onClick={capture}
        disabled={busy}
        className={`flex h-12 w-full items-center justify-center gap-2 rounded-xl border text-sm font-semibold transition active:scale-[0.99] ${
          coords
            ? "border-emerald-200 bg-emerald-50 text-emerald-700"
            : "border-gray-200 bg-white text-gray-700"
        }`}
      >
        {busy ? (
          <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
        ) : coords ? (
          <Check className="h-4 w-4" aria-hidden="true" />
        ) : (
          <Crosshair className="h-4 w-4" aria-hidden="true" />
        )}
        {busy ? "Buscando..." : coords ? "Ubicación fijada" : "Estoy acá: usar mi ubicación"}
      </button>

      {coords && (
        <p className="mt-1.5 text-center font-mono text-xs text-gray-400">
          {coords.lat.toFixed(5)}, {coords.lng.toFixed(5)}
        </p>
      )}

      {error && (
        <p role="alert" className="mt-1.5 text-sm text-rose-600">
          {error}
        </p>
      )}
    </div>
  )
}
