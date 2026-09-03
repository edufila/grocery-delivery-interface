"use client"

import { useEffect, useRef, useState } from "react"
import Link from "next/link"
import { MapPin } from "lucide-react"
// Solo tipos: se borran al compilar, así que no arrastran la librería al servidor.
import type { Map as MapLibreMap, Marker as MapLibreMarker } from "maplibre-gl"
import "maplibre-gl/dist/maplibre-gl.css"

import { createClient } from "@/lib/supabase/client"

type Point = { lat: number; lng: number }

type Props = {
  orderId: string
  destination: Point | null
  shopper: Point | null
  /** Con el pedido entregado o cancelado dejamos de escuchar posiciones. */
  live?: boolean
  /** El shopper se ve a sí mismo, así que la leyenda no dice lo mismo. */
  labels?: { destination: string; shopper: string }
}

/**
 * Tiles de OpenStreetMap: gratis y sin cuenta, que es lo que necesitamos hoy.
 * Su política de uso no contempla tráfico comercial serio; cuando haya volumen
 * hay que pasar a un proveedor de tiles.
 */
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

function marker(color: string, label: string) {
  const el = document.createElement("div")
  el.setAttribute("aria-label", label)
  el.style.cssText = `width:22px;height:22px;border-radius:9999px;background:${color};border:3px solid #fff;box-shadow:0 1px 6px rgba(0,0,0,.35)`
  return el
}

export function OrderMap({
  orderId,
  destination,
  shopper,
  live = true,
  labels = { destination: "Tu dirección", shopper: "Tu shopper" },
}: Props) {
  const container = useRef<HTMLDivElement>(null)
  const mapRef = useRef<MapLibreMap | null>(null)
  const shopperMarker = useRef<MapLibreMarker | null>(null)
  const [position, setPosition] = useState<Point | null>(shopper)
  const [failed, setFailed] = useState(false)

  // Escucha los cambios del pedido: cuando el shopper manda su posición, la
  // fila se actualiza y llega acá sin recargar la página.
  useEffect(() => {
    if (!live) return
    const supabase = createClient()
    const channel = supabase
      .channel(`order-${orderId}`)
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "orders", filter: `id=eq.${orderId}` },
        (payload) => {
          const row = payload.new as { shopper_lat: number | null; shopper_lng: number | null }
          if (row.shopper_lat != null && row.shopper_lng != null) {
            setPosition({ lat: row.shopper_lat, lng: row.shopper_lng })
          }
        },
      )
      .subscribe()

    return () => {
      void supabase.removeChannel(channel)
    }
  }, [orderId, live])

  useEffect(() => {
    if (!container.current || mapRef.current || !destination) return

    let cancelled = false

    void (async () => {
      try {
        // Import dinámico: maplibre toca window y no puede correr en el servidor.
        const maplibregl = await import("maplibre-gl")
        if (cancelled || !container.current) return

        const map = new maplibregl.Map({
          container: container.current,
          style: OSM_STYLE,
          center: [destination.lng, destination.lat],
          zoom: 14,
          attributionControl: { compact: true },
        })
        map.addControl(new maplibregl.NavigationControl({ showCompass: false }), "top-right")

        new maplibregl.Marker({ element: marker("#111827", "Tu dirección") })
          .setLngLat([destination.lng, destination.lat])
          .addTo(map)

        mapRef.current = map
      } catch {
        if (!cancelled) setFailed(true)
      }
    })()

    return () => {
      cancelled = true
      mapRef.current?.remove()
      mapRef.current = null
    }
  }, [destination])

  // Mueve el punto del shopper y encuadra para que se vean los dos.
  useEffect(() => {
    const map = mapRef.current
    if (!map || !position || !destination) return

    void (async () => {
      const maplibregl = await import("maplibre-gl")

      if (!shopperMarker.current) {
        shopperMarker.current = new maplibregl.Marker({
          element: marker("#059669", "Tu shopper"),
        })
          .setLngLat([position.lng, position.lat])
          .addTo(map)
      } else {
        shopperMarker.current.setLngLat([position.lng, position.lat])
      }

      map.fitBounds(
        [
          [Math.min(position.lng, destination.lng), Math.min(position.lat, destination.lat)],
          [Math.max(position.lng, destination.lng), Math.max(position.lat, destination.lat)],
        ],
        { padding: 60, maxZoom: 15, duration: 800 },
      )
    })()
  }, [position, destination])

  if (!destination) {
    return (
      <section className="rounded-2xl border border-dashed border-gray-200 bg-white p-5 text-center">
        <span className="mx-auto flex h-11 w-11 items-center justify-center rounded-full bg-gray-50">
          <MapPin className="h-5 w-5 text-gray-400" aria-hidden="true" />
        </span>
        <p className="mt-3 text-sm leading-relaxed text-gray-500">
          Este pedido no tiene la ubicación exacta de la dirección, así que no podemos dibujar el
          mapa.
        </p>
        <Link
          href="/perfil"
          className="mt-3 inline-flex min-h-11 items-center text-sm font-semibold text-emerald-600"
        >
          Fijar la ubicación de mis direcciones
        </Link>
      </section>
    )
  }

  if (failed) {
    return (
      <section className="rounded-2xl border border-gray-100 bg-white p-5 text-center text-sm text-gray-500">
        No pudimos cargar el mapa. Revisá tu conexión.
      </section>
    )
  }

  return (
    <section className="overflow-hidden rounded-2xl border border-gray-100 bg-white">
      <div ref={container} className="h-56 w-full" role="img" aria-label="Mapa del pedido" />
      <div className="flex items-center gap-4 px-4 py-3 text-xs text-gray-500">
        <span className="flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-full bg-gray-900" aria-hidden="true" />
          {labels.destination}
        </span>
        <span className="flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-full bg-emerald-600" aria-hidden="true" />
          {position ? labels.shopper : "Sin ubicación todavía"}
        </span>
      </div>
    </section>
  )
}
