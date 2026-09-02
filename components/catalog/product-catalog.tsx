"use client"

import { useMemo, useState } from "react"
import { CatalogHeader } from "./catalog-header"
import { ProductCard, type Product } from "./product-card"
import { CartBar } from "./cart-bar"

const products: Product[] = [
  { id: "harina-pan", name: "Harina de Maíz PAN", unit: "Bulto de 12 · 1 kg c/u", price: 24.5, image: "/products/harina-pan.png", wholesale: true },
  { id: "aceite", name: "Aceite Comestible Vegetal", unit: "Caja de 12 · 1 L c/u", price: 32.9, image: "/products/aceite.png", wholesale: true },
  { id: "arroz", name: "Arroz Blanco Superior", unit: "Unidad · 1 kg", price: 1.85, image: "/products/arroz.png" },
  { id: "cafe", name: "Café Molido Premium", unit: "Unidad · 500 g", price: 6.75, image: "/products/cafe.png" },
  { id: "azucar", name: "Azúcar Refinada", unit: "Unidad · 1 kg", price: 1.45, image: "/products/azucar.png" },
  { id: "pasta", name: "Pasta Larga Spaghetti", unit: "Bulto de 20 · 1 kg c/u", price: 18.0, image: "/products/pasta.png", wholesale: true },
  { id: "harina-trigo", name: "Harina de Trigo Leudante", unit: "Unidad · 1 kg", price: 1.2, image: "/products/harina-trigo.png" },
  { id: "leche", name: "Leche en Polvo Completa", unit: "Unidad · 900 g", price: 8.9, image: "/products/leche.png" },
]

export function ProductCatalog() {
  const [cart, setCart] = useState<Record<string, number>>({})

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

  return (
    <div className="min-h-dvh bg-gray-50 pb-28">
      <CatalogHeader />

      <main className="mx-auto max-w-3xl px-4 py-4">
        <div className="mb-3 flex items-baseline justify-between">
          <h1 className="text-lg font-bold text-gray-900">Catálogo</h1>
          <p className="text-sm text-gray-500">{products.length} productos</p>
        </div>

        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
          {products.map((product) => (
            <ProductCard
              key={product.id}
              product={product}
              quantity={cart[product.id] ?? 0}
              onAdd={addToCart}
              onRemove={removeFromCart}
            />
          ))}
        </div>
      </main>

      <CartBar count={count} total={total} />
    </div>
  )
}
