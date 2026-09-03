"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Loader2, Trash2 } from "lucide-react"

import { formatMoney, formatOrderDate, statusLabel, type Order } from "@/lib/orders"
import { createClient } from "@/lib/supabase/client"

type Row = Pick<
  Order,
  "id" | "code" | "status" | "total" | "created_at" | "address_label" | "shopper_id"
>

export function OrdersCleanup({ orders }: { orders: Row[] }) {
  const router = useRouter()
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState("")
  const [confirming, setConfirming] = useState(false)

  function toggle(id: string) {
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
    setConfirming(false)
  }

  async function remove() {
    if (selected.size === 0) return
    setBusy(true)
    setError("")

    // Los renglones y el código de entrega se van en cascada con el pedido.
    const { error: deleteError } = await createClient()
      .from("orders")
      .delete()
      .in("id", Array.from(selected))

    setBusy(false)
    setConfirming(false)

    if (deleteError) {
      setError("No pudimos borrarlos. ¿Tu rol sigue siendo admin o dev?")
      return
    }
    setSelected(new Set())
    router.refresh()
  }

  if (orders.length === 0) {
    return <p className="text-sm text-gray-500">No hay pedidos.</p>
  }

  return (
    <div className="flex flex-col gap-2">
      {error && (
        <p role="alert" className="text-sm text-rose-600">
          {error}
        </p>
      )}

      <ul className="flex flex-col gap-2">
        {orders.map((order) => (
          <li key={order.id}>
            <label
              className={`flex cursor-pointer items-center gap-3 rounded-2xl border p-3 ${
                selected.has(order.id)
                  ? "border-rose-300 bg-rose-50"
                  : "border-gray-200 bg-white"
              }`}
            >
              <input
                type="checkbox"
                checked={selected.has(order.id)}
                onChange={() => toggle(order.id)}
                className="h-4 w-4 shrink-0 accent-rose-600"
              />
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <span className="font-mono text-sm font-semibold text-gray-900">
                    {order.code}
                  </span>
                  <span className="rounded-full bg-gray-100 px-2 py-0.5 text-xs font-medium text-gray-600">
                    {statusLabel(order.status, order.shopper_id)}
                  </span>
                </div>
                <p className="truncate text-xs text-gray-500">
                  {formatOrderDate(order.created_at)}
                  {order.address_label ? ` · ${order.address_label}` : ""}
                </p>
              </div>
              <span className="shrink-0 text-sm font-semibold tabular-nums text-gray-900">
                {formatMoney(order.total)}
              </span>
            </label>
          </li>
        ))}
      </ul>

      {selected.size > 0 && (
        <div className="sticky bottom-4 mt-2 rounded-2xl border border-rose-200 bg-white p-3 shadow-lg">
          {confirming ? (
            <>
              <p className="text-sm leading-relaxed text-gray-700">
                Se borran <span className="font-semibold">{selected.size}</span>{" "}
                {selected.size === 1 ? "pedido" : "pedidos"} con todo su contenido.{" "}
                <span className="font-semibold">No se puede deshacer.</span>
              </p>
              <div className="mt-3 flex gap-2">
                <button
                  type="button"
                  onClick={() => void remove()}
                  disabled={busy}
                  className="flex h-12 flex-1 items-center justify-center gap-2 rounded-xl bg-rose-600 text-sm font-semibold text-white disabled:opacity-60"
                >
                  {busy && <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />}
                  Sí, borrarlos
                </button>
                <button
                  type="button"
                  onClick={() => setConfirming(false)}
                  className="h-12 rounded-xl border border-gray-200 px-4 text-sm font-semibold text-gray-600"
                >
                  Cancelar
                </button>
              </div>
            </>
          ) : (
            <button
              type="button"
              onClick={() => setConfirming(true)}
              className="flex h-12 w-full items-center justify-center gap-2 rounded-xl border border-rose-300 text-sm font-semibold text-rose-600"
            >
              <Trash2 className="h-4 w-4" aria-hidden="true" />
              Borrar {selected.size} {selected.size === 1 ? "pedido" : "pedidos"}
            </button>
          )}
        </div>
      )}
    </div>
  )
}
