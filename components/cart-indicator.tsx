"use client"

import Link from "next/link"
import { ShoppingCart } from "lucide-react"

import { useCart } from "@/lib/cart"

/**
 * Vive arriba a la izquierda, siempre visible: con la barra inferior fuera,
 * es la única puerta a "mis pedidos" además del checkout. Con carrito armado
 * lleva a pagar; vacío, lleva al historial, que es lo otro que se buscaba ahí.
 */
export function CartIndicator() {
  const { count, ready } = useCart()

  if (!ready) return null

  const hasItems = count > 0

  return (
    <Link
      href={hasItems ? "/checkout" : "/pedidos"}
      className="relative flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-gray-700 transition active:bg-gray-100"
      aria-label={
        hasItems ? `Ver el carrito, ${count} ${count === 1 ? "artículo" : "artículos"}` : "Tus pedidos"
      }
    >
      <ShoppingCart className="h-5 w-5" aria-hidden="true" />
      {hasItems && (
        <span
          className="absolute right-0.5 top-0.5 flex h-5 min-w-5 items-center justify-center rounded-full bg-emerald-600 px-1 text-[11px] font-bold tabular-nums text-white"
          aria-hidden="true"
        >
          {count}
        </span>
      )}
    </Link>
  )
}
