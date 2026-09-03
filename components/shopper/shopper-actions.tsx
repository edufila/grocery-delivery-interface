"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Check, Loader2 } from "lucide-react"

import { NEXT_STATUS_ACTION, nextStatus, type Order } from "@/lib/orders"
import { createClient } from "@/lib/supabase/client"

export function ShopperActions({ order, userId }: { order: Order; userId: string }) {
  const router = useRouter()
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState("")

  const mine = order.shopper_id === userId
  const siguiente = nextStatus(order.status)

  async function take() {
    setBusy(true)
    setError("")
    const supabase = createClient()
    const { error: updateError } = await supabase
      .from("orders")
      .update({ shopper_id: userId })
      .eq("id", order.id)
      .is("shopper_id", null) // si otro lo tomó primero, no pisa nada

    setBusy(false)
    if (updateError) {
      setError("No pudimos tomarlo. Puede que otro shopper se haya adelantado.")
      return
    }
    router.refresh()
  }

  async function advance() {
    if (!siguiente) return
    setBusy(true)
    setError("")
    const supabase = createClient()
    const { error: updateError } = await supabase
      .from("orders")
      .update({ status: siguiente, shopper_id: userId })
      .eq("id", order.id)

    setBusy(false)
    if (updateError) {
      setError("No pudimos actualizar el estado.")
      return
    }
    router.refresh()
  }

  return (
    <div className="flex flex-col gap-3">
      {error && (
        <p role="alert" className="text-sm text-rose-600">
          {error}
        </p>
      )}

      {!mine ? (
        <button
          type="button"
          onClick={() => void take()}
          disabled={busy}
          className="flex h-14 w-full items-center justify-center gap-2 rounded-2xl bg-emerald-600 text-base font-semibold text-white transition active:scale-[0.99] disabled:bg-gray-200 disabled:text-gray-400"
        >
          {busy && <Loader2 className="h-5 w-5 animate-spin" aria-hidden="true" />}
          Tomar este pedido
        </button>
      ) : siguiente ? (
        <button
          type="button"
          onClick={() => void advance()}
          disabled={busy}
          className="flex h-14 w-full items-center justify-center gap-2 rounded-2xl bg-emerald-600 text-base font-semibold text-white transition active:scale-[0.99] disabled:bg-gray-200 disabled:text-gray-400"
        >
          {busy && <Loader2 className="h-5 w-5 animate-spin" aria-hidden="true" />}
          {NEXT_STATUS_ACTION[siguiente] ?? "Avanzar"}
        </button>
      ) : (
        <p className="flex h-14 w-full items-center justify-center gap-2 rounded-2xl bg-emerald-50 text-base font-semibold text-emerald-700">
          <Check className="h-5 w-5" aria-hidden="true" />
          Pedido entregado
        </p>
      )}
    </div>
  )
}
