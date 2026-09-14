"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { ChevronRight, PackageSearch } from "lucide-react"

import { statusLabel, type OrderStatus } from "@/lib/orders"
import { createClient } from "@/lib/supabase/client"
import { isSupabaseConfigured } from "@/lib/supabase/config"

const EN_CURSO = ["confirmado", "preparando", "en_camino"]

type EnCurso = {
  code: string
  status: OrderStatus
  shopper_id: string | null
  payment_required: boolean | null
  payment_verified_at: string | null
  payment_reference: string | null
}

/**
 * El pedido que va en camino, arriba del inicio.
 *
 * Quien está esperando un pedido abre la app para eso, y el inicio le mostraba
 * la lista de abastos como si nada: había que acordarse de ir a Pedidos. El
 * punto en la barra de abajo avisa que hay algo, pero no dice qué ni lleva
 * directo.
 *
 * Va en el cliente y no en el servidor porque el inicio se cachea; así el
 * estado se lee fresco en cada visita y no queda pegado uno viejo.
 */
export function PedidoEnCurso() {
  const [pedido, setPedido] = useState<EnCurso | null>(null)

  useEffect(() => {
    if (!isSupabaseConfigured) return
    let cancelado = false

    void (async () => {
      const supabase = createClient()
      const {
        data: { user },
      } = await supabase.auth.getUser()
      if (!user || cancelado) return

      /**
       * El filtro por usuario hace falta aunque haya RLS.
       *
       * Para un cliente la política ya limita a los suyos, pero a admin y dev
       * les deja ver todos los pedidos -- es lo que usa el panel. Sin esto, a
       * ellos el inicio les mostraba "tu pedido" con el pedido de otra persona.
       */
      const { data } = await supabase
        .from("orders")
        .select("code, status, shopper_id, payment_required, payment_verified_at, payment_reference")
        .eq("user_id", user.id)
        .in("status", EN_CURSO)
        .order("created_at", { ascending: false })
        .limit(1)
        .returns<EnCurso[]>()

      if (!cancelado) setPedido(data?.[0] ?? null)
    })()

    return () => {
      cancelado = true
    }
  }, [])

  if (!pedido) return null

  return (
    <section className="mx-auto max-w-md px-4 pt-4">
      <Link
        href={`/pedidos/${pedido.code}`}
        className="flex items-center gap-3 rounded-2xl border border-emerald-200 bg-emerald-50 p-4 transition active:scale-[0.99]"
      >
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-white">
          <PackageSearch className="h-5 w-5 text-emerald-600" aria-hidden="true" />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block text-sm font-semibold text-emerald-900">
            {pedido.payment_required !== false && pedido.payment_verified_at == null
              ? pedido.payment_reference
                ? "Verificando tu pago"
                : "Falta tu pago"
              : statusLabel(pedido.status, pedido.shopper_id)}
          </span>
          <span className="block truncate text-sm text-emerald-800">
            Tu pedido {pedido.code} · toca para seguirlo
          </span>
        </span>
        <ChevronRight className="h-5 w-5 shrink-0 text-emerald-600" aria-hidden="true" />
      </Link>
    </section>
  )
}
