"use client"

import { Plus, Minus } from "lucide-react"

export type Product = {
  id: string
  name: string
  unit: string
  price: number
  image: string
  wholesale?: boolean
}

type Props = {
  product: Product
  quantity: number
  onAdd: (id: string) => void
  onRemove: (id: string) => void
}

export function ProductCard({ product, quantity, onAdd, onRemove }: Props) {
  const inCart = quantity > 0

  return (
    <article className="relative flex flex-col overflow-hidden rounded-2xl border border-gray-100 bg-white shadow-sm shadow-gray-100 transition hover:shadow-md">
      <div className="relative aspect-square w-full bg-gray-50 p-3">
        <img
          src={product.image || "/placeholder.svg"}
          alt={product.name}
          className="h-full w-full object-contain"
        />
        {product.wholesale && (
          <span className="absolute left-2 top-2 rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-semibold text-emerald-700">
            Mayorista
          </span>
        )}
      </div>

      <div className="flex flex-1 flex-col p-3 pt-2">
        <h3 className="line-clamp-2 text-sm font-semibold text-gray-900">{product.name}</h3>
        <p className="mt-0.5 text-xs text-gray-500">{product.unit}</p>

        <div className="mt-auto flex items-end justify-between pt-3">
          <p className="text-xl font-bold text-gray-900">
            ${product.price.toFixed(2)}
          </p>

          {inCart ? (
            <div className="flex items-center gap-2 rounded-full bg-emerald-600 p-1 text-white shadow-sm">
              <button
                type="button"
                onClick={() => onRemove(product.id)}
                className="flex h-7 w-7 items-center justify-center rounded-full transition hover:bg-emerald-700 active:scale-90"
                aria-label={`Quitar una unidad de ${product.name}`}
              >
                <Minus className="h-4 w-4" aria-hidden="true" />
              </button>
              <span
                className="min-w-4 text-center text-sm font-bold tabular-nums"
                aria-live="polite"
              >
                {quantity}
              </span>
              <button
                type="button"
                onClick={() => onAdd(product.id)}
                className="flex h-7 w-7 items-center justify-center rounded-full transition hover:bg-emerald-700 active:scale-90"
                aria-label={`Agregar otra unidad de ${product.name}`}
              >
                <Plus className="h-4 w-4" aria-hidden="true" />
              </button>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => onAdd(product.id)}
              className="flex h-9 w-9 items-center justify-center rounded-full bg-emerald-600 text-white shadow-sm transition hover:bg-emerald-700 active:scale-90"
              aria-label={`Agregar ${product.name} al carrito`}
            >
              <Plus className="h-5 w-5" aria-hidden="true" />
            </button>
          )}
        </div>
      </div>
    </article>
  )
}
