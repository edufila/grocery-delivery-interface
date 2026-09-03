"use client"

import Link from "next/link"
import { ArrowLeft, Search, Leaf, Sparkles } from "lucide-react"

export const categories = [
  "Todos",
  "Granos",
  "Aceites",
  "Harinas",
  "Bebidas",
  "Lácteos",
  "Limpieza",
  "Enlatados",
] as const

export type Category = (typeof categories)[number]

type Props = {
  active: Category
  onCategoryChange: (category: Category) => void
}

export function CatalogHeader({ active, onCategoryChange }: Props) {
  return (
    <header className="sticky top-0 z-30 bg-white/95 backdrop-blur-md">
      {/* Offer banner */}
      <div className="bg-emerald-600 px-4 py-2 text-center text-sm font-medium text-white">
        <span className="inline-flex items-center gap-1.5">
          <Sparkles className="h-4 w-4" aria-hidden="true" />
          Ahorra hasta 30% comprando al mayor
        </span>
      </div>

      {/* Logo row */}
      <div className="mx-auto flex max-w-3xl items-center gap-3 px-4 py-3">
        <Link
          href="/"
          className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-gray-600 transition active:bg-gray-100"
          aria-label="Volver al inicio"
        >
          <ArrowLeft className="h-5 w-5" aria-hidden="true" />
        </Link>

        <div className="flex flex-1 items-center gap-2.5">
          <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-emerald-100 text-emerald-600">
            <Leaf className="h-5 w-5" aria-hidden="true" />
          </span>
          <div className="leading-tight">
            <p className="text-base font-bold text-gray-900">Gran Abasto Girasol</p>
            <p className="text-xs font-medium text-emerald-600">Ahorro Mayorista</p>
          </div>
        </div>

        <button
          type="button"
          className="flex h-9 w-9 items-center justify-center rounded-full text-gray-600 transition hover:bg-gray-100"
          aria-label="Buscar productos"
        >
          <Search className="h-5 w-5" aria-hidden="true" />
        </button>
      </div>

      {/* Category tabs */}
      <nav aria-label="Categorías" className="border-b border-gray-100">
        <ul className="mx-auto flex max-w-3xl gap-2 overflow-x-auto px-4 pb-3 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {categories.map((cat) => {
            const isActive = active === cat
            return (
              <li key={cat}>
                <button
                  type="button"
                  onClick={() => onCategoryChange(cat)}
                  aria-current={isActive ? "true" : undefined}
                  className={`min-h-9 whitespace-nowrap rounded-full px-4 py-1.5 text-sm font-medium transition ${
                    isActive
                      ? "bg-emerald-600 text-white"
                      : "bg-gray-100 text-gray-600 active:bg-gray-200"
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
  )
}
