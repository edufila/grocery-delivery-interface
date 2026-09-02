"use client"

import { ShoppingCart } from "lucide-react"

type Props = {
  count: number
  total: number
}

export function CartBar({ count, total }: Props) {
  const visible = count > 0

  return (
    <div
      className={`fixed inset-x-0 bottom-0 z-40 px-4 pb-[calc(env(safe-area-inset-bottom)+1rem)] pt-2 transition-all duration-300 ${
        visible ? "translate-y-0 opacity-100" : "pointer-events-none translate-y-full opacity-0"
      }`}
    >
      <button
        type="button"
        className="mx-auto flex w-full max-w-3xl items-center justify-between gap-3 rounded-2xl bg-emerald-600 px-4 py-3.5 text-white shadow-lg shadow-emerald-600/30 transition active:scale-[0.99]"
      >
        <span className="flex items-center gap-3">
          <span className="relative flex h-9 w-9 items-center justify-center rounded-xl bg-white/20">
            <ShoppingCart className="h-5 w-5" aria-hidden="true" />
            <span
              key={count}
              className="absolute -right-1.5 -top-1.5 flex h-5 min-w-5 animate-[cart-pop_0.3s_ease-out] items-center justify-center rounded-full bg-white px-1 text-xs font-bold text-emerald-600"
            >
              {count}
            </span>
          </span>
          <span className="text-sm font-semibold">
            {count} {count === 1 ? "artículo" : "artículos"}
          </span>
        </span>

        <span className="flex items-center gap-2 text-sm font-bold">
          Ver Carrito
          <span className="rounded-lg bg-white/20 px-2 py-1 tabular-nums">
            ${total.toFixed(2)}
          </span>
        </span>
      </button>
    </div>
  )
}
