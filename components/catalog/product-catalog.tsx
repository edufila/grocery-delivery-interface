"use client"

import { useMemo, useState } from "react"
import { CatalogHeader } from "./catalog-header"
import { ProductCard } from "./product-card"
import { CartBar } from "./cart-bar"
import type { Category } from "@/lib/categories"
import { useCart } from "@/lib/cart"
import type { Product } from "@/lib/products"

type Props = {
  products: Product[]
  initialQuery?: string
  initialCategory?: Category
  initialWholesaleOnly?: boolean
}

export function ProductCatalog({
  products,
  initialQuery = "",
  initialCategory = "Todos",
  initialWholesaleOnly = false,
}: Props) {
  const { quantities, count, subtotal, add, removeOne } = useCart()

  const [category, setCategory] = useState<Category>(initialCategory)
  const [query, setQuery] = useState(initialQuery)
  const [searchOpen, setSearchOpen] = useState(initialQuery.length > 0)
  const [wholesaleOnly, setWholesaleOnly] = useState(initialWholesaleOnly)

  const visibleProducts = useMemo(() => {
    const term = query.trim().toLowerCase()
    return products.filter((p) => {
      if (category !== "Todos" && p.category !== category) return false
      if (wholesaleOnly && !p.wholesale) return false
      if (term && !p.name.toLowerCase().includes(term)) return false
      return true
    })
  }, [products, category, query, wholesaleOnly])

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
                quantity={quantities[product.id] ?? 0}
                onAdd={add}
                onRemove={removeOne}
              />
            ))}
          </div>
        )}
      </main>

      <CartBar count={count} total={subtotal} />
    </div>
  )
}
