"use client"

import { useState } from "react"

import { OrderMap } from "@/components/tracking/order-map"
import { LocationShare } from "./location-share"
import { ShopperActions } from "./shopper-actions"
import type { Order } from "@/lib/orders"

/**
 * Junta el mapa, el compartir ubicación y los botones en un solo cliente:
 * salir a entregar exige estar transmitiendo, y así los botones se enteran
 * al instante en vez de esperar a que la página se rearme.
 */
export function ShopperPanel({ order, userId }: { order: Order; userId: string }) {
  const [sharing, setSharing] = useState(false)
  const [position, setPosition] = useState<{ lat: number; lng: number } | null>(
    order.shopper_lat != null && order.shopper_lng != null
      ? { lat: order.shopper_lat, lng: order.shopper_lng }
      : null,
  )

  const mine = order.shopper_id === userId

  return (
    <>
      <OrderMap
        orderId={order.id}
        destination={
          order.address_lat != null && order.address_lng != null
            ? { lat: order.address_lat, lng: order.address_lng }
            : null
        }
        shopper={position}
        live={false}
        labels={{ destination: "Entregar acá", shopper: "Vos" }}
      />

      {mine && (
        <LocationShare
          orderId={order.id}
          onSharingChange={setSharing}
          onPosition={setPosition}
        />
      )}

      <ShopperActions order={order} userId={userId} sharing={sharing} />
    </>
  )
}
