"use client"

import { useState } from "react"
import { Timer } from "lucide-react"

import { OrderMap } from "./order-map"

type Punto = { lat: number; lng: number }

/**
 * El mapa del seguimiento, con cuánto le falta al shopper para llegar.
 *
 * El mapa ya calculaba el trayecto por calle -- distancia y minutos -- para
 * dibujar la ruta, pero el número no se mostraba: el cliente veía un punto
 * moviéndose y tenía que adivinar. "¿Cuánto falta?" es lo único que pregunta
 * quien espera un pedido en camino.
 *
 * Va aparte porque el número sale del mapa, que es de cliente, y la página del
 * seguimiento se arma en el servidor.
 */
export function MapaSeguimiento({
  orderId,
  destino,
  shopper,
  enVivo,
  enCamino,
}: {
  orderId: string
  destino: Punto | null
  shopper: Punto | null
  enVivo: boolean
  enCamino: boolean
}) {
  const [viaje, setViaje] = useState<{ km: number; min: number } | null>(null)

  return (
    <div className="flex flex-col gap-2">
      {/* Solo con el pedido en camino: antes de salir, los minutos serían del
          shopper yendo al abasto, no hasta la puerta. */}
      {enCamino && viaje && (
        <p
          className="flex animate-[entra_0.3s_ease-out] items-center gap-2 rounded-2xl bg-emerald-600 px-4 py-3 text-sm text-white shadow-md shadow-emerald-900/15"
          aria-live="polite"
        >
          <Timer className="h-5 w-5 shrink-0" aria-hidden="true" />
          <span>
            {viaje.min <= 1 ? (
              <span className="font-bold">Está llegando</span>
            ) : (
              <>
                Llega en unos <span className="font-bold tabular-nums">{viaje.min} min</span>
              </>
            )}
            <span className="tabular-nums"> · {viaje.km.toFixed(1)} km</span>
          </span>
        </p>
      )}

      <OrderMap
        orderId={orderId}
        destination={destino}
        shopper={shopper}
        live={enVivo}
        route={enCamino}
        onTrip={setViaje}
      />
    </div>
  )
}
