"use client"

import Link from "next/link"
import { ArrowLeft, Search, X } from "lucide-react"

import { categories, type Category } from "@/lib/categories"

type Props = {
  storeName: string
  active: Category
  onCategoryChange: (category: Category) => void
  query: string
  onQueryChange: (query: string) => void
}

/**
 * La barra que queda fija mientras se compra: volver, buscar y categorías.
 *
 * El buscador está siempre a la vista. Antes era una lupa que había que tocar
 * para que apareciera el campo, y buscar es lo que más se hace en un catálogo:
 * un toque de más en lo más usado. El texto de ejemplo dice en qué abasto se
 * busca, que es lo que se pierde de vista cuando la portada ya se fue.
 *
 * Se pega debajo de la barra de estado del teléfono y no en el borde: la
 * portada de arriba ya se come ese margen, y si esta lo repitiera quedaría un
 * hueco blanco entre las dos.
 */
export function CatalogHeader({ storeName, active, onCategoryChange, query, onQueryChange }: Props) {
  return (
    <>
      {/* Tapa la franja de la hora y la señal cuando el catálogo pasa por
          debajo. En un teléfono sin muesca mide cero. */}
      <div
        className="fixed inset-x-0 top-0 z-40 h-[env(safe-area-inset-top)] bg-white"
        aria-hidden="true"
      />

      <header className="sticky top-[env(safe-area-inset-top)] z-30 border-b border-gray-100 bg-white/95 backdrop-blur-md">
        <div className="mx-auto flex max-w-3xl items-center gap-1 px-2 py-2.5">
          <Link
            href="/"
            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-gray-600 transition active:bg-gray-100"
            aria-label="Volver al inicio"
          >
            <ArrowLeft className="h-5 w-5" aria-hidden="true" />
          </Link>

          <label className="relative mr-2 flex-1">
            <span className="sr-only">Buscar en {storeName}</span>
            <Search
              className="pointer-events-none absolute left-3.5 top-1/2 h-5 w-5 -translate-y-1/2 text-gray-400"
              aria-hidden="true"
            />
            <input
              type="search"
              value={query}
              onChange={(event) => onQueryChange(event.target.value)}
              placeholder={`Buscar en ${storeName}`}
              enterKeyHint="search"
              className="h-11 w-full rounded-2xl border border-gray-200 bg-gray-50 pl-11 pr-11 text-base text-gray-900 outline-none transition placeholder:text-gray-500 focus:border-emerald-500 focus:bg-white focus:ring-2 focus:ring-emerald-100 [&::-webkit-search-cancel-button]:hidden"
            />
            {query && (
              <button
                type="button"
                onClick={() => onQueryChange("")}
                className="absolute right-0 top-0 flex h-11 w-11 items-center justify-center rounded-full text-gray-500 active:text-gray-900"
                aria-label="Borrar búsqueda"
              >
                <X className="h-5 w-5" aria-hidden="true" />
              </button>
            )}
          </label>
        </div>

        <nav aria-label="Categorías">
          <ul className="mx-auto flex max-w-3xl gap-2 overflow-x-auto px-4 pb-2.5 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            {categories.map((cat) => {
              const isActive = active === cat
              return (
                <li key={cat}>
                  <button
                    type="button"
                    onClick={() => onCategoryChange(cat)}
                    aria-current={isActive ? "true" : undefined}
                    className={`min-h-11 whitespace-nowrap rounded-full px-4 py-1.5 text-sm font-medium transition active:scale-95 ${
                      isActive
                        ? "bg-emerald-600 text-white shadow-sm shadow-emerald-900/20"
                        : "bg-gray-100 text-gray-700 active:bg-gray-200"
                    }`}
                  >
                    {cat}
                  </button>
                </li>
              )
            })}
          </ul>
        </nav>
      </header>
    </>
  )
}
