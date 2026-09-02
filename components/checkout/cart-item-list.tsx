"use client"

import Image from "next/image"
import { Minus, Plus, Trash2 } from "lucide-react"

export type CartLine = {
  id: string
  name: string
  presentation: string
  price: number
  qty: number
  image: string
}

type Props = {
  items: CartLine[]
  onInc: (id: string) => void
  onDec: (id: string) => void
  onRemove: (id: string) => void
}

export function CartItemList({ items, onInc, onDec, onRemove }: Props) {
  return (
    <section aria-labelledby="cart-items-heading" className="rounded-2xl border border-gray-100 bg-white p-4 shadow-sm">
      <h2 id="cart-items-heading" className="mb-4 text-base font-semibold text-gray-900">
        Tu pedido{" "}
        <span className="text-sm font-normal text-gray-500">
          ({items.reduce((n, i) => n + i.qty, 0)} artículos)
        </span>
      </h2>

      <ul className="divide-y divide-gray-100">
        {items.map((item) => (
          <li key={item.id} className="flex items-center gap-3 py-3">
            <div className="relative h-16 w-16 shrink-0 overflow-hidden rounded-xl bg-gray-50">
              <Image
                src={item.image || "/placeholder.svg"}
                alt={item.name}
                fill
                sizes="64px"
                className="object-contain p-1.5"
              />
            </div>

            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium text-gray-900">{item.name}</p>
              <p className="truncate text-xs text-gray-500">{item.presentation}</p>
              <p className="mt-0.5 text-sm font-semibold text-emerald-600">${item.price.toFixed(2)}</p>
            </div>

            <div className="flex flex-col items-end gap-2">
              <button
                type="button"
                onClick={() => onRemove(item.id)}
                aria-label={`Eliminar ${item.name}`}
                className="text-gray-400 transition-colors hover:text-red-500"
              >
                <Trash2 className="h-4 w-4" />
              </button>

              <div className="flex items-center gap-1 rounded-full border border-gray-200 p-0.5">
                <button
                  type="button"
                  onClick={() => onDec(item.id)}
                  aria-label={`Disminuir cantidad de ${item.name}`}
                  className="flex h-7 w-7 items-center justify-center rounded-full text-gray-600 transition-colors hover:bg-gray-100"
                >
                  <Minus className="h-3.5 w-3.5" />
                </button>
                <span className="w-6 text-center text-sm font-semibold tabular-nums text-gray-900">{item.qty}</span>
                <button
                  type="button"
                  onClick={() => onInc(item.id)}
                  aria-label={`Aumentar cantidad de ${item.name}`}
                  className="flex h-7 w-7 items-center justify-center rounded-full bg-emerald-500 text-white transition-colors hover:bg-emerald-600"
                >
                  <Plus className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>
          </li>
        ))}
      </ul>

      {items.length === 0 && (
        <p className="py-8 text-center text-sm text-gray-500">Tu carrito está vacío.</p>
      )}
    </section>
  )
}
