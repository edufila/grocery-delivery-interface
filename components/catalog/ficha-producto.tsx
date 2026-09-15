"use client"

import { Minus, Plus, X } from "lucide-react"

import { bsEquivalent, formatBolivares } from "@/lib/pagos"
import type { Product } from "@/lib/products"
import { precioPorUnidad } from "@/lib/unidades"
import { fotoLigera } from "@/lib/fotos"
import { useHoja } from "@/lib/usar-hoja"

/**
 * El producto en grande, al tocar su foto.
 *
 * En la tarjeta la foto mide lo que cabe en media pantalla, y el nombre se
 * corta en dos renglones. Para decidir entre dos harinas parecidas hay que ver
 * el empaque, y tocar la foto era lo natural: antes no hacía nada.
 *
 * Una hoja que sube desde abajo, como las demás de la app, con los mismos
 * botones de cantidad: se puede agregar desde aquí sin volver a buscar la
 * tarjeta.
 */
export function FichaProducto({
  product,
  quantity,
  tasaVes,
  onAdd,
  onRemove,
  onClose,
}: {
  product: Product
  quantity: number
  tasaVes?: number | null
  onAdd: (id: string) => void
  onRemove: (id: string) => void
  onClose: () => void
}) {
  const bs = bsEquivalent(product.price, tasaVes ?? null)
  const agotado = !product.in_stock
  // Foco dentro, Escape cierra, fondo quieto: ver lib/usar-hoja.ts.
  const hojaRef = useHoja<HTMLDivElement>(true, onClose)


  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center"
      role="dialog"
      aria-modal="true"
      aria-label={product.name}
    >
      <button
        type="button"
        className="absolute inset-0 animate-[aparece_0.2s_ease-out] bg-black/50"
        onClick={onClose}
        aria-label="Cerrar"
      />

      <div ref={hojaRef} className="relative w-full max-w-lg animate-[sube-hoja_0.28s_cubic-bezier(0.2,0.9,0.3,1)] overflow-hidden rounded-t-3xl bg-white pb-[calc(env(safe-area-inset-bottom)+1rem)]">
        <div className="relative mx-auto aspect-square max-h-[55dvh] w-full bg-gray-50">
          <img
            src={fotoLigera(product.image) || "/placeholder.svg"}
            alt={product.name}
            className={`h-full w-full object-cover ${agotado ? "opacity-50 grayscale" : ""}`}
          />
          <button
            type="button"
            onClick={onClose}
            className="absolute right-3 top-3 flex h-11 w-11 items-center justify-center rounded-full bg-white/90 text-gray-700 shadow-sm backdrop-blur"
            aria-label="Cerrar"
          >
            <X className="h-5 w-5" aria-hidden="true" />
          </button>
          {product.wholesale && !agotado && (
            <span className="absolute left-3 top-3 rounded-full bg-emerald-100 px-2.5 py-1 text-xs font-semibold text-emerald-800">
              Mayorista
            </span>
          )}
        </div>

        <div className="px-5 pt-4">
          <p className="text-xs font-medium uppercase tracking-wide text-gray-500">
            {product.category}
          </p>
          <h2 className="mt-0.5 text-xl font-bold leading-tight text-gray-900">{product.name}</h2>
          <p className="mt-0.5 text-sm text-gray-500">
            {product.unit}
            {precioPorUnidad(product.price, product.unit) != null && (
              <span className="font-semibold text-emerald-800">
                {" · "}${precioPorUnidad(product.price, product.unit)!.toFixed(2)} c/u
              </span>
            )}
          </p>

          <div className="mt-4 flex items-end justify-between gap-3">
            <p>
              <span className="block text-2xl font-bold tabular-nums text-gray-900">
                ${product.price.toFixed(2)}
              </span>
              {bs != null && (
                <span className="block text-sm font-medium tabular-nums text-gray-500">
                  Bs {formatBolivares(bs)}
                </span>
              )}
            </p>

            {agotado ? (
              <span className="rounded-full bg-gray-100 px-4 py-2 text-sm font-semibold text-gray-600">
                Sin existencia
              </span>
            ) : quantity > 0 ? (
              <div className="flex items-center gap-2 rounded-full bg-emerald-600 p-1 text-white">
                <button
                  type="button"
                  onClick={() => onRemove(product.id)}
                  className="flex h-11 w-11 items-center justify-center rounded-full transition hover:bg-emerald-700 active:scale-90"
                  aria-label={`Quitar una unidad de ${product.name}`}
                >
                  <Minus className="h-5 w-5" aria-hidden="true" />
                </button>
                <span
                  className="min-w-6 overflow-hidden text-center text-lg font-bold tabular-nums"
                  aria-live="polite"
                >
                  <span key={quantity} className="block animate-[sube-numero_0.2s_ease-out]">
                    {quantity}
                  </span>
                </span>
                <button
                  type="button"
                  onClick={() => onAdd(product.id)}
                  className="flex h-11 w-11 items-center justify-center rounded-full transition hover:bg-emerald-700 active:scale-90"
                  aria-label={`Agregar otra unidad de ${product.name}`}
                >
                  <Plus className="h-5 w-5" aria-hidden="true" />
                </button>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => onAdd(product.id)}
                className="flex h-12 items-center gap-2 rounded-full bg-emerald-600 px-6 text-sm font-semibold text-white shadow-md shadow-emerald-900/15 transition active:scale-95"
              >
                <Plus className="h-5 w-5" aria-hidden="true" />
                Agregar
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
