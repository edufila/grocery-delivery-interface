"use client"

import Link from "next/link"
import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { ChevronDown, Search } from "lucide-react"

import { CambiarAbasto } from "./cambiar-abasto"
import { CatalogHeader } from "./catalog-header"
import { FichaProducto } from "./ficha-producto"
import { ProductCard } from "./product-card"
import { StoreHero } from "./store-hero"
import { CartBar } from "./cart-bar"
import type { Category } from "@/lib/categories"
import { useCart } from "@/lib/cart"
import { useFavoritos } from "@/lib/favoritos"
import type { Product } from "@/lib/products"
import { contieneTexto } from "@/lib/texto"

type Orden = "recomendado" | "barato" | "caro" | "nombre"

type Props = {
  products: Product[]
  storeId: string
  storeName: string
  storeTag?: string
  storeImage?: string | null
  storeEta?: string | null
  deliveryFee?: number | null
  initialQuery?: string
  initialCategory?: Category
  initialWholesaleOnly?: boolean
  tasaVes?: number | null
}

export function ProductCatalog({
  products,
  storeId,
  storeName,
  storeTag,
  storeImage,
  storeEta,
  deliveryFee,
  initialQuery = "",
  initialCategory = "Todos",
  initialWholesaleOnly = false,
  tasaVes,
}: Props) {
  const { quantities, count, subtotal, add, removeOne, conocer } = useCart()

  // El carrito ya no baja el catálogo entero: se le pasan los de este abasto,
  // que llegaron armados del servidor.
  useEffect(() => {
    conocer(products)
  }, [conocer, products])
  const favoritos = useFavoritos()

  /**
   * Un toque corto al agregar, para sentir que entró sin mirar la barra.
   * Solo en Android: Safari no implementa la vibración y ahí no pasa nada.
   */
  const agregar = (id: string) => {
    try {
      navigator.vibrate?.(12)
    } catch {
      // Algunos navegadores la bloquean dentro de un iframe.
    }
    add(id)
  }

  const [category, setCategory] = useState<Category>(initialCategory)
  const listaRef = useRef<HTMLElement>(null)
  const [viendo, setViendo] = useState<string | null>(null)
  const cerrarFicha = useCallback(() => setViendo(null), [])
  const productoAbierto = viendo ? products.find((p) => p.id === viendo) : undefined

  /**
   * Al cambiar de categoría con la lista ya bajada, se vuelve a su comienzo.
   *
   * Si no, la grilla nueva -- casi siempre más corta -- quedaba arriba, fuera
   * de la vista, y lo que se veía era un hueco: parecía que la categoría estaba
   * vacía. Solo sube si hace falta; arriba de todo no mueve nada.
   */
  const elegirCategoria = (nueva: Category) => {
    setCategory(nueva)
    const lista = listaRef.current
    // "Bajada" es que el comienzo de la lista quedó detrás de la barra fija.
    const bordeBarra = document.querySelector("header")?.getBoundingClientRect().bottom ?? 0
    if (lista && lista.getBoundingClientRect().top < bordeBarra) {
      lista.scrollIntoView({ behavior: "smooth", block: "start" })
    }
  }
  const [query, setQuery] = useState(initialQuery)
  const [wholesaleOnly, setWholesaleOnly] = useState(initialWholesaleOnly)
  const [orden, setOrden] = useState<Orden>("recomendado")

  const conProductos = useMemo(() => new Set(products.map((p) => p.category)), [products])

  const visibleProducts = useMemo(() => {
    const term = query.trim()
    return products
      .filter((p) => {
        if (category !== "Todos" && p.category !== category) return false
        if (wholesaleOnly && !p.wholesale) return false
        // Sin acentos: en el teléfono nadie escribe "café".
        if (term && !contieneTexto(p.name, term)) return false
        return true
      })
      .sort((a, b) => {
        // Lo agotado al final siempre, ordene como ordene: sigue a la vista,
        // pero no le estorba a lo que sí se puede comprar hoy.
        const existencia = Number(b.in_stock) - Number(a.in_stock)
        if (existencia !== 0) return existencia
        if (orden === "barato") return a.price - b.price
        if (orden === "caro") return b.price - a.price
        if (orden === "nombre") return a.name.localeCompare(b.name, "es")
        return 0
      })
  }, [products, category, query, wholesaleOnly, orden])

  const sinResultados =
    query.trim().length > 0
      ? `No encontramos productos con "${query.trim()}".`
      : wholesaleOnly
        ? "No hay productos al mayor aquí."
        : category === "Todos"
          ? `${storeName} todavía no cargó productos.`
          : `Todavía no hay productos en ${category}.`

  return (
    <div className="min-h-dvh bg-gray-50 pb-28">
      <CambiarAbasto storeId={storeId} storeName={storeName} />
      <StoreHero
        id={storeId}
        name={storeName}
        image={storeImage}
        tag={storeTag}
        eta={storeEta}
        deliveryFee={deliveryFee}
        tasaVes={tasaVes}
      />
      <CatalogHeader
        storeName={storeName}
        conProductos={conProductos}
        active={category}
        onCategoryChange={elegirCategoria}
        query={query}
        onQueryChange={setQuery}
      />

      {/* El margen de arriba es lo que tapa la barra fija, para que al subir
          el título no quede debajo de ella. */}
      <main
        ref={listaRef}
        className="mx-auto max-w-3xl scroll-mt-[calc(env(safe-area-inset-top)+7.5rem)] px-4 py-4"
      >
        <div className="mb-3 flex items-baseline justify-between gap-3">
          <h2 className="text-lg font-bold text-gray-900">
            {category === "Todos" ? "Catálogo" : category}
          </h2>
          <p className="shrink-0 text-sm text-gray-500">
            {visibleProducts.length} {visibleProducts.length === 1 ? "producto" : "productos"}
          </p>
        </div>

        <div className="mb-4 flex items-center justify-between gap-2">
          <button
            type="button"
            onClick={() => setWholesaleOnly((v) => !v)}
            aria-pressed={wholesaleOnly}
            className={`min-h-11 rounded-full px-4 py-1.5 text-sm font-medium transition ${
              wholesaleOnly
                ? "bg-emerald-600 text-white"
                : "border border-gray-200 bg-white text-gray-600 active:bg-gray-100"
            }`}
          >
            Solo al mayor
          </button>

          {/* Un select nativo y no un menú propio: en el teléfono abre la rueda
              del sistema, que todo el mundo sabe usar y no pesa nada. */}
          <label className="relative flex min-h-11 items-center">
            <span className="sr-only">Ordenar productos</span>
            <select
              value={orden}
              onChange={(event) => setOrden(event.target.value as Orden)}
              className="min-h-11 appearance-none rounded-full border border-gray-200 bg-white py-1.5 pl-4 pr-9 text-sm font-medium text-gray-700 outline-none focus:border-emerald-500"
            >
              <option value="recomendado">Recomendado</option>
              <option value="barato">Menor precio</option>
              <option value="caro">Mayor precio</option>
              <option value="nombre">De la A a la Z</option>
            </select>
            <ChevronDown
              className="pointer-events-none absolute right-3 h-4 w-4 text-gray-500"
              aria-hidden="true"
            />
          </label>
        </div>

        {visibleProducts.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-gray-200 bg-white px-4 py-10 text-center">
            <p className="text-sm text-gray-500">{sinResultados}</p>
            {/* Lo que uno haría después de no encontrarlo aquí: ver si otro
                abasto lo tiene. Sin esto había que salir, ir a Explorar y volver
                a escribir lo mismo. */}
            {query.trim().length >= 2 && (
              <Link
                href={`/buscar?q=${encodeURIComponent(query.trim())}`}
                className="mx-auto mt-4 flex min-h-11 w-fit items-center gap-2 rounded-full bg-emerald-600 px-5 text-sm font-semibold text-white transition active:scale-95"
              >
                <Search className="h-4 w-4" aria-hidden="true" />
                Buscarlo en todos los abastos
              </Link>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
            {visibleProducts.map((product) => (
              <ProductCard
                key={product.id}
                product={product}
                quantity={quantities[product.id] ?? 0}
                onAdd={agregar}
                onRemove={removeOne}
                esFavorito={favoritos.ids.has(product.id)}
                onFavorito={favoritos.haySesion ? favoritos.alternar : undefined}
                onVer={setViendo}
                tasaVes={tasaVes}
              />
            ))}
          </div>
        )}
      </main>

      <CartBar count={count} total={subtotal} tasaVes={tasaVes} />

      {productoAbierto && (
        <FichaProducto
          product={productoAbierto}
          quantity={quantities[productoAbierto.id] ?? 0}
          tasaVes={tasaVes}
          onAdd={agregar}
          onRemove={removeOne}
          onClose={cerrarFicha}
        />
      )}
    </div>
  )
}
