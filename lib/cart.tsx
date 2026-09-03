"use client"

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react"

import { createClient } from "@/lib/supabase/client"
import { isSupabaseConfigured } from "@/lib/supabase/config"
import { fetchProducts, type Product } from "@/lib/products"

const STORAGE_KEY = "carrito"

export type CartLine = { product: Product; qty: number }

type CartValue = {
  /** Cantidades por id de producto. */
  quantities: Record<string, number>
  lines: CartLine[]
  count: number
  subtotal: number
  /** false hasta leer el storage y el catálogo. */
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
      if (typeof qty === "number" && qty > 0) clean[id] = Math.floor(qty)
    }
    return clean
  } catch {
    return {}
  }
}

export function CartProvider({ children }: { children: React.ReactNode }) {
  const [quantities, setQuantities] = useState<Record<string, number>>({})
  const [products, setProducts] = useState<Product[]>([])
  const [loaded, setLoaded] = useState(false)

  useEffect(() => {
    setQuantities(readStored())

    if (!isSupabaseConfigured) {
      setLoaded(true)
      return
    }

    let cancelled = false
    void (async () => {
      const list = await fetchProducts(createClient())
      if (cancelled) return
      setProducts(list)
      setLoaded(true)
    })()

    return () => {
      cancelled = true
    }
  }, [])

  useEffect(() => {
    if (!loaded) return
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(quantities))
    } catch {
      // Storage bloqueado: el carrito vive solo en esta pestaña.
    }
  }, [quantities, loaded])

  const byId = useMemo(() => new Map(products.map((p) => [p.id, p])), [products])

  const add = useCallback((id: string) => {
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
      const product = byId.get(id)
      // Un producto que salió del catálogo simplemente no se muestra ni suma.
      if (!product) continue
      lines.push({ product, qty })
      count += qty
      subtotal += product.price * qty
    }

    return { quantities, lines, count, subtotal, ready: loaded, add, removeOne, removeAll, clear }
  }, [quantities, byId, loaded, add, removeOne, removeAll, clear])

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>
}

export function useCart() {
  const context = useContext(CartContext)
  if (!context) throw new Error("useCart necesita estar dentro de <CartProvider>")
  return context
}
