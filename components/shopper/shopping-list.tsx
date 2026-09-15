"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Check, Loader2, Minus, PackageX } from "lucide-react"

import { formatMoney, type OrderItem } from "@/lib/orders"
import { createClient } from "@/lib/supabase/client"
import { fotoLigera } from "@/lib/fotos"

type Item = OrderItem & { status: string; final_qty: number | null }

/**
 * La lista de compra del shopper. Cada renglón se marca en la caja, y el total
 * del pedido se recalcula solo: lo que se cobra no se sabe hasta que terminó
 * de recorrer el abasto.
 */
export function ShoppingList({
  items,
  imagenes = {},
  substitutionPolicy,
  editable,
}: {
  items: Item[]
  /** Foto por id de producto. En el anaquel se busca por el empaque, no por el nombre. */
  imagenes?: Record<string, string | null>
  substitutionPolicy: string
  editable: boolean
}) {
  const router = useRouter()
  const [busyId, setBusyId] = useState<string | null>(null)
  const [error, setError] = useState("")

  async function mark(item: Item, status: string, finalQty?: number) {
    setBusyId(item.id)
    setError("")

    const { error: rpcError } = await createClient().rpc("shopper_set_item", {
      p_item_id: item.id,
      p_status: status,
      p_final_qty: finalQty ?? null,
    })

    setBusyId(null)
    if (rpcError) {
      setError(
        rpcError.message.includes("does not exist")
          ? "Falta correr la migración de faltantes en Supabase."
          : "No se pudo marcar. Prueba de nuevo.",
      )
      return
    }
    router.refresh()
  }

  const pendientes = items.filter((i) => i.status === "pendiente").length
  const revisados = items.length - pendientes

  return (
    <section className="rounded-2xl border border-gray-100 bg-white p-5">
      <div className="mb-1 flex items-baseline justify-between gap-3">
        <h2 className="text-base font-semibold text-gray-900">Qué comprar</h2>
        <span className="shrink-0 text-sm text-gray-500">
          {pendientes === 0 ? "Todo revisado" : `${pendientes} sin revisar`}
        </span>
      </div>
      <div
        className="mb-3 mt-2 h-1.5 overflow-hidden rounded-full bg-gray-100"
        role="progressbar"
        aria-label="Productos revisados"
        aria-valuemin={0}
        aria-valuemax={items.length}
        aria-valuenow={revisados}
      >
        <div
          className="h-full rounded-full bg-emerald-600 transition-all duration-500"
          style={{ width: `${items.length ? (revisados / items.length) * 100 : 0}%` }}
        />
      </div>
      <p className="mb-4 text-xs leading-relaxed text-gray-500">
        Si falta algo: {substitutionPolicy}
      </p>

      {error && (
        <p role="alert" className="mb-3 text-sm text-rose-600">
          {error}
        </p>
      )}

      <ul className="flex flex-col divide-y divide-gray-100">
        {items.map((item) => {
          const llevadas = item.final_qty ?? item.qty
          const faltante = item.status === "faltante"
          const ajustado = item.status === "ajustado"

          return (
            <li key={item.id} className="py-3">
              <div className="flex items-start justify-between gap-3">
                <div className="flex min-w-0 gap-3">
                  <span className="relative h-14 w-14 shrink-0">
                    <img
                      src={fotoLigera(imagenes[item.product_id]) || "/placeholder.svg"}
                      alt=""
                      loading="lazy"
                      decoding="async"
                      className={`h-14 w-14 rounded-xl bg-gray-50 object-cover ${faltante ? "opacity-40 grayscale" : ""}`}
                    />
                    <span
                      className={`absolute -right-1.5 -top-1.5 flex h-6 min-w-6 items-center justify-center rounded-full px-1 text-xs font-bold tabular-nums ring-2 ring-white ${
                        faltante
                          ? "bg-rose-600 text-white"
                          : ajustado
                            ? "bg-amber-100 text-amber-800"
                            : "bg-emerald-600 text-white"
                      }`}
                    >
                      {faltante ? "0" : llevadas}
                    </span>
                  </span>
                  <div className="min-w-0">
                    <p
                      className={`text-sm font-medium ${
                        faltante ? "text-gray-500 line-through" : "text-gray-900"
                      }`}
                    >
                      {item.name}
                    </p>
                    <p className="text-xs text-gray-500">
                      {item.unit}
                      {ajustado && ` · de ${item.qty} pedidos`}
                    </p>
                  </div>
                </div>
                <span className="shrink-0 text-sm tabular-nums text-gray-500">
                  {formatMoney(item.unit_price * (faltante ? 0 : llevadas))}
                </span>
              </div>

              {editable && (
                <div className="mt-2 flex flex-wrap gap-1.5">
                  <button
                    type="button"
                    onClick={() => void mark(item, "ok")}
                    disabled={busyId === item.id}
                    className={`flex min-h-11 items-center gap-1.5 rounded-full px-3 text-sm font-medium transition ${
                      item.status === "ok"
                        ? "bg-emerald-600 text-white"
                        : "border border-gray-200 text-gray-600 active:bg-gray-50"
                    }`}
                  >
                    <Check className="h-4 w-4" aria-hidden="true" />
                    Lo llevé
                  </button>

                  <button
                    type="button"
                    onClick={() => void mark(item, "ajustado", Math.max(0, llevadas - 1))}
                    disabled={busyId === item.id || llevadas <= 0}
                    className="flex min-h-11 items-center gap-1.5 rounded-full border border-gray-200 px-3 text-sm font-medium text-gray-600 transition active:bg-gray-50 disabled:opacity-50"
                  >
                    <Minus className="h-4 w-4" aria-hidden="true" />
                    Llevé menos
                  </button>

                  <button
                    type="button"
                    onClick={() => void mark(item, "faltante")}
                    disabled={busyId === item.id}
                    className={`flex min-h-11 items-center gap-1.5 rounded-full px-3 text-sm font-medium transition ${
                      faltante
                        ? "bg-rose-600 text-white"
                        : "border border-gray-200 text-gray-600 active:bg-gray-50"
                    }`}
                  >
                    <PackageX className="h-4 w-4" aria-hidden="true" />
                    No había
                  </button>

                  {busyId === item.id && (
                    <Loader2 className="mt-3.5 h-4 w-4 animate-spin text-gray-500" aria-hidden="true" />
                  )}
                </div>
              )}
            </li>
          )
        })}
      </ul>
    </section>
  )
}
