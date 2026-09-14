"use client"

import Link from "next/link"
import { ShoppingCart } from "lucide-react"

import { useCart } from "@/lib/cart"

/**
 * El carrito, arriba a la izquierda.
 *
 * Siempre lleva al carrito. Antes, vacío, llevaba a "Tus pedidos": venía de
 * cuando no había barra de abajo y esta era la única puerta al historial. Con
 * Pedidos en la barra eso sobraba, y un ícono de carrito que abre otra cosa es
 * de lo que más desorienta. Vacío, el carrito ya dice qué hacer.
 */
export function CartIndicator() {
  const { count, ready } = useCart()

  if (!ready) return null

  const hasItems = count > 0

  return (
    <Link
      href="/checkout"
      className="relative flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-gray-700 transition active:bg-gray-100"
      aria-label={
        hasItems ? `Ver el carrito, ${count} ${count === 1 ? "artículo" : "artículos"}` : "Ver el carrito, vacío"
      }
    >
      <ShoppingCart className="h-5 w-5" aria-hidden="true" />
      {hasItems && (
        <span
          key={count}
          className="absolute right-0.5 top-0.5 flex h-5 min-w-5 animate-[cart-pop_0.3s_ease-out] items-center justify-center rounded-full bg-emerald-600 px-1 text-[11px] font-bold tabular-nums text-white"
          aria-hidden="true"
        >
          {count}
        </span>
      )}
    </Link>
  )
}
