"use client"

import { useMemo, useState } from "react"
import { ArrowLeft, ShoppingBag, ShoppingCart } from "lucide-react"
import Link from "next/link"
import { CartItemList, type CartLine } from "./cart-item-list"
import { SubstitutionOptions } from "./substitution-options"
import { PaymentMethods } from "./payment-methods"
import { OrderSummary } from "./order-summary"
import { useCart } from "@/lib/cart"

const SERVICE_FEE = 1.99
const DELIVERY_FEE = 3.5

export function CheckoutView() {
  const { lines, subtotal, ready, add, removeOne, removeAll, clear } = useCart()

  const [substitution, setSubstitution] = useState("shopper")
  const [payment, setPayment] = useState("pago-movil")
  const [placed, setPlaced] = useState(false)

  // El carrito guarda ids y cantidades; la lista quiere una fila armada.
  const items = useMemo<CartLine[]>(
    () =>
      lines.map(({ product, qty }) => ({
        id: product.id,
        name: product.name,
        presentation: product.unit,
        price: product.price,
        qty,
        image: product.image,
      })),
    [lines],
  )

  const hasItems = items.length > 0
  const total = subtotal + (hasItems ? SERVICE_FEE + DELIVERY_FEE : 0)

  function placeOrder() {
    setPlaced(true)
    clear()
  }

  return (
    <div className="min-h-dvh bg-gray-50 pb-28">
      <header className="sticky top-0 z-20 flex items-center gap-3 border-b border-gray-100 bg-white/90 px-4 py-3 backdrop-blur">
        <Link
          href="/catalogo"
          aria-label="Volver al catálogo"
          className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-gray-600 transition active:bg-gray-100"
        >
          <ArrowLeft className="h-5 w-5" />
        </Link>
        <h1 className="text-lg font-semibold text-gray-900">Carrito y pago</h1>
      </header>

      <main className="mx-auto max-w-lg space-y-4 px-4 py-4">
        {placed ? (
          <section className="rounded-3xl border border-emerald-100 bg-white p-6 text-center">
            <span className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-emerald-50">
              <ShoppingBag className="h-7 w-7 text-emerald-600" aria-hidden="true" />
            </span>
            <h2 className="mt-4 text-xl font-semibold text-gray-900">¡Pedido realizado!</h2>
            <p className="mt-2 text-sm leading-relaxed text-gray-500">
              Tu shopper ya está armando la compra. Podés seguirla en tiempo real.
            </p>
            <Link
              href="/tracking"
              className="mt-6 flex h-14 w-full items-center justify-center rounded-2xl bg-emerald-600 text-base font-semibold text-white transition active:scale-[0.99]"
            >
              Seguir mi pedido
            </Link>
            <Link
              href="/catalogo"
              className="mt-3 flex h-14 w-full items-center justify-center rounded-2xl border border-gray-200 bg-white text-base font-semibold text-gray-700 transition active:scale-[0.99]"
            >
              Seguir comprando
            </Link>
          </section>
        ) : !ready ? (
          <p className="py-16 text-center text-sm text-gray-400">Cargando tu carrito...</p>
        ) : !hasItems ? (
          <section className="rounded-3xl border border-gray-100 bg-white p-8 text-center">
            <span className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-gray-50">
              <ShoppingCart className="h-7 w-7 text-gray-400" aria-hidden="true" />
            </span>
            <h2 className="mt-4 text-lg font-semibold text-gray-900">Tu carrito está vacío</h2>
            <p className="mt-2 text-sm leading-relaxed text-gray-500">
              Agregá productos del catálogo y volvé acá para confirmar el pedido.
            </p>
            <Link
              href="/catalogo"
              className="mt-6 flex h-14 w-full items-center justify-center rounded-2xl bg-emerald-600 text-base font-semibold text-white transition active:scale-[0.99]"
            >
              Ir al catálogo
            </Link>
          </section>
        ) : (
          <>
            <CartItemList items={items} onInc={add} onDec={removeOne} onRemove={removeAll} />
            <SubstitutionOptions value={substitution} onChange={setSubstitution} />
            <PaymentMethods value={payment} onChange={setPayment} />
            <OrderSummary subtotal={subtotal} serviceFee={SERVICE_FEE} deliveryFee={DELIVERY_FEE} />
          </>
        )}
      </main>

      {!placed && hasItems && (
        <div className="fixed inset-x-0 bottom-0 z-20 border-t border-gray-100 bg-white/95 p-4 pb-[calc(env(safe-area-inset-bottom)+1rem)] backdrop-blur">
          <div className="mx-auto max-w-lg">
            <button
              type="button"
              onClick={placeOrder}
              className="flex h-14 w-full items-center justify-center gap-2 rounded-2xl bg-emerald-600 px-6 text-base font-semibold text-white shadow-lg shadow-emerald-600/25 transition active:scale-[0.99]"
            >
              <ShoppingBag className="h-5 w-5" />
              Realizar pedido
              <span className="tabular-nums">· ${total.toFixed(2)}</span>
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
