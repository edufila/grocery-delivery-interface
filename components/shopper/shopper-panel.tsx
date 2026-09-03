"use client"

import { useEffect, useState } from "react"
import { Navigation, Store } from "lucide-react"

import { OrderChat } from "@/components/tracking/order-chat"
import { OrderMap } from "@/components/tracking/order-map"
import { LocationShare } from "./location-share"
import { OrderProblem } from "./order-problem"
import { ShopperActions } from "./shopper-actions"
import type { Order } from "@/lib/orders"

type Point = { lat: number; lng: number }

/**
 * Junta el mapa, el compartir ubicación y los botones en un solo cliente:
 * salir a entregar exige estar transmitiendo, y así los botones se enteran
 * al instante en vez de esperar a que la página se rearme.
 */
export function ShopperPanel({
  order,
  userId,
  store,
}: {
  order: Order
  userId: string
  store: { name: string; lat: number | null; lng: number | null } | null
}) {
  const [sharing, setSharing] = useState(false)
  const [trip, setTrip] = useState<{ km: number; min: number } | null>(null)
  const [position, setPosition] = useState<Point | null>(
    order.shopper_lat != null && order.shopper_lng != null
      ? { lat: order.shopper_lat, lng: order.shopper_lng }
      : null,
  )

  /**
   * Una lectura al abrir, aunque no esté compartiendo: sin un punto de partida
   * no hay ruta que trazar, y el shopper que acaba de tomar el pedido quiere
   * ver cómo llegar al abasto antes de encender nada.
   */
  useEffect(() => {
    if (position || !("geolocation" in navigator)) return
    navigator.geolocation.getCurrentPosition(
      (p) => {
        if (p.coords.accuracy <= 500) {
          setPosition({ lat: p.coords.latitude, lng: p.coords.longitude })
        }
      },
      () => {
        // Sin permiso no hay ruta, pero el mapa con el destino sigue sirviendo.
      },
      { enableHighAccuracy: true, maximumAge: 0, timeout: 15_000 },
    )
    // Solo al montar: después la posición llega por el compartir.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const mine = order.shopper_id === userId

  // Antes de salir el destino es el abasto; después, la puerta del cliente.
  const yendoAlAbasto = order.status === "confirmado" || order.status === "preparando"
  const tiendaUbicada = store?.lat != null && store?.lng != null

  const destino: Point | null = yendoAlAbasto
    ? tiendaUbicada
      ? { lat: store!.lat!, lng: store!.lng! }
      : null
    : order.address_lat != null && order.address_lng != null
      ? { lat: order.address_lat, lng: order.address_lng }
      : null

  return (
    <>
      {yendoAlAbasto && !tiendaUbicada && (
        <p className="flex items-start gap-3 rounded-2xl bg-amber-50 px-4 py-3 text-sm leading-relaxed text-amber-800">
          <Store className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
          <span>
            {store?.name ?? "El abasto"} todavía no tiene su punto en el mapa, así que no podemos
            trazarte la ruta hasta ahí. Se carga en la tabla <code className="text-xs">stores</code>.
          </span>
        </p>
      )}

      {trip && destino && (
        <p className="flex items-center gap-2 rounded-2xl border border-emerald-100 bg-emerald-50 px-4 py-3 text-sm text-emerald-900">
          <Navigation className="h-4 w-4 shrink-0 text-emerald-600" aria-hidden="true" />
          <span>
            {yendoAlAbasto ? "Hasta el abasto" : "Hasta el cliente"}:{" "}
            <span className="font-semibold tabular-nums">{trip.km.toFixed(1)} km</span> ·{" "}
            <span className="font-semibold tabular-nums">{trip.min} min</span> en vía
          </span>
        </p>
      )}

      <OrderMap
        orderId={order.id}
        destination={destino}
        shopper={position}
        live={false}
        route
        onTrip={setTrip}
        labels={{
          destination: yendoAlAbasto ? (store?.name ?? "El abasto") : "Entregar aquí",
          shopper: "Tú",
        }}
      />

      {mine && order.status !== "entregado" && (
        <div className="rounded-2xl border border-gray-100 bg-white p-4">
          <p className="text-sm font-semibold text-gray-900">Coordinar con el cliente</p>
          <p className="mt-0.5 text-sm leading-relaxed text-gray-500">
            Para avisar de un faltante o preguntar por la entrega.
          </p>
          <OrderChat
            orderId={order.id}
            userId={userId}
            title="Chat con el cliente"
            subtitle={`Pedido ${order.code}`}
          />
        </div>
      )}

      {/* Al entregar o cancelar, este bloque desaparece y el desmontaje de
          LocationShare corta el seguimiento y suelta la pantalla. */}
      {mine && order.status !== "entregado" && order.status !== "cancelado" && (
        <LocationShare orderId={order.id} onSharingChange={setSharing} onPosition={setPosition} />
      )}

      <ShopperActions order={order} userId={userId} sharing={sharing} />

      {mine && order.status !== "entregado" && order.status !== "cancelado" && (
        <OrderProblem orderId={order.id} />
      )}
    </>
  )
}
