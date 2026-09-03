"use client"

import { useEffect, useRef } from "react"
import { useRouter } from "next/navigation"

import { createClient } from "@/lib/supabase/client"
import { isSupabaseConfigured } from "@/lib/supabase/config"

type OrderRow = { status?: string; shopper_id?: string | null }

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
}: {
  orderId: string
  status: string
  shopperId: string | null
}) {
  const router = useRouter()
  const seen = useRef({ status, shopperId })

  useEffect(() => {
    seen.current = { status, shopperId }
  }, [status, shopperId])

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
            (row.shopper_id !== undefined && row.shopper_id !== seen.current.shopperId)
          if (cambio) router.refresh()
        },
      )
      .subscribe()

    return () => {
      void supabase.removeChannel(channel)
    }
  }, [orderId, router])

  return null
}

/**
 * Para las listas: cualquier pedido nuevo o cambiado las deja viejas. Realtime
 * respeta RLS, así que solo llegan los pedidos que esta persona puede ver.
 */
export function OrdersLiveRefresh() {
  const router = useRouter()
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    if (!isSupabaseConfigured) return
    const supabase = createClient()

    const channel = supabase
      .channel("orders-refresh")
      .on("postgres_changes", { event: "*", schema: "public", table: "orders" }, () => {
        // Varios cambios seguidos rearman la lista una sola vez.
        if (timer.current) clearTimeout(timer.current)
        timer.current = setTimeout(() => router.refresh(), 1500)
      })
      .subscribe()

    return () => {
      if (timer.current) clearTimeout(timer.current)
      void supabase.removeChannel(channel)
    }
  }, [router])

  return null
}
