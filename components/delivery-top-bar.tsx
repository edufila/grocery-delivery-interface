"use client"

import Link from "next/link"
import { ChevronDown, MapPin } from "lucide-react"

export function DeliveryTopBar() {
  return (
    <header className="sticky top-0 z-30 border-b border-gray-100 bg-white/90 backdrop-blur-md">
      <div className="mx-auto flex max-w-md items-center justify-between px-4 py-3">
        <button
          type="button"
          className="flex min-w-0 items-center gap-2 text-left"
          aria-label="Cambiar dirección de entrega"
        >
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-emerald-50">
            <MapPin className="h-4 w-4 text-emerald-600" aria-hidden="true" />
          </span>
          <span className="min-w-0">
            <span className="block text-[11px] font-medium uppercase tracking-wide text-gray-400">
              Entregar en
            </span>
            <span className="flex items-center gap-1 text-sm font-semibold text-gray-900">
              <span className="truncate">Av. Las Delicias, Urb. El Bosque</span>
              <ChevronDown className="h-4 w-4 shrink-0 text-gray-500" aria-hidden="true" />
            </span>
          </span>
        </button>
        <Link
          href="/perfil"
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-gray-100 text-sm font-semibold text-gray-700"
          aria-label="Perfil"
        >
          JD
        </Link>
      </div>
    </header>
  )
}
