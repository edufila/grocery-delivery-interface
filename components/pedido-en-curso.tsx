"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { ChevronRight, PackageSearch } from "lucide-react"

import { STATUS_FLOW, statusLabel, type OrderStatus } from "@/lib/orders"
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

  const esperaPago = pedido.payment_required !== false && pedido.payment_verified_at == null
  const titulo = esperaPago
    ? pedido.payment_reference
      ? "Verificando tu pago"
      : "Falta tu pago"
    : statusLabel(pedido.status, pedido.shopper_id)
  // Esperando pago la barra no avanza: el pedido todavía no arrancó.
  const paso = esperaPago ? -1 : STATUS_FLOW.indexOf(pedido.status)

  return (
    <section className="mx-auto max-w-md px-4 pt-4">
      <Link
        href={`/pedidos/${pedido.code}`}
        className={`block animate-[entra_0.35s_ease-out] rounded-2xl border p-4 shadow-sm transition active:scale-[0.99] ${
          esperaPago ? "border-amber-200 bg-amber-50" : "border-emerald-200 bg-emerald-50"
        }`}
      >
        <span className="flex items-center gap-3">
          <span className="relative flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-white">
            {!esperaPago && (
              <span
                className="absolute inset-0 animate-ping rounded-full bg-emerald-300/40 [animation-duration:2s]"
                aria-hidden="true"
              />
            )}
            <PackageSearch
              className={`relative h-5 w-5 ${esperaPago ? "text-amber-700" : "text-emerald-600"}`}
              aria-hidden="true"
            />
          </span>
          <span className="min-w-0 flex-1">
            <span
              className={`block text-sm font-semibold ${esperaPago ? "text-amber-900" : "text-emerald-900"}`}
            >
              {titulo}
            </span>
            <span
              className={`block truncate text-sm ${esperaPago ? "text-amber-800" : "text-emerald-800"}`}
            >
              Tu pedido {pedido.code} · toca para {esperaPago ? "pagarlo" : "seguirlo"}
            </span>
          </span>
          <ChevronRight
            className={`h-5 w-5 shrink-0 ${esperaPago ? "text-amber-700" : "text-emerald-600"}`}
            aria-hidden="true"
          />
        </span>

        {!esperaPago && (
          <span className="mt-3 flex gap-1" aria-hidden="true">
            {STATUS_FLOW.map((estado, indice) => (
              <span
                key={estado}
                className={`h-1 flex-1 rounded-full ${indice <= paso ? "bg-emerald-600" : "bg-emerald-200"}`}
              />
            ))}
          </span>
        )}
      </Link>
    </section>
  )
}
