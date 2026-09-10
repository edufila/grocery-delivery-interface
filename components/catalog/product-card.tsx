"use client"

import { Plus, Minus, Star } from "lucide-react"

import { bsEquivalent, formatBolivares } from "@/lib/pagos"
import type { Product } from "@/lib/products"

type Props = {
  product: Product
  quantity: number
  onAdd: (id: string) => void
  onRemove: (id: string) => void
  /** Sin sesión no se ofrece: no habría dónde guardarlo. */
  esFavorito?: boolean
  onFavorito?: (id: string) => void
  /** Sin tasa cargada no se muestra la referencia en bolívares. */
  tasaVes?: number | null
}

export function ProductCard({
  product,
  quantity,
  onAdd,
  onRemove,
  esFavorito,
  onFavorito,
  tasaVes,
}: Props) {
  const bs = bsEquivalent(product.price, tasaVes ?? null)
  const inCart = quantity > 0
  // Agotado no es lo mismo que quitado: sigue en la grilla, apagado, para que
  // se sepa que el abasto lo vende y valga la pena volver.
  const agotado = !product.in_stock

  return (
    <article className="relative flex flex-col overflow-hidden rounded-2xl border border-gray-100 bg-white shadow-sm shadow-gray-100 transition hover:shadow-md">
      <div className="relative aspect-square w-full bg-gray-50 p-3">
        <img
          src={product.image || "/placeholder.svg"}
          alt={product.name}
          className={`h-full w-full object-contain ${agotado ? "opacity-40 grayscale" : ""}`}
        />
        {agotado ? (
          <span className="absolute left-2 top-2 rounded-full bg-gray-900/80 px-2 py-0.5 text-[10px] font-semibold text-white">
            Agotado
          </span>
        ) : (
          product.wholesale && (
            <span className="absolute left-2 top-2 rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-semibold text-emerald-700">
              Mayorista
            </span>
          )
        )}

        {/* La estrella también en lo agotado: marcar lo que uno compra siempre
            sirve justo cuando no hay, para volver cuando reponen. */}
        {onFavorito && (
          <button
            type="button"
            onClick={() => onFavorito(product.id)}
            aria-pressed={esFavorito}
            aria-label={
              esFavorito
                ? `Quitar ${product.name} de mis habituales`
                : `Guardar ${product.name} en mis habituales`
            }
            className="absolute right-0 top-0 flex h-11 w-11 items-center justify-center rounded-full text-gray-400 transition active:scale-90"
          >
            <Star
              className={`h-5 w-5 transition ${
                esFavorito ? "fill-amber-400 text-amber-500" : ""
              }`}
              aria-hidden="true"
            />
          </button>
        )}
      </div>

      <div className="flex flex-1 flex-col p-3 pt-2">
        <h3
          className={`line-clamp-2 text-sm font-semibold ${agotado ? "text-gray-500" : "text-gray-900"}`}
        >
          {product.name}
        </h3>
        <p className="mt-0.5 text-xs text-gray-500">{product.unit}</p>

        {/* Se envuelve en vez de apretarse.
            
            Con los botones de cantidad ya en su tamaño mínimo, precio y
            pastilla no siempre caben en el mismo renglón de una tarjeta de dos
            columnas: antes el precio en bolívares se partía en dos, y forzando
            que no se partiera, la pastilla se salía de la tarjeta. Dejándolos
            envolverse, cuando no caben la pastilla baja a su propio renglón y
            los dos se leen enteros. */}
        <div className="mt-auto flex flex-wrap items-end justify-between gap-x-2 gap-y-2 pt-3">
          <p className={`shrink-0 ${agotado ? "text-gray-400" : "text-gray-900"}`}>
            <span className="block text-xl font-bold leading-tight">
              ${product.price.toFixed(2)}
            </span>
            {bs != null && (
              <span className="block whitespace-nowrap text-xs font-medium text-gray-500">
                Bs {formatBolivares(bs)}
              </span>
            )}
          </p>

          {agotado ? (
            <span className="rounded-full bg-gray-100 px-3 py-1.5 text-xs font-semibold text-gray-500">
              Sin existencia
            </span>
          ) : inCart ? (
            /* p-1 con botones de 36 deja la pastilla en 44 de alto, que es
               el minimo del proyecto. Antes eran de 28 y la pastilla de 36. */
            <div className="ml-auto flex items-center gap-1 rounded-full bg-emerald-600 p-1 text-white shadow-sm">
              <button
                type="button"
                onClick={() => onRemove(product.id)}
                /**
                 * Se ve de 36 y se toca de 44.
                 *
                 * Los dos botones juntos a 44 de ancho no caben al lado del
                 * precio en una tarjeta de dos columnas, así que en vez de
                 * agrandarlos se les estira el área táctil con un pseudo
                 * elemento invisible. Cada uno crece hacia afuera -- este a la
                 * izquierda, el otro a la derecha -- para que las dos zonas no
                 * se pisen: si se solaparan, apuntar al más se llevaría el
                 * menos, que es peor que tener el botón chico.
                 */
                className="relative flex h-9 w-9 items-center justify-center rounded-full transition before:absolute before:-inset-y-1 before:-left-2 before:right-0 before:content-[''] hover:bg-emerald-700 active:scale-90"
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
                // El área táctil crece hacia la derecha, al revés que la del
                // menos, para que no se pisen. Ver el comentario de arriba.
                className="relative flex h-9 w-9 items-center justify-center rounded-full transition before:absolute before:-inset-y-1 before:left-0 before:-right-2 before:content-[''] hover:bg-emerald-700 active:scale-90"
                aria-label={`Agregar otra unidad de ${product.name}`}
              >
                <Plus className="h-4 w-4" aria-hidden="true" />
              </button>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => onAdd(product.id)}
              className="flex h-11 w-11 items-center justify-center rounded-full bg-emerald-600 text-white shadow-sm transition hover:bg-emerald-700 active:scale-90"
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
