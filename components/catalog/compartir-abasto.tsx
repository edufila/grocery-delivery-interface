"use client"

import { useState } from "react"
import { Check, Share2 } from "lucide-react"

/**
 * Compartir el abasto con el menú del teléfono.
 *
 * Así es como se va a mover la app al principio: alguien le pasa a otro el
 * link de su abasto por WhatsApp. Con el menú nativo eso son dos toques, y la
 * vista previa ya sale con el nombre y la foto del local.
 *
 * Donde no hay menú para compartir -- casi todas las computadoras -- copia el
 * enlace y lo dice.
 */
export function CompartirAbasto({ storeId, storeName }: { storeId: string; storeName: string }) {
  const [copiado, setCopiado] = useState(false)

  async function compartir() {
    const url = `${window.location.origin}/catalogo?tienda=${encodeURIComponent(storeId)}`

    if (navigator.share) {
      try {
        await navigator.share({ title: storeName, text: `Haz tu mercado en ${storeName}`, url })
      } catch {
        // Cerró el menú sin elegir nada: no es un error.
      }
      return
    }

    try {
      await navigator.clipboard.writeText(url)
      setCopiado(true)
      window.setTimeout(() => setCopiado(false), 2000)
    } catch {
      // Sin portapapeles no hay nada más que hacer.
    }
  }

  return (
    <button
      type="button"
      onClick={() => void compartir()}
      className="flex h-11 items-center gap-1.5 rounded-full bg-white/90 px-3.5 text-sm font-semibold text-gray-900 shadow-sm backdrop-blur transition active:scale-95"
      aria-label={copiado ? "Enlace copiado" : `Compartir ${storeName}`}
    >
      {copiado ? (
        <Check className="h-4 w-4 text-emerald-600" aria-hidden="true" />
      ) : (
        <Share2 className="h-4 w-4" aria-hidden="true" />
      )}
      {copiado ? "Copiado" : "Compartir"}
    </button>
  )
}
