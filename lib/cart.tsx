"use client"

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react"

import { findProduct, type Product } from "@/lib/products"

const STORAGE_KEY = "carrito"

export type CartLine = { product: Product; qty: number }

type CartValue = {
  /** Cantidades por id de producto. */
  quantities: Record<string, number>
  lines: CartLine[]
  count: number
  subtotal: number
  /** false hasta leer localStorage, para no pintar un carrito vacío y corregirlo. */
  ready: boolean
  add: (id: string) => void
  removeOne: (id: string) => void
  removeAll: (id: string) => void
  clear: () => void
}

const CartContext = createContext<CartValue | null>(null)

function readStored(): Record<string, number> {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return {}
    const parsed = JSON.parse(raw) as Record<string, unknown>
    const clean: Record<string, number> = {}
    for (const [id, qty] of Object.entries(parsed)) {
      // Ignoramos productos que ya no existen y cantidades corruptas.
      if (typeof qty === "number" && qty > 0 && findProduct(id)) {
        clean[id] = Math.floor(qty)
      }
    }
    return clean
  } catch {
    return {}
  }
}

export function CartProvider({ children }: { children: React.ReactNode }) {
  const [quantities, setQuantities] = useState<Record<string, number>>({})
  const [ready, setReady] = useState(false)

  useEffect(() => {
    setQuantities(readStored())
    setReady(true)
  }, [])

  useEffect(() => {
    if (!ready) return
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(quantities))
    } catch {
      // Storage bloqueado: el carrito vive solo en esta pestaña.
    }
  }, [quantities, ready])

  const add = useCallback((id: string) => {
    if (!findProduct(id)) return
    setQuantities((prev) => ({ ...prev, [id]: (prev[id] ?? 0) + 1 }))
  }, [])

  const removeOne = useCallback((id: string) => {
    setQuantities((prev) => {
      const current = prev[id] ?? 0
      if (current <= 1) {
        const { [id]: _removed, ...rest } = prev
        return rest
      }
      return { ...prev, [id]: current - 1 }
    })
  }, [])

  const removeAll = useCallback((id: string) => {
    setQuantities((prev) => {
      const { [id]: _removed, ...rest } = prev
      return rest
    })
  }, [])

  const clear = useCallback(() => setQuantities({}), [])

  const value = useMemo<CartValue>(() => {
    const lines: CartLine[] = []
    let count = 0
    let subtotal = 0

    for (const [id, qty] of Object.entries(quantities)) {
      const product = findProduct(id)
      if (!product) continue
      lines.push({ product, qty })
      count += qty
      subtotal += product.price * qty
    }

    return { quantities, lines, count, subtotal, ready, add, removeOne, removeAll, clear }
  }, [quantities, ready, add, removeOne, removeAll, clear])

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>
}

export function useCart() {
  const context = useContext(CartContext)
  if (!context) throw new Error("useCart necesita estar dentro de <CartProvider>")
  return context
}
