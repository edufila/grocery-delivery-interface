"use client"

import Link from "next/link"
import { ShoppingCart } from "lucide-react"

import { useCart } from "@/lib/cart"

/**
 * Fuera del catálogo no había ninguna señal de que el carrito tuviera algo.
 * Se muestra solo cuando hay productos, para no ocupar lugar al pedo.
 */
export function CartIndicator() {
  const { count, ready } = useCart()

  if (!ready || count === 0) return null

  return (
    <Link
      href="/checkout"
      className="relative flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-gray-700 transition active:bg-gray-100"
      aria-label={`Ver el carrito, ${count} ${count === 1 ? "artículo" : "artículos"}`}
    >
      <ShoppingCart className="h-5 w-5" aria-hidden="true" />
      <span
        className="absolute right-0.5 top-0.5 flex h-5 min-w-5 items-center justify-center rounded-full bg-emerald-600 px-1 text-[11px] font-bold tabular-nums text-white"
        aria-hidden="true"
      >
        {count}
      </span>
    </Link>
  )
}
