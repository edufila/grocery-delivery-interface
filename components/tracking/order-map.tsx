"use client"

import { useEffect, useRef, useState } from "react"
import Link from "next/link"
import { MapPin, Maximize2 } from "lucide-react"
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
  /** Traza el camino por calle entre los dos puntos. */
  route?: boolean
  /** Distancia y tiempo del trayecto, para mostrarlos fuera del mapa. */
  onTrip?: (trip: { km: number; min: number }) => void
  /**
   * A quién sigue la cámara. El shopper quiere verse a sí mismo con la calle
   * de adelante; el cliente, su propia casa esperando. Encuadrar los dos puntos
   * dejaba a cada uno mirando un punto medio que no le sirve a ninguno.
   */
  focus?: "shopper" | "destination"
}

/**
 * Servidor público de OSRM. Es una instancia de demostración: alcanza para
 * probar, pero no está pensada para tráfico real. Con volumen hay que levantar
 * uno propio o contratar un proveedor.
 */
const OSRM = "https://router.project-osrm.org/route/v1/driving"

/** Metros que hay que moverse para recalcular. Evita pedir ruta a cada paso. */
const RECALC_AFTER_M = 80

function metersBetween(a: Point, b: Point) {
  const R = 6371000
  const dLat = ((b.lat - a.lat) * Math.PI) / 180
  const dLng = ((b.lng - a.lng) * Math.PI) / 180
  const lat1 = (a.lat * Math.PI) / 180
  const lat2 = (b.lat * Math.PI) / 180
  const h =
    Math.sin(dLat / 2) ** 2 + Math.sin(dLng / 2) ** 2 * Math.cos(lat1) * Math.cos(lat2)
  return 2 * R * Math.asin(Math.sqrt(h))
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
  route = false,
  onTrip,
  focus = "destination",
}: Props) {
  const routedFrom = useRef<Point | null>(null)
  const fittedFor = useRef<string | null>(null)

  /**
   * Quien nos usa arma `destination` inline, así que llega un objeto nuevo en
   * cada render. Si los efectos dependieran de él, el mapa se destruiría y se
   * recrearía sin parar: la ruta se dibujaba sobre un mapa que moría enseguida.
   */
  const destLat = destination?.lat ?? null
  const destLng = destination?.lng ?? null
  const [trip, setTrip] = useState<{ km: number; min: number } | null>(null)
  const container = useRef<HTMLDivElement>(null)
  const mapRef = useRef<MapLibreMap | null>(null)
  const shopperMarker = useRef<MapLibreMarker | null>(null)
  const [position, setPosition] = useState<Point | null>(shopper)
  const [failed, setFailed] = useState(false)
  // El mapa se crea con un import asíncrono. Sin esto, una posición que llega
  // antes de que termine de cargar se pierde: el efecto del marcador sale
  // temprano y no vuelve a correr hasta que el shopper se mueva.
  const [mapReady, setMapReady] = useState(false)

  // La posición puede llegar por dos vías: Realtime, para el cliente, o esta
  // prop, cuando el shopper se ve a sí mismo desde su propio GPS. Sin esto el
  // estado inicial quedaba congelado y el punto verde no aparecía nunca.
  useEffect(() => {
    if (shopper) setPosition(shopper)
  }, [shopper?.lat, shopper?.lng])

  // Escucha los cambios del pedido: cuando el shopper manda su posición, la
  // fila se actualiza y llega aquí sin recargar la página.
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

        // Arranca sobre quien mira, si ya sabemos dónde está.
        const inicio = (focus === "shopper" ? shopper : null) ?? destination

        const map = new maplibregl.Map({
          container: container.current,
          style: OSM_STYLE,
          center: [inicio.lng, inicio.lat],
          zoom: 14,
          attributionControl: { compact: true },
        })
        map.addControl(new maplibregl.NavigationControl({ showCompass: false }), "top-right")

        new maplibregl.Marker({ element: marker("#111827", "Tu dirección") })
          .setLngLat([destination.lng, destination.lat])
          .addTo(map)

        mapRef.current = map
        // Recién con el estilo cargado se pueden agregar capas: antes de eso,
        // addSource falla y la ruta no se dibujaría nunca.
        map.on("load", () => {
          if (!cancelled) setMapReady(true)
        })
      } catch {
        if (!cancelled) setFailed(true)
      }
    })()

    return () => {
      cancelled = true
      mapRef.current?.remove()
      mapRef.current = null
      shopperMarker.current = null
      // Al cambiar de destino hay que volver a rutear aunque no se haya movido.
      routedFrom.current = null
      setMapReady(false)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [destLat, destLng])

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

      // Centrar una sola vez por destino. Hacerlo en cada lectura del GPS
      // dejaba el mapa acercándose y alejándose sin parar mientras el shopper
      // estaba quieto y la señal oscilaba unos metros.
      const clave = `${destination.lat},${destination.lng}`
      if (fittedFor.current !== clave) {
        fittedFor.current = clave
        const propio = focus === "shopper" ? position : destination
        map.easeTo({ center: [propio.lng, propio.lat], zoom: 15, duration: 800 })
      }
    })()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [position, destLat, destLng, mapReady])

  // Camino por calle entre el shopper y su destino. Se recalcula solo cuando
  // se movió lo suficiente: el servidor de rutas es una demo compartida.
  useEffect(() => {
    if (!route || !mapReady || !position || !destination) return

    const previo = routedFrom.current
    if (previo && metersBetween(previo, position) < RECALC_AFTER_M) return
    routedFrom.current = position

    let cancelled = false

    void (async () => {
      try {
        const url = `${OSRM}/${position.lng},${position.lat};${destination.lng},${destination.lat}?overview=full&geometries=geojson`
        const res = await fetch(url)
        if (!res.ok) return
        const data = (await res.json()) as {
          routes?: {
            geometry: { type: "LineString"; coordinates: [number, number][] }
            distance: number
            duration: number
          }[]
        }
        const first = data.routes?.[0]
        const map = mapRef.current
        if (cancelled || !first || !map) return

        const geojson = {
          type: "Feature" as const,
          properties: {},
          geometry: first.geometry,
        }

        const source = map.getSource("ruta") as
          | { setData: (data: typeof geojson) => void }
          | undefined
        if (source) {
          source.setData(geojson)
        } else {
          map.addSource("ruta", { type: "geojson", data: geojson })
          map.addLayer(
            {
              id: "ruta",
              type: "line",
              source: "ruta",
              layout: { "line-cap": "round", "line-join": "round" },
              paint: { "line-color": "#059669", "line-width": 5, "line-opacity": 0.75 },
            },
            // Debajo de los marcadores no hace falta: los marcadores son HTML.
            undefined,
          )
        }

        const viaje = { km: first.distance / 1000, min: Math.round(first.duration / 60) }
        setTrip(viaje)
        onTrip?.(viaje)
      } catch {
        // Sin ruta el mapa sigue sirviendo: quedan los dos puntos.
      }
    })()

    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [route, mapReady, position, destLat, destLng])

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
        No pudimos cargar el mapa. Revisa tu conexión.
      </section>
    )
  }

  // El mapa queda centrado en quien mira. Este botón es la salida para cuando
  // se quiere ver el trayecto entero de una sola vez.
  function verTodo() {
    const map = mapRef.current
    if (!map || !destination) return
    if (!position) {
      map.easeTo({ center: [destination.lng, destination.lat], zoom: 15, duration: 600 })
      return
    }
    map.fitBounds(
      [
        [Math.min(position.lng, destination.lng), Math.min(position.lat, destination.lat)],
        [Math.max(position.lng, destination.lng), Math.max(position.lat, destination.lat)],
      ],
      { padding: 50, maxZoom: 15, duration: 600 },
    )
  }

  return (
    <section className="overflow-hidden rounded-2xl border border-gray-100 bg-white">
      <div className="relative">
        <div ref={container} className="h-56 w-full" role="img" aria-label="Mapa del pedido" />
        <button
          type="button"
          onClick={verTodo}
          className="absolute bottom-3 left-3 flex min-h-11 items-center gap-1.5 rounded-full bg-white/95 px-3.5 text-xs font-semibold text-gray-700 shadow-md backdrop-blur active:bg-gray-100"
        >
          <Maximize2 className="h-3.5 w-3.5" aria-hidden="true" />
          Ver todo el recorrido
        </button>
      </div>
      <div className="flex items-center gap-4 px-4 py-3 text-xs text-gray-500">
        <span className="flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-full bg-gray-900" aria-hidden="true" />
          {labels.destination}
        </span>
        <span className="flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-full bg-emerald-600" aria-hidden="true" />
          {position ? labels.shopper : "Sin ubicación todavía"}
        </span>
        {trip && (
          <span className="ml-auto font-medium tabular-nums text-gray-700">
            {trip.km.toFixed(1)} km · {trip.min} min
          </span>
        )}
      </div>
    </section>
  )
}
