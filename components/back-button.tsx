"use client"

import { useRouter } from "next/navigation"
import { ArrowLeft } from "lucide-react"

/**
 * Vuelve a donde estabas, no a un destino fijo: al checkout se puede llegar
 * desde el catálogo o desde el inicio, y mandar siempre al catálogo desorienta.
 * Si no hay historial —entraste con el link pegado— cae al destino de respaldo.
 */
export function BackButton({ fallback, label }: { fallback: string; label: string }) {
  const router = useRouter()

  return (
    <button
      type="button"
      onClick={() => {
        if (window.history.length > 1) router.back()
        else router.push(fallback)
      }}
      aria-label={label}
      className="-ml-2 flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-gray-600 transition active:bg-gray-100"
    >
      <ArrowLeft className="h-5 w-5" aria-hidden="true" />
    </button>
  )
}
