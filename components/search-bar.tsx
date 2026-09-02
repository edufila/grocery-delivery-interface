"use client"

import { Search, SlidersHorizontal } from "lucide-react"

export function SearchBar() {
  return (
    <div className="mx-auto max-w-md px-4 pb-2 pt-3">
      <div className="flex items-center gap-2">
        <label className="relative flex-1">
          <span className="sr-only">Buscar productos</span>
          <Search
            className="pointer-events-none absolute left-3.5 top-1/2 h-5 w-5 -translate-y-1/2 text-gray-400"
            aria-hidden="true"
          />
          <input
            type="search"
            placeholder="Buscar en Gran Abasto Girasol..."
            className="w-full rounded-2xl border border-gray-200 bg-gray-50 py-3 pl-11 pr-4 text-sm text-gray-900 placeholder:text-gray-400 outline-none transition focus:border-emerald-500 focus:bg-white focus:ring-2 focus:ring-emerald-100"
          />
        </label>
        <button
          type="button"
          className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-emerald-600 text-white transition hover:bg-emerald-700"
          aria-label="Filtros"
        >
          <SlidersHorizontal className="h-5 w-5" aria-hidden="true" />
        </button>
      </div>
    </div>
  )
}
