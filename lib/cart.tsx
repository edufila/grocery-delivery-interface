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
  /** false hasta leer el storage y conocer cada producto que hay en él. */
  ready: boolean
  /**
   * Los abastos que hay en el carrito. Un pedido es de uno solo -- el shopper
   * hace un recorrido -- y la base rechaza los mezclados, así que hay que
   * poder avisar antes de que el cliente llegue al final.
   */
  storeIds: string[]
  /** Lo que estaba guardado y ya no está en el catálogo. */
  perdidos: string[]
  /** Lo que el abasto marcó como agotado mientras esperaba en el carrito. */
  agotados: CartLine[]
  add: (id: string) => void
  removeOne: (id: string) => void
  removeAll: (id: string) => void
  /** Deja en el carrito solo lo de ese abasto. */
  keepOnly: (storeId: string) => void
  /** Saca del carrito lo que no se puede pedir: lo que ya no existe y lo agotado. */
  descartarPerdidos: () => void
  /** Pisa el carrito entero. Lo usa "volver a pedir". */
  reemplazar: (cantidades: Record<string, number>) => void
  clear: () => void
  /** Le presenta al carrito productos que ya llegaron por otro lado. */
  conocer: (lista: Product[]) => void
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
  const [byId, setById] = useState<Map<string, Product>>(() => new Map())
  /** Los ids por los que ya se le preguntó a la base, estén o no. */
  const [consultados, setConsultados] = useState<ReadonlySet<string>>(() => new Set())
  const [leido, setLeido] = useState(false)

  useEffect(() => {
    setQuantities(readStored())
    setLeido(true)
  }, [])

  /**
   * Suma productos que ya se tienen a mano, sin ir a la base.
   *
   * El catálogo de un abasto ya trae sus productos del servidor: con esto el
   * carrito los conoce desde el primer toque, y la barra de "Ver carrito"
   * aparece al instante en vez de esperar una consulta.
   */
  const conocer = useCallback((lista: Product[]) => {
    if (lista.length === 0) return
    setById((prev) => {
      const next = new Map(prev)
      for (const p of lista) next.set(p.id, p)
      return next
    })
    setConsultados((prev) => {
      const next = new Set(prev)
      for (const p of lista) next.add(p.id)
      return next
    })
  }, [])

  /**
   * Solo lo que está en el carrito, y solo lo que todavía no se conoce.
   *
   * Antes se descargaba el catálogo entero de TODOS los abastos en cada pantalla
   * que se abría, con el carrito vacío incluido: con nueve productos no se nota,
   * con quinientos por abasto es un mega en cada visita, en datos móviles. Ahora
   * con el carrito vacío no se pide nada.
   */
  const faltan = useMemo(
    () => Object.keys(quantities).filter((id) => !consultados.has(id)).sort(),
    [quantities, consultados],
  )
  const clavesFaltan = faltan.join(",")

  useEffect(() => {
    if (!leido || faltan.length === 0) return
    if (!isSupabaseConfigured) {
      setConsultados((prev) => new Set([...prev, ...faltan]))
      return
    }

    let cancelled = false
    void (async () => {
      const lista = await fetchProducts(createClient(), undefined, faltan)
      if (cancelled) return
      setById((prev) => {
        const next = new Map(prev)
        for (const p of lista) next.set(p.id, p)
        return next
      })
      // También los que no volvieron: así cuentan como perdidos y no se vuelven
      // a pedir en cada render.
      setConsultados((prev) => new Set([...prev, ...faltan]))
    })()

    return () => {
      cancelled = true
    }
    // La lista como texto, no el arreglo: se arma nuevo en cada render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [leido, clavesFaltan])

  const loaded = leido && faltan.length === 0

  useEffect(() => {
    if (!leido) return
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(quantities))
    } catch {
      // Storage bloqueado: el carrito vive solo en esta pestaña.
    }
  }, [quantities, leido])

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
        // Se van los que ya no están y también los agotados: los dos frenan
        // el pedido, y para el cliente el problema es el mismo.
        if (byId.get(id)?.in_stock) next[id] = qty
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
      agotados: loaded ? resumen.agotados : [],
      ready: loaded,
      add,
      removeOne,
      removeAll,
      keepOnly,
      descartarPerdidos,
      reemplazar,
      clear,
      conocer,
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
      conocer,
    ],
  )

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>
}

export function useCart() {
  const context = useContext(CartContext)
  if (!context) throw new Error("useCart necesita estar dentro de <CartProvider>")
  return context
}
