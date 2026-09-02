"use client"

import { useMemo, useState } from "react"
import { ArrowLeft, ShoppingBag } from "lucide-react"
import Link from "next/link"
import { CartItemList, type CartLine } from "./cart-item-list"
import { SubstitutionOptions } from "./substitution-options"
import { PaymentMethods } from "./payment-methods"
import { OrderSummary } from "./order-summary"

const INITIAL_ITEMS: CartLine[] = [
  {
    id: "harina-pan",
    name: "Harina de Maíz PAN",
    presentation: "Bulto de 12 · 1 kg c/u",
    price: 24.5,
    qty: 2,
    image: "/products/harina-pan.png",
  },
  {
    id: "aceite",
    name: "Aceite Comestible",
    presentation: "Caja de 6 · 1 L c/u",
    price: 18.9,
    qty: 1,
    image: "/products/aceite.png",
  },
  {
    id: "arroz",
    name: "Arroz Blanco",
    presentation: "Saco · 10 kg",
    price: 12.75,
    qty: 1,
    image: "/products/arroz.png",
  },
  {
    id: "cafe",
    name: "Café Molido Premium",
    presentation: "Unidad · 500 g",
    price: 8.4,
    qty: 3,
    image: "/products/cafe.png",
  },
]

const SERVICE_FEE = 1.99
const DELIVERY_FEE = 3.5

export function CheckoutView() {
  const [items, setItems] = useState<CartLine[]>(INITIAL_ITEMS)
  const [substitution, setSubstitution] = useState("shopper")
  const [payment, setPayment] = useState("pago-movil")
  const [placed, setPlaced] = useState(false)

  const inc = (id: string) =>
    setItems((prev) => prev.map((i) => (i.id === id ? { ...i, qty: i.qty + 1 } : i)))
  const dec = (id: string) =>
    setItems((prev) =>
      prev.flatMap((i) =>
        i.id === id ? (i.qty > 1 ? [{ ...i, qty: i.qty - 1 }] : []) : [i],
      ),
    )
  const remove = (id: string) => setItems((prev) => prev.filter((i) => i.id !== id))

  const subtotal = useMemo(() => items.reduce((sum, i) => sum + i.price * i.qty, 0), [items])
  const hasItems = items.length > 0
  const total = subtotal + (hasItems ? SERVICE_FEE + DELIVERY_FEE : 0)

  return (
    <div className="min-h-screen bg-gray-50 pb-28">
      <header className="sticky top-0 z-20 flex items-center gap-3 border-b border-gray-100 bg-white/90 px-4 py-3 backdrop-blur">
        <Link
          href="/catalogo"
          aria-label="Volver al catálogo"
          className="flex h-9 w-9 items-center justify-center rounded-full text-gray-600 transition-colors hover:bg-gray-100"
        >
          <ArrowLeft className="h-5 w-5" />
        </Link>
        <h1 className="text-lg font-semibold text-gray-900">Carrito y pago</h1>
      </header>

      <main className="mx-auto max-w-lg space-y-4 px-4 py-4">
        <CartItemList items={items} onInc={inc} onDec={dec} onRemove={remove} />
        <SubstitutionOptions value={substitution} onChange={setSubstitution} />
        <PaymentMethods value={payment} onChange={setPayment} />
        <OrderSummary subtotal={subtotal} serviceFee={hasItems ? SERVICE_FEE : 0} deliveryFee={hasItems ? DELIVERY_FEE : 0} />

        {placed && (
          <p
            role="status"
            className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-center text-sm font-medium text-emerald-700"
          >
            ¡Pedido realizado! Tu shopper comenzará a preparar tu compra.
          </p>
        )}
      </main>

      <div className="fixed inset-x-0 bottom-0 z-20 border-t border-gray-100 bg-white/95 p-4 backdrop-blur">
        <div className="mx-auto max-w-lg">
          <button
            type="button"
            disabled={!hasItems}
            onClick={() => setPlaced(true)}
            className="flex w-full items-center justify-center gap-2 rounded-2xl bg-emerald-500 px-6 py-4 text-base font-semibold text-white shadow-lg shadow-emerald-500/25 transition-all hover:bg-emerald-600 active:scale-[0.99] disabled:cursor-not-allowed disabled:bg-gray-300 disabled:shadow-none"
          >
            <ShoppingBag className="h-5 w-5" />
            Realizar Pedido
            <span className="tabular-nums">· ${total.toFixed(2)}</span>
          </button>
        </div>
      </div>
    </div>
  )
}
