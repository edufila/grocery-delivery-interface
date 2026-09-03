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
  const [code, setCode] = useState("")

  const mine = order.shopper_id === userId
  const siguiente = nextStatus(order.status)
  // La entrega no se marca con un update: la base exige el código del cliente.
  const needsCode = mine && order.status === "en_camino"

  async function deliver() {
    if (code.length !== 4) return
    setBusy(true)
    setError("")

    const supabase = createClient()
    const { data, error: rpcError } = await supabase.rpc("deliver_order", {
      p_order_id: order.id,
      p_code: code,
    })

    setBusy(false)

    if (rpcError) {
      setError("No pudimos confirmar la entrega. Probá de nuevo.")
      return
    }
    if (data !== true) {
      setError("Ese código no coincide. Pedíselo de nuevo al cliente.")
      setCode("")
      return
    }
    router.refresh()
  }

  async function take() {
    setBusy(true)
    setError("")
    const supabase = createClient()
    // El .is() evita pisar un pedido que otro ya tomó. Pero entonces no
    // actualiza ninguna fila y Supabase no lo considera un error: hay que
    // mirar cuántas volvieron, o diríamos que salió bien sin haber hecho nada.
    const { data, error: updateError } = await supabase
      .from("orders")
      .update({ shopper_id: userId })
      .eq("id", order.id)
      .is("shopper_id", null)
      .select("id")

    setBusy(false)

    if (updateError) {
      setError("No pudimos tomarlo. Probá de nuevo.")
      return
    }
    if (!data || data.length === 0) {
      setError("Otro shopper se adelantó y ya lo tomó.")
      router.refresh()
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

      {needsCode ? (
        <section className="rounded-2xl border border-gray-100 bg-white p-5">
          <h2 className="text-base font-semibold text-gray-900">Código de entrega</h2>
          <p className="mt-1 text-sm leading-relaxed text-gray-500">
            Pedíselo al cliente al entregarle el pedido. Son 4 dígitos.
          </p>

          <input
            value={code}
            onChange={(event) => {
              setCode(event.target.value.replace(/\D/g, "").slice(0, 4))
              if (error) setError("")
            }}
            inputMode="numeric"
            autoComplete="off"
            maxLength={4}
            placeholder="0000"
            aria-label="Código de entrega"
            className="mt-4 h-16 w-full rounded-2xl border border-gray-200 bg-white text-center font-mono text-3xl tracking-[0.4em] text-gray-900 outline-none transition placeholder:text-gray-300 focus:border-emerald-500 focus:ring-4 focus:ring-emerald-500/10"
          />

          <button
            type="button"
            onClick={() => void deliver()}
            disabled={busy || code.length !== 4}
            className="mt-4 flex h-14 w-full items-center justify-center gap-2 rounded-2xl bg-emerald-600 text-base font-semibold text-white transition active:scale-[0.99] disabled:bg-gray-200 disabled:text-gray-400"
          >
            {busy && <Loader2 className="h-5 w-5 animate-spin" aria-hidden="true" />}
            Confirmar entrega
          </button>
        </section>
      ) : !mine ? (
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
