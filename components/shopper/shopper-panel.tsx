"use client"

import { useState } from "react"
import { Store } from "lucide-react"

import { OrderMap } from "@/components/tracking/order-map"
import { LocationShare } from "./location-share"
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
  const [position, setPosition] = useState<Point | null>(
    order.shopper_lat != null && order.shopper_lng != null
      ? { lat: order.shopper_lat, lng: order.shopper_lng }
      : null,
  )

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

      <OrderMap
        orderId={order.id}
        destination={destino}
        shopper={position}
        live={false}
        route
        labels={{
          destination: yendoAlAbasto ? (store?.name ?? "El abasto") : "Entregar acá",
          shopper: "Vos",
        }}
      />

      {mine && (
        <LocationShare orderId={order.id} onSharingChange={setSharing} onPosition={setPosition} />
      )}

      <ShopperActions order={order} userId={userId} sharing={sharing} />
    </>
  )
}
