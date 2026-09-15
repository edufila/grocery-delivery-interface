"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { History, Search, X } from "lucide-react"

import { BackButton } from "@/components/back-button"

const RECIENTES = "abasto-busquedas"
const MAX_RECIENTES = 6

function leerRecientes(): string[] {
  try {
    const guardado = JSON.parse(localStorage.getItem(RECIENTES) ?? "[]")
    return Array.isArray(guardado)
      ? guardado.filter((t) => typeof t === "string").slice(0, MAX_RECIENTES)
      : []
  } catch {
    return []
  }
}

/**
 * El campo de la pantalla de búsqueda. Escribe en la dirección, no en un
 * estado suelto: así el resultado se puede compartir, y el botón de atrás del
 * teléfono vuelve a la búsqueda anterior en vez de salirse de la pantalla.
 */
export function Buscador({
  valorInicial,
  categoria,
  mayorista,
}: {
  valorInicial: string
  /** Se conserva al escribir: filtrar por texto no debe borrar la categoría. */
  categoria: string
  mayorista: boolean
}) {
  const router = useRouter()
  const [texto, setTexto] = useState(valorInicial)
  const [recientes, setRecientes] = useState<string[]>([])

  /**
   * Las últimas búsquedas, guardadas en el teléfono.
   *
   * Lo que se busca en un abasto se repite: harina, arroz, café. Se guarda la
   * búsqueda que de verdad llegó a la dirección -- la que dejó de escribir --,
   * no cada letra. Solo en este teléfono: no hace falta cuenta ni sale de aquí.
   */
  useEffect(() => {
    const actuales = leerRecientes()
    const termino = valorInicial.trim()
    if (termino.length < 2) {
      setRecientes(actuales)
      return
    }
    const siguientes = [
      termino,
      ...actuales.filter((t) => t.toLowerCase() !== termino.toLowerCase()),
    ].slice(0, MAX_RECIENTES)
    setRecientes(siguientes)
    try {
      localStorage.setItem(RECIENTES, JSON.stringify(siguientes))
    } catch {
      // Sin storage no hay recientes; la búsqueda funciona igual.
    }
  }, [valorInicial])

  function olvidarRecientes() {
    setRecientes([])
    try {
      localStorage.removeItem(RECIENTES)
    } catch {
      // Nada que hacer.
    }
  }

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
      const partes: string[] = []
      if (limpio) partes.push(`q=${encodeURIComponent(limpio)}`)
      if (categoria && categoria !== "Todos")
        partes.push(`categoria=${encodeURIComponent(categoria)}`)
      if (mayorista) partes.push("mayorista=1")
      router.replace(partes.length ? `/buscar?${partes.join("&")}` : "/buscar")
    }, 350)

    return () => clearTimeout(id)
  }, [texto, valorInicial, categoria, mayorista, router])

  return (
    <>
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
            className="h-12 w-full rounded-2xl border border-gray-200 bg-gray-50 pl-11 pr-10 text-base text-gray-900 outline-none transition placeholder:text-gray-500 focus:border-emerald-500 focus:bg-white"
          />
          {texto.length > 0 && (
            <button
              type="button"
              onClick={() => setTexto("")}
              aria-label="Borrar la búsqueda"
              className="absolute right-0.5 top-1/2 flex h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full text-gray-500 active:bg-gray-100"
            >
              <X className="h-4 w-4" aria-hidden="true" />
            </button>
          )}
        </label>
      </div>

      {texto.trim().length === 0 && recientes.length > 0 && (
        <div className="mt-2 flex items-center gap-2 overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          <History className="h-4 w-4 shrink-0 text-gray-400" aria-hidden="true" />
          <span className="sr-only">Búsquedas recientes:</span>
          {recientes.map((termino) => (
            <button
              key={termino}
              type="button"
              onClick={() => setTexto(termino)}
              className="min-h-11 shrink-0 whitespace-nowrap rounded-full border border-gray-200 bg-white px-3.5 text-sm font-medium text-gray-700 active:bg-gray-100"
            >
              {termino}
            </button>
          ))}
          <button
            type="button"
            onClick={olvidarRecientes}
            className="min-h-11 shrink-0 whitespace-nowrap px-2 text-sm font-medium text-gray-500"
          >
            Borrar
          </button>
        </div>
      )}
    </>
  )
}
