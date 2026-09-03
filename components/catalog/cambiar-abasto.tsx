"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { ShoppingCart, Trash2 } from "lucide-react"

import { useCart } from "@/lib/cart"
import { createClient } from "@/lib/supabase/client"
import { isSupabaseConfigured } from "@/lib/supabase/config"

/**
 * Ataja al cliente que entra a un abasto teniendo un carrito de otro.
 *
 * Un pedido es de un solo abasto: el shopper hace un recorrido, y la base
 * rechaza los pedidos mezclados. Sin este aviso, el cliente podía armar un
 * carrito de los dos y enterarse recién al tocar "Confirmar pedido", con un
 * error y sin saber qué quitar.
 *
 * Se pregunta al entrar, que es cuando todavía no perdió nada: o vacía lo que
 * tenía, o se vuelve a su abasto con el carrito intacto.
 */
export function CambiarAbasto({ storeId, storeName }: { storeId: string; storeName: string }) {
  const { storeIds, count, ready, clear } = useCart()
  const [nombreAnterior, setNombreAnterior] = useState<string | null>(null)

  // El carrito guarda ids; el nombre del otro abasto hay que ir a buscarlo.
  const otro = storeIds.find((id) => id !== storeId) ?? null
  const hayOtro = ready && count > 0 && otro !== null && !storeIds.includes(storeId)

  useEffect(() => {
    if (!hayOtro || !otro || !isSupabaseConfigured) return
    let cancelado = false

    void (async () => {
      const { data } = await createClient()
        .from("stores")
        .select("name")
        .eq("id", otro)
        .maybeSingle<{ name: string }>()
      if (!cancelado) setNombreAnterior(data?.name ?? null)
    })()

    return () => {
      cancelado = true
    }
  }, [hayOtro, otro])

  // Con la hoja abierta el fondo no debe scrollear.
  useEffect(() => {
    if (!hayOtro) return
    const antes = document.body.style.overflow
    document.body.style.overflow = "hidden"
    return () => {
      document.body.style.overflow = antes
    }
  }, [hayOtro])

  if (!hayOtro) return null

  const anterior = nombreAnterior ?? "el otro abasto"

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center"
      role="dialog"
      aria-modal="true"
      aria-label="Ya tienes un carrito de otro abasto"
    >
      {/* Sin botón de cerrar ni toque afuera: hay que elegir una de las dos,
          porque cualquier producto que agregue aquí rompería el pedido. */}
      <div className="absolute inset-0 bg-black/50" />

      <div className="relative w-full max-w-lg rounded-t-3xl bg-white px-5 pb-[calc(env(safe-area-inset-bottom)+1.25rem)] pt-6">
        <span className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-amber-50">
          <ShoppingCart className="h-6 w-6 text-amber-600" aria-hidden="true" />
        </span>

        <h2 className="mt-4 text-center text-lg font-semibold text-gray-900">
          Ya tienes un carrito de {anterior}
        </h2>
        <p className="mt-2 text-center text-sm leading-relaxed text-gray-500">
          Cada pedido es de un solo abasto, porque el shopper hace un recorrido.
          {count === 1 ? " Tienes 1 producto" : ` Tienes ${count} productos`} esperando allá.
        </p>

        <div className="mt-6 flex flex-col gap-2">
          <Link
            href={`/catalogo?tienda=${otro}`}
            className="flex h-12 w-full items-center justify-center rounded-2xl bg-emerald-600 text-sm font-semibold text-white"
          >
            Seguir comprando en {anterior}
          </Link>

          <button
            type="button"
            onClick={clear}
            className="flex h-12 w-full items-center justify-center gap-2 rounded-2xl border border-gray-200 text-sm font-semibold text-gray-700 active:bg-gray-50"
          >
            <Trash2 className="h-4 w-4" aria-hidden="true" />
            Vaciarlo y comprar en {storeName}
          </button>
        </div>
      </div>
    </div>
  )
}
