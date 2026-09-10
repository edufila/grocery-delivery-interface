"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import { useRouter } from "next/navigation"

import { createClient } from "@/lib/supabase/client"
import { isSupabaseConfigured } from "@/lib/supabase/config"

type OrderRow = {
  id?: string
  status?: string
  shopper_id?: string | null
  payment_verified_at?: string | null
}

/**
 * Estas pantallas se arman en el servidor, así que un cambio de estado no se
 * ve hasta recargar. Escuchamos la fila y pedimos que Next vuelva a armarla.
 *
 * Solo cuando cambia algo que se muestra: el shopper manda su posición cada 15
 * segundos y no tiene sentido rearmar la página por eso.
 */
export function OrderLiveRefresh({
  orderId,
  status,
  shopperId,
  pagoVerificado = null,
}: {
  orderId: string
  status: string
  shopperId: string | null
  /**
   * Cuándo se confirmó el pago, si ya se confirmó.
   *
   * Se vigila porque es el momento en que el cliente está más pendiente de la
   * pantalla: acaba de pagar y su pedido está detenido esperando. Sin esto el
   * cambio no llegaba por Realtime y se veía recién en el refresco de
   * respaldo, hasta quince segundos después de que alguien lo confirmara.
   */
  pagoVerificado?: string | null
}) {
  const router = useRouter()
  const seen = useRef({ status, shopperId, pagoVerificado })
  const [enVivo, setEnVivo] = useState(false)

  useEffect(() => {
    seen.current = { status, shopperId, pagoVerificado }
  }, [status, shopperId, pagoVerificado])

  useEffect(() => {
    if (!isSupabaseConfigured) return
    const supabase = createClient()

    const channel = supabase
      .channel(`order-refresh-${orderId}`)
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "orders", filter: `id=eq.${orderId}` },
        (payload) => {
          const row = payload.new as OrderRow
          const cambio =
            (row.status !== undefined && row.status !== seen.current.status) ||
            (row.shopper_id !== undefined && row.shopper_id !== seen.current.shopperId) ||
            (row.payment_verified_at !== undefined &&
              row.payment_verified_at !== seen.current.pagoVerificado)
          if (cambio) router.refresh()
        },
      )
      .subscribe((estado) => setEnVivo(estado === "SUBSCRIBED"))

    return () => {
      setEnVivo(false)
      void supabase.removeChannel(channel)
    }
  }, [orderId, router])

  useRespaldo(router.refresh, enVivo)

  return null
}

/**
 * El refresco de respaldo, por si Realtime no llega.
 *
 * Depende de que la tabla esté publicada en la base, y si eso falta la pantalla
 * se queda quieta sin avisar. Este intervalo garantiza que se actualice igual.
 *
 * PERO SE ESPACIA CUANDO REALTIME SÍ FUNCIONA. Antes eran quince segundos
 * siempre: rearmar la página entera en el servidor y bajarla, cuatro veces por
 * minuto, para nada, mientras el canal ya avisaba de cualquier cambio al
 * instante. Esta app se usa en la calle y con datos móviles, así que eso no es
 * un detalle. Conectado se espacia a un minuto -- sigue siendo red de
 * seguridad, por si el canal se cae en silencio -- y sin canal se mantiene
 * apretado, que es cuando de verdad hace falta.
 *
 * Solo con la pestaña a la vista: en segundo plano no sirve de nada.
 */
function useRespaldo(refresh: () => void, enVivo: boolean) {
  useEffect(() => {
    const cada = enVivo ? 60_000 : 15_000
    const tick = () => {
      if (document.visibilityState === "visible") refresh()
    }
    const id = setInterval(tick, cada)
    document.addEventListener("visibilitychange", tick)
    return () => {
      clearInterval(id)
      document.removeEventListener("visibilitychange", tick)
    }
  }, [refresh, enVivo])
}

/**
 * Para las listas: cualquier pedido nuevo o cambiado las deja viejas. Realtime
 * respeta RLS, así que solo llegan los pedidos que esta persona puede ver.
 */
export function OrdersLiveRefresh() {
  const router = useRouter()
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const [enVivo, setEnVivo] = useState(false)
  /** Cómo estaba cada pedido la última vez, para no rearmar por la posición. */
  const visto = useRef<Map<string, string>>(new Map())

  const refrescar = useCallback(() => {
    if (timer.current) clearTimeout(timer.current)
    // Varios cambios seguidos rearman la lista una sola vez.
    timer.current = setTimeout(() => router.refresh(), 1500)
  }, [router])

  useEffect(() => {
    if (!isSupabaseConfigured) return
    const supabase = createClient()

    const channel = supabase
      .channel("orders-refresh")
      .on("postgres_changes", { event: "*", schema: "public", table: "orders" }, (payload) => {
        const fila = payload.new as OrderRow

        /**
         * Se ignora lo que no cambia la lista.
         *
         * El shopper manda su posición cada quince segundos, y cada envío es un
         * UPDATE de `orders` que llegaba aquí y rearmaba la lista entera. O sea
         * que tener un pedido en camino le costaba una recarga cada quince
         * segundos a todo el que tuviera la lista abierta, para ver exactamente
         * lo mismo. Se guarda cómo estaba cada pedido y solo se rearma cuando
         * cambia algo que la lista muestra.
         */
        if (fila?.id) {
          const firma = `${fila.status}|${fila.shopper_id}|${fila.payment_verified_at}`
          if (visto.current.get(fila.id) === firma) return
          visto.current.set(fila.id, firma)
        }

        refrescar()
      })
      .subscribe((estado) => setEnVivo(estado === "SUBSCRIBED"))

    return () => {
      if (timer.current) clearTimeout(timer.current)
      setEnVivo(false)
      void supabase.removeChannel(channel)
    }
  }, [refrescar])

  useRespaldo(router.refresh, enVivo)

  return null
}
