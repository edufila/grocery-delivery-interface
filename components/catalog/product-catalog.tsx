"use client"

import { useMemo, useState } from "react"
import { CatalogHeader } from "./catalog-header"
import type { Category } from "@/lib/categories"
import { ProductCard, type Product } from "./product-card"
import { CartBar } from "./cart-bar"

type CatalogProduct = Product & { category: Exclude<Category, "Todos"> }

const products: CatalogProduct[] = [
  { id: "harina-pan", name: "Harina de Maíz PAN", unit: "Bulto de 12 · 1 kg c/u", price: 24.5, image: "/products/harina-pan.png", wholesale: true, category: "Harinas" },
  { id: "aceite", name: "Aceite Comestible Vegetal", unit: "Caja de 12 · 1 L c/u", price: 32.9, image: "/products/aceite.png", wholesale: true, category: "Aceites" },
  { id: "arroz", name: "Arroz Blanco Superior", unit: "Unidad · 1 kg", price: 1.85, image: "/products/arroz.png", category: "Granos" },
  { id: "cafe", name: "Café Molido Premium", unit: "Unidad · 500 g", price: 6.75, image: "/products/cafe.png", category: "Bebidas" },
  { id: "azucar", name: "Azúcar Refinada", unit: "Unidad · 1 kg", price: 1.45, image: "/products/azucar.png", category: "Granos" },
  { id: "pasta", name: "Pasta Larga Spaghetti", unit: "Bulto de 20 · 1 kg c/u", price: 18.0, image: "/products/pasta.png", wholesale: true, category: "Harinas" },
  { id: "harina-trigo", name: "Harina de Trigo Leudante", unit: "Unidad · 1 kg", price: 1.2, image: "/products/harina-trigo.png", category: "Harinas" },
  { id: "leche", name: "Leche en Polvo Completa", unit: "Unidad · 900 g", price: 8.9, image: "/products/leche.png", category: "Lácteos" },
]

type Props = {
  initialQuery?: string
  initialCategory?: Category
  initialWholesaleOnly?: boolean
}

export function ProductCatalog({
  initialQuery = "",
  initialCategory = "Todos",
  initialWholesaleOnly = false,
}: Props) {
  const [cart, setCart] = useState<Record<string, number>>({})
  const [category, setCategory] = useState<Category>(initialCategory)
  const [query, setQuery] = useState(initialQuery)
  const [searchOpen, setSearchOpen] = useState(initialQuery.length > 0)
  const [wholesaleOnly, setWholesaleOnly] = useState(initialWholesaleOnly)

  const addToCart = (id: string) =>
    setCart((prev) => ({ ...prev, [id]: (prev[id] ?? 0) + 1 }))

  const removeFromCart = (id: string) =>
    setCart((prev) => {
      const next = { ...prev }
      const current = next[id] ?? 0
      if (current <= 1) delete next[id]
      else next[id] = current - 1
      return next
    })

  const { count, total } = useMemo(() => {
    let count = 0
    let total = 0
    for (const product of products) {
      const qty = cart[product.id] ?? 0
      count += qty
      total += qty * product.price
    }
    return { count, total }
  }, [cart])

  const visibleProducts = useMemo(() => {
    const term = query.trim().toLowerCase()
    return products.filter((p) => {
      if (category !== "Todos" && p.category !== category) return false
      if (wholesaleOnly && !p.wholesale) return false
      if (term && !p.name.toLowerCase().includes(term)) return false
      return true
    })
  }, [category, query, wholesaleOnly])

  const sinResultados =
    query.trim().length > 0
      ? `No encontramos productos con "${query.trim()}".`
      : wholesaleOnly
        ? "No hay productos al mayor en esta categoría."
        : `Todavía no hay productos en ${category}.`

  return (
    <div className="min-h-dvh bg-gray-50 pb-28">
      <CatalogHeader
        active={category}
        onCategoryChange={setCategory}
        query={query}
        onQueryChange={setQuery}
        searchOpen={searchOpen}
        onSearchOpenChange={setSearchOpen}
      />

      <main className="mx-auto max-w-3xl px-4 py-4">
        <div className="mb-3 flex items-baseline justify-between gap-3">
          <h1 className="text-lg font-bold text-gray-900">
            {category === "Todos" ? "Catálogo" : category}
          </h1>
          <p className="shrink-0 text-sm text-gray-500">
            {visibleProducts.length} {visibleProducts.length === 1 ? "producto" : "productos"}
          </p>
        </div>

        <button
          type="button"
          onClick={() => setWholesaleOnly((v) => !v)}
          aria-pressed={wholesaleOnly}
          className={`mb-4 min-h-9 rounded-full px-4 py-1.5 text-sm font-medium transition ${
            wholesaleOnly
              ? "bg-emerald-600 text-white"
              : "border border-gray-200 bg-white text-gray-600 active:bg-gray-100"
          }`}
        >
          Solo al mayor
        </button>

        {visibleProducts.length === 0 ? (
          <p className="rounded-2xl border border-dashed border-gray-200 bg-white px-4 py-10 text-center text-sm text-gray-500">
            {sinResultados}
          </p>
        ) : (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
            {visibleProducts.map((product) => (
              <ProductCard
                key={product.id}
                product={product}
                quantity={cart[product.id] ?? 0}
                onAdd={addToCart}
                onRemove={removeFromCart}
              />
            ))}
          </div>
        )}
      </main>

      <CartBar count={count} total={total} />
    </div>
  )
}
