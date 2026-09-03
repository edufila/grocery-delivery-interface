"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Search, SlidersHorizontal } from "lucide-react"

export function SearchBar() {
  const router = useRouter()
  const [query, setQuery] = useState("")

  return (
    <div className="mx-auto max-w-md px-4 pb-2 pt-3">
      <form
        className="flex items-center gap-2"
        onSubmit={(event) => {
          event.preventDefault()
          const term = query.trim()
          router.push(term ? `/catalogo?q=${encodeURIComponent(term)}` : "/catalogo")
        }}
      >
        <label className="relative flex-1">
          <span className="sr-only">Buscar productos</span>
          <Search
            className="pointer-events-none absolute left-3.5 top-1/2 h-5 w-5 -translate-y-1/2 text-gray-400"
            aria-hidden="true"
          />
          <input
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            enterKeyHint="search"
            placeholder="Buscar productos..."
            className="w-full rounded-2xl border border-gray-200 bg-gray-50 py-3 pl-11 pr-4 text-base text-gray-900 placeholder:text-gray-400 outline-none transition focus:border-emerald-500 focus:bg-white focus:ring-2 focus:ring-emerald-100"
          />
        </label>
        <button
          type="button"
          onClick={() => router.push("/catalogo?mayorista=1")}
          className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-emerald-600 text-white transition active:scale-95"
          aria-label="Ver solo productos al mayor"
        >
          <SlidersHorizontal className="h-5 w-5" aria-hidden="true" />
        </button>
      </form>
    </div>
  )
}
