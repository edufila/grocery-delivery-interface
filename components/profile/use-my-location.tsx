"use client"

import { useEffect, useRef, useState } from "react"
import { Crosshair, Loader2 } from "lucide-react"
import type { Map as MapLibreMap, Marker as MapLibreMarker } from "maplibre-gl"
import "maplibre-gl/dist/maplibre-gl.css"

export type Coords = { lat: number; lng: number } | null

/**
 * Entre Acarigua y Araure: es donde opera el abasto, así que el mapa abre
 * cerca de donde va a estar la dirección aunque el GPS todavía no responda.
 */
const FALLBACK = { lat: 9.5628, lng: -69.2149 }
const FALLBACK_ZOOM = 13

const OSM_STYLE = {
  version: 8 as const,
  sources: {
    osm: {
      type: "raster" as const,
      tiles: ["https://tile.openstreetmap.org/{z}/{x}/{y}.png"],
      tileSize: 256,
      attribution: '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
    },
  },
  layers: [{ id: "osm", type: "raster" as const, source: "osm" }],
}

/**
 * El GPS deja el pin donde está el teléfono, que no siempre es la puerta: en un
 * edificio o una quinta con varias entradas, el repartidor necesita el punto
 * exacto. Por eso el pin se arrastra.
 */
export function UseMyLocation({
  coords,
  onCapture,
}: {
  coords: Coords
  onCapture: (coords: Coords) => void
}) {
  const container = useRef<HTMLDivElement>(null)
  const mapRef = useRef<MapLibreMap | null>(null)
  const markerRef = useRef<MapLibreMarker | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState("")

  const center = coords ?? FALLBACK

  useEffect(() => {
    if (!container.current || mapRef.current) return
    let cancelled = false

    void (async () => {
      const maplibregl = await import("maplibre-gl")
      if (cancelled || !container.current) return

      const map = new maplibregl.Map({
        container: container.current,
        style: OSM_STYLE,
        center: [center.lng, center.lat],
        zoom: coords ? 17 : FALLBACK_ZOOM,
        attributionControl: { compact: true },
      })

      const el = document.createElement("div")
      el.style.cssText =
        "width:26px;height:26px;border-radius:9999px;background:#059669;border:3px solid #fff;box-shadow:0 2px 8px rgba(0,0,0,.4);cursor:grab"

      const marker = new maplibregl.Marker({ element: el, draggable: true })
        .setLngLat([center.lng, center.lat])
        .addTo(map)

      marker.on("dragend", () => {
        const { lat, lng } = marker.getLngLat()
        onCapture({ lat, lng })
      })

      // Tocar el mapa también mueve el pin: arrastrar en pantalla chica cuesta.
      map.on("click", (event) => {
        marker.setLngLat(event.lngLat)
        onCapture({ lat: event.lngLat.lat, lng: event.lngLat.lng })
      })

      mapRef.current = map
      markerRef.current = marker
    })()

    return () => {
      cancelled = true
      mapRef.current?.remove()
      mapRef.current = null
      markerRef.current = null
    }
    // Se arma una sola vez: después el pin se mueve solo, sin rearmar el mapa.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Cuando el GPS trae una posición, llevamos mapa y pin hasta ahí.
  useEffect(() => {
    if (!coords || !mapRef.current || !markerRef.current) return
    markerRef.current.setLngLat([coords.lng, coords.lat])
    mapRef.current.easeTo({ center: [coords.lng, coords.lat], zoom: 17, duration: 600 })
  }, [coords])

  function locate() {
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
            ? "Bloqueaste el permiso. Puedes mover el pin a mano igual."
            : "No pudimos leer tu ubicación. Movés el pin a mano y listo.",
        )
      },
      { enableHighAccuracy: true, timeout: 15_000 },
    )
  }

  return (
    <div className="flex flex-col gap-2">
      <div className="overflow-hidden rounded-xl border border-gray-200">
        <div ref={container} className="h-52 w-full" role="img" aria-label="Mapa para ubicar la dirección" />
      </div>

      <p className="text-center text-xs leading-relaxed text-gray-500">
        Arrastra el pin, o toca el mapa, hasta la puerta exacta donde quieres que te entreguen.
      </p>

      <button
        type="button"
        onClick={locate}
        disabled={busy}
        className="flex h-12 w-full items-center justify-center gap-2 rounded-xl border border-gray-200 bg-white text-sm font-semibold text-gray-700 transition active:scale-[0.99] disabled:opacity-60"
      >
        {busy ? (
          <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
        ) : (
          <Crosshair className="h-4 w-4" aria-hidden="true" />
        )}
        {busy ? "Buscando..." : "Centrar en mi ubicación"}
      </button>

      {coords && (
        <p className="text-center font-mono text-xs text-gray-400">
          {coords.lat.toFixed(5)}, {coords.lng.toFixed(5)}
        </p>
      )}

      {error && (
        <p role="alert" className="text-sm text-rose-600">
          {error}
        </p>
      )}
    </div>
  )
}
