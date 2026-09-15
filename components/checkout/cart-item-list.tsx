"use client"

import Image from "next/image"
import Link from "next/link"
import { Minus, Plus, Trash2 } from "lucide-react"

import { bsEquivalent, formatBolivares } from "@/lib/pagos"
import { fotoLigera } from "@/lib/fotos"

export type CartLine = {
  id: string
  name: string
  presentation: string
  price: number
  qty: number
  image: string
}

type Props = {
  /** El abasto del pedido, para decirlo y para volver a agregar más. */
  abasto?: { id: string; name: string; eta?: string | null } | null
  items: CartLine[]
  onInc: (id: string) => void
  onDec: (id: string) => void
  onRemove: (id: string) => void
  tasaVes?: number | null
}

export function CartItemList({ abasto, items, onInc, onDec, onRemove, tasaVes }: Props) {
  return (
    <section aria-labelledby="cart-items-heading" className="rounded-2xl border border-gray-100 bg-white p-4 shadow-sm">
      <div className="mb-3 flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 id="cart-items-heading" className="text-base font-semibold text-gray-900">
            Tu pedido{" "}
            <span className="text-sm font-normal text-gray-500">
              ({items.reduce((n, i) => n + i.qty, 0)}{" "}
              {items.reduce((n, i) => n + i.qty, 0) === 1 ? "artículo" : "artículos"})
            </span>
          </h2>
          {abasto && (
            <p className="truncate text-sm text-gray-500">
              De {abasto.name}
              {/* El tiempo que carga el abasto, dicho antes de pedir: es lo que
                  uno quiere saber justo antes de comprometerse. */}
              {abasto.eta ? ` · llega en ${abasto.eta}` : ""}
            </p>
          )}
        </div>
        {/* Volver al mismo abasto: casi siempre falta algo, y el botón de atrás
            no siempre lleva ahí (si se llegó desde el inicio o un enlace). */}
        {abasto && (
          <Link
            href={`/catalogo?tienda=${abasto.id}`}
            className="-mr-2 -mt-2 flex min-h-11 shrink-0 items-center gap-1 rounded-full px-3 text-sm font-semibold text-emerald-600 active:bg-emerald-50"
          >
            <Plus className="h-4 w-4" aria-hidden="true" />
            Agregar más
          </Link>
        )}
      </div>

      <ul className="divide-y divide-gray-100">
        {items.map((item) => (
          /**
           * El nombre arriba a lo ancho y los controles abajo.
           *
           * Antes el nombre compartía renglón con el basurero y la pastilla de
           * cantidad, y en un teléfono quedaba en catorce letras: "Aceite
           * Comesti...". Ahora tiene dos renglones enteros, y abajo va el total
           * de la línea -- que es lo que cambia al tocar más o menos -- con el
           * precio por unidad cuando hay más de una.
           */
          <li key={item.id} className="flex items-start gap-3 py-3">
            <div className="relative h-16 w-16 shrink-0 overflow-hidden rounded-xl bg-gray-50">
              <Image
                src={fotoLigera(item.image) || "/placeholder.svg"}
                alt=""
                fill
                sizes="64px"
                className="object-cover"
              />
            </div>

            <div className="min-w-0 flex-1">
              <div className="flex items-start gap-1">
                <div className="min-w-0 flex-1">
                  <p className="line-clamp-2 text-sm font-medium leading-snug text-gray-900">
                    {item.name}
                  </p>
                  <p className="truncate text-xs text-gray-500">{item.presentation}</p>
                </div>
                <button
                  type="button"
                  onClick={() => onRemove(item.id)}
                  aria-label={`Eliminar ${item.name}`}
                  className="-mr-2 -mt-2.5 flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-gray-500 transition-colors hover:text-rose-600 active:bg-gray-100"
                >
                  <Trash2 className="h-4 w-4" aria-hidden="true" />
                </button>
              </div>

              <div className="mt-2 flex items-end justify-between gap-2">
                <div className="min-w-0">
                  <p
                    key={item.qty}
                    className="animate-[sube-numero_0.2s_ease-out] text-base font-bold tabular-nums text-gray-900"
                  >
                    ${(item.price * item.qty).toFixed(2)}
                  </p>
                  {bsEquivalent(item.price * item.qty, tasaVes ?? null) != null && (
                    <p className="whitespace-nowrap text-xs tabular-nums text-gray-500">
                      Bs {formatBolivares(bsEquivalent(item.price * item.qty, tasaVes ?? null)!)}
                    </p>
                  )}
                  {item.qty > 1 && (
                    <p className="whitespace-nowrap text-xs tabular-nums text-gray-500">
                      ${item.price.toFixed(2)} c/u
                    </p>
                  )}
                </div>

                <div className="flex shrink-0 items-center gap-1 rounded-full border border-gray-200 p-0.5">
                  <button
                    type="button"
                    onClick={() => onDec(item.id)}
                    aria-label={`Disminuir cantidad de ${item.name}`}
                    className="relative flex h-9 w-9 items-center justify-center rounded-full text-gray-600 transition before:absolute before:-inset-y-1 before:-left-2 before:right-0 before:content-[''] hover:bg-gray-100 active:scale-90"
                  >
                    <Minus className="h-4 w-4" aria-hidden="true" />
                  </button>
                  <span
                    className="w-6 text-center text-sm font-semibold tabular-nums text-gray-900"
                    aria-live="polite"
                  >
                    {item.qty}
                  </span>
                  <button
                    type="button"
                    onClick={() => onInc(item.id)}
                    aria-label={`Aumentar cantidad de ${item.name}`}
                    className="relative flex h-9 w-9 items-center justify-center rounded-full bg-emerald-600 text-white transition before:absolute before:-inset-y-1 before:left-0 before:-right-2 before:content-[''] hover:bg-emerald-700 active:scale-90"
                  >
                    <Plus className="h-4 w-4" aria-hidden="true" />
                  </button>
                </div>
              </div>
            </div>
          </li>
        ))}
      </ul>

      {items.length === 0 && (
        <p className="py-8 text-center text-sm text-gray-500">Tu carrito está vacío.</p>
      )}
    </section>
  )
}
