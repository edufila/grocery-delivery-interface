"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { RotateCcw } from "lucide-react"

import { useCart } from "@/lib/cart"

/**
 * Vuelve a armar el carrito con lo de un pedido anterior.
 *
 * En un abasto la compra se repite casi igual todas las semanas: harina, arroz,
 * café. Tener que buscar los mismos ocho productos uno por uno es la diferencia
 * entre volver a pedir y no hacerlo.
 *
 * No comprueba aquí si los productos siguen existiendo: se cargan al carrito y
 * el checkout ya avisa por su cuenta de lo que el abasto haya quitado. Un solo
 * lugar donde se dice eso, y siempre el mismo.
 */
export function RepetirPedido({
  items,
}: {
  items: { product_id: string; qty: number }[]
}) {
  const router = useRouter()
  const { count, reemplazar } = useCart()
  const [confirmando, setConfirmando] = useState(false)

  function repetir() {
    const cantidades: Record<string, number> = {}
    for (const item of items) {
      // Un mismo producto puede venir en dos renglones; se suman.
      cantidades[item.product_id] = (cantidades[item.product_id] ?? 0) + item.qty
    }
    reemplazar(cantidades)
    router.push("/checkout")
  }

  if (items.length === 0) return null

  return (
    <>
      <button
        type="button"
        onClick={() => (count > 0 ? setConfirmando(true) : repetir())}
        className="flex h-12 w-full items-center justify-center gap-2 rounded-2xl border border-emerald-200 bg-emerald-50 text-sm font-semibold text-emerald-700 active:bg-emerald-100"
      >
        <RotateCcw className="h-4 w-4" aria-hidden="true" />
        Volver a pedir lo mismo
      </button>

      {confirmando && (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center"
          role="dialog"
          aria-modal="true"
          aria-label="Reemplazar el carrito"
        >
          <button
            type="button"
            className="absolute inset-0 bg-black/40"
            onClick={() => setConfirmando(false)}
            aria-label="Cerrar"
          />

          <div className="relative w-full max-w-lg rounded-t-3xl bg-white px-5 pb-[calc(env(safe-area-inset-bottom)+1.25rem)] pt-6">
            <h2 className="text-center text-lg font-semibold text-gray-900">
              Ya tienes un carrito armado
            </h2>
            <p className="mt-2 text-center text-sm leading-relaxed text-gray-500">
              {count === 1 ? "Tiene 1 producto" : `Tiene ${count} productos`}. Si repites este
              pedido, se reemplaza por lo de aquel.
            </p>

            <div className="mt-6 flex flex-col gap-2">
              <button
                type="button"
                onClick={repetir}
                className="flex h-12 w-full items-center justify-center rounded-2xl bg-emerald-600 text-sm font-semibold text-white"
              >
                Reemplazarlo
              </button>
              <button
                type="button"
                onClick={() => setConfirmando(false)}
                className="flex h-12 w-full items-center justify-center rounded-2xl border border-gray-200 text-sm font-semibold text-gray-700 active:bg-gray-50"
              >
                Dejar mi carrito como está
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
