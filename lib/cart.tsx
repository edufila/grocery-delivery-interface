"use client"

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react"

import { resumirCarrito, type CartLine } from "@/lib/carrito"
import { createClient } from "@/lib/supabase/client"
import { isSupabaseConfigured } from "@/lib/supabase/config"
import { fetchProducts, type Product } from "@/lib/products"

const STORAGE_KEY = "carrito"

export type { CartLine }

type CartValue = {
  /** Cantidades por id de producto. */
  quantities: Record<string, number>
  lines: CartLine[]
  count: number
  subtotal: number
  /** false hasta leer el storage y el catálogo. */
  ready: boolean
  /**
   * Los abastos que hay en el carrito. Un pedido es de uno solo -- el shopper
   * hace un recorrido -- y la base rechaza los mezclados, así que hay que
   * poder avisar antes de que el cliente llegue al final.
   */
  storeIds: string[]
  /** Lo que estaba guardado y ya no está en el catálogo. */
  perdidos: string[]
  add: (id: string) => void
  removeOne: (id: string) => void
  removeAll: (id: string) => void
  /** Deja en el carrito solo lo de ese abasto. */
  keepOnly: (storeId: string) => void
  /** Saca del carrito lo que ya no existe. */
  descartarPerdidos: () => void
  /** Pisa el carrito entero. Lo usa "volver a pedir". */
  reemplazar: (cantidades: Record<string, number>) => void
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

  const reemplazar = useCallback((cantidades: Record<string, number>) => {
    const limpio: Record<string, number> = {}
    for (const [id, qty] of Object.entries(cantidades)) {
      if (Number.isFinite(qty) && qty > 0) limpio[id] = Math.floor(qty)
    }
    setQuantities(limpio)
  }, [])

  const keepOnly = useCallback(
    (storeId: string) => {
      setQuantities((prev) => {
        const next: Record<string, number> = {}
        for (const [id, qty] of Object.entries(prev)) {
          // Lo que ya no está en el catálogo se va: no se puede saber de quién era.
          if (byId.get(id)?.store_id === storeId) next[id] = qty
        }
        return next
      })
    },
    [byId],
  )

  const resumen = useMemo(() => resumirCarrito(quantities, byId), [quantities, byId])

  const descartarPerdidos = useCallback(() => {
    setQuantities((prev) => {
      const next: Record<string, number> = {}
      for (const [id, qty] of Object.entries(prev)) {
        if (byId.has(id)) next[id] = qty
      }
      return next
    })
  }, [byId])

  const value = useMemo<CartValue>(
    () => ({
      quantities,
      ...resumen,
      /**
       * Mientras el catálogo no llegó, el mapa está vacío y TODO parecería
       * perdido. Sin esto, cada carga de pantalla mostraría por un instante que
       * los productos ya no existen.
       */
      perdidos: loaded ? resumen.perdidos : [],
      ready: loaded,
      add,
      removeOne,
      removeAll,
      keepOnly,
      descartarPerdidos,
      reemplazar,
      clear,
    }),
    [
      quantities,
      resumen,
      loaded,
      add,
      removeOne,
      removeAll,
      keepOnly,
      descartarPerdidos,
      reemplazar,
      clear,
    ],
  )

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>
}

export function useCart() {
  const context = useContext(CartContext)
  if (!context) throw new Error("useCart necesita estar dentro de <CartProvider>")
  return context
}
