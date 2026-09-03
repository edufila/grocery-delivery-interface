"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { Search, X } from "lucide-react"

import { BackButton } from "@/components/back-button"

/**
 * El campo de la pantalla de búsqueda. Escribe en la dirección, no en un
 * estado suelto: así el resultado se puede compartir, y el botón de atrás del
 * teléfono vuelve a la búsqueda anterior en vez de salirse de la pantalla.
 */
export function Buscador({ valorInicial }: { valorInicial: string }) {
  const router = useRouter()
  const [texto, setTexto] = useState(valorInicial)

  // Si se llega con otra búsqueda desde el historial, el campo la refleja.
  useEffect(() => {
    setTexto(valorInicial)
  }, [valorInicial])

  /**
   * Espera a que deje de escribir. Sin esto cada letra sería una consulta a la
   * base y un renglón en el historial del navegador.
   */
  useEffect(() => {
    if (texto.trim() === valorInicial) return

    const id = setTimeout(() => {
      const limpio = texto.trim()
      router.replace(limpio ? `/buscar?q=${encodeURIComponent(limpio)}` : "/buscar")
    }, 350)

    return () => clearTimeout(id)
  }, [texto, valorInicial, router])

  return (
    <div className="flex items-center gap-1">
      <BackButton fallback="/" label="Volver" />

      <label className="relative min-w-0 flex-1">
        <span className="sr-only">Buscar productos en todos los abastos</span>
        <Search
          className="pointer-events-none absolute left-3.5 top-1/2 h-5 w-5 -translate-y-1/2 text-gray-400"
          aria-hidden="true"
        />
        <input
          type="search"
          value={texto}
          onChange={(event) => setTexto(event.target.value)}
          // autoFocus: se llega aquí con la intención de escribir.
          autoFocus={valorInicial.length === 0}
          enterKeyHint="search"
          placeholder="Buscar en todos los abastos..."
          className="h-12 w-full rounded-2xl border border-gray-200 bg-gray-50 pl-11 pr-10 text-base text-gray-900 outline-none transition placeholder:text-gray-400 focus:border-emerald-500 focus:bg-white"
        />
        {texto.length > 0 && (
          <button
            type="button"
            onClick={() => setTexto("")}
            aria-label="Borrar la búsqueda"
            className="absolute right-1 top-1/2 flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full text-gray-400 active:bg-gray-100"
          >
            <X className="h-4 w-4" aria-hidden="true" />
          </button>
        )}
      </label>
    </div>
  )
}
