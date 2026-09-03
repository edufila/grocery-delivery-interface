"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { ChevronRight, Loader2, Trash2 } from "lucide-react"

import { DetallePedido } from "@/components/admin/detalle-pedido"
import { formatMoney, formatOrderDate, statusLabel, type Order } from "@/lib/orders"
import { createClient } from "@/lib/supabase/client"

type Row = Pick<
  Order,
  "id" | "code" | "status" | "total" | "created_at" | "address_label" | "shopper_id"
>

const FILTERS = [
  { value: "todos", label: "Todos" },
  { value: "sin_tomar", label: "Sin tomar" },
  { value: "en_curso", label: "En curso" },
  { value: "entregado", label: "Entregados" },
  { value: "cancelado", label: "Cancelados" },
] as const

export function OrdersCleanup({ orders }: { orders: Row[] }) {
  const router = useRouter()
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState("")
  const [confirming, setConfirming] = useState(false)
  const [filter, setFilter] = useState<string>("todos")
  const [query, setQuery] = useState("")
  const [detalle, setDetalle] = useState<string | null>(null)

  const term = query.trim().toLowerCase()
  const shown = orders.filter((order) => {
    if (term && !order.code.toLowerCase().includes(term)) return false
    switch (filter) {
      case "sin_tomar":
        return order.status === "confirmado" && !order.shopper_id
      case "en_curso":
        return ["confirmado", "preparando", "en_camino"].includes(order.status) && !!order.shopper_id
      case "entregado":
        return order.status === "entregado"
      case "cancelado":
        return order.status === "cancelado"
      default:
        return true
    }
  })

  function selectAllShown() {
    setSelected(new Set(shown.map((o) => o.id)))
    setConfirming(false)
  }

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

      <div className="flex flex-wrap gap-1.5">
        {FILTERS.map((f) => (
          <button
            key={f.value}
            type="button"
            onClick={() => setFilter(f.value)}
            className={`min-h-9 rounded-full px-3 text-sm font-medium transition ${
              filter === f.value
                ? "bg-gray-900 text-white"
                : "border border-gray-200 text-gray-600 active:bg-gray-50"
            }`}
          >
            {f.label}
          </button>
        ))}
      </div>

      <input
        value={query}
        onChange={(event) => setQuery(event.target.value)}
        placeholder="Buscar por código: GA-4822"
        aria-label="Buscar pedido por código"
        className="h-12 w-full rounded-xl border border-gray-200 bg-white px-3 text-base text-gray-900 outline-none placeholder:text-gray-400 focus:border-emerald-500"
      />

      <div className="flex items-center justify-between gap-3">
        <p className="text-xs text-gray-500">
          {shown.length} de {orders.length}
        </p>
        {shown.length > 0 && (
          <button
            type="button"
            onClick={selectAllShown}
            className="min-h-9 text-sm font-medium text-emerald-600"
          >
            Seleccionar los {shown.length}
          </button>
        )}
      </div>

      {shown.length === 0 && (
        <p className="text-sm text-gray-500">Ningún pedido coincide con ese filtro.</p>
      )}

      {/* La casilla y el detalle son dos gestos distintos: si toda la fila
          fuera una etiqueta, abrir el pedido lo marcaría para borrar. */}
      <ul className="max-h-[60vh] flex-col gap-2 overflow-y-auto overscroll-contain">
        {shown.map((order) => (
          <li key={order.id} className="mb-2">
            <div
              className={`flex items-center gap-3 rounded-2xl border p-3 ${
                selected.has(order.id)
                  ? "border-rose-300 bg-rose-50"
                  : "border-gray-200 bg-white"
              }`}
            >
              <label className="flex h-11 w-6 shrink-0 items-center justify-center">
                <span className="sr-only">Seleccionar {order.code} para borrar</span>
                <input
                  type="checkbox"
                  checked={selected.has(order.id)}
                  onChange={() => toggle(order.id)}
                  className="h-4 w-4 accent-rose-600"
                />
              </label>

              <button
                type="button"
                onClick={() => setDetalle(order.id)}
                className="flex min-w-0 flex-1 items-center gap-3 text-left"
              >
                <span className="min-w-0 flex-1">
                  <span className="flex items-center gap-2">
                    <span className="font-mono text-sm font-semibold text-gray-900">
                      {order.code}
                    </span>
                    <span className="rounded-full bg-gray-100 px-2 py-0.5 text-xs font-medium text-gray-600">
                      {statusLabel(order.status, order.shopper_id)}
                    </span>
                  </span>
                  <span className="block truncate text-xs text-gray-500">
                    {formatOrderDate(order.created_at)}
                    {order.address_label ? ` · ${order.address_label}` : ""}
                  </span>
                </span>
                <span className="shrink-0 text-sm font-semibold tabular-nums text-gray-900">
                  {formatMoney(order.total)}
                </span>
                <ChevronRight className="h-4 w-4 shrink-0 text-gray-400" aria-hidden="true" />
              </button>
            </div>
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

      {detalle && <DetallePedido orderId={detalle} onClose={() => setDetalle(null)} />}
    </div>
  )
}
