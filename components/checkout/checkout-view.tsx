"use client"

import { useEffect, useMemo, useState } from "react"
import { Loader2, MapPin, ShoppingBag, ShoppingCart } from "lucide-react"
import Link from "next/link"
import { useRouter } from "next/navigation"

import { BackButton } from "@/components/back-button"

import { CartItemList, type CartLine } from "./cart-item-list"
import { SubstitutionOptions } from "./substitution-options"
import { PaymentMethods } from "./payment-methods"
import { OrderSummary } from "./order-summary"
import { useCart } from "@/lib/cart"
import type { Address } from "@/lib/orders"
import { createClient } from "@/lib/supabase/client"
import { isSupabaseConfigured } from "@/lib/supabase/config"

const SERVICE_FEE = 1.99
const DELIVERY_FEE = 3.5

type Session = {
  loading: boolean
  userId: string | null
  address: Address | null
}

export function CheckoutView() {
  const router = useRouter()
  const { lines, subtotal, ready, add, removeOne, removeAll, clear } = useCart()

  const [substitution, setSubstitution] = useState("shopper")
  const [payment, setPayment] = useState("pago-movil")
  const [note, setNote] = useState("")
  const [session, setSession] = useState<Session>({ loading: true, userId: null, address: null })
  const [placing, setPlacing] = useState(false)
  const [error, setError] = useState("")

  useEffect(() => {
    if (!isSupabaseConfigured) {
      setSession({ loading: false, userId: null, address: null })
      return
    }

    let cancelled = false

    void (async () => {
      const supabase = createClient()
      const {
        data: { user },
      } = await supabase.auth.getUser()

      if (!user) {
        if (!cancelled) setSession({ loading: false, userId: null, address: null })
        return
      }

      const { data } = await supabase
        .from("addresses")
        .select("id, label, detail, is_default, lat, lng")
        .eq("user_id", user.id)
        .order("is_default", { ascending: false })
        .limit(1)
        .maybeSingle<Address>()

      if (!cancelled) setSession({ loading: false, userId: user.id, address: data ?? null })
    })()

    return () => {
      cancelled = true
    }
  }, [])

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
  // Sin punto en el mapa el repartidor no tiene a dónde ir: no se puede pedir.
  const addressPinned = session.address?.lat != null && session.address?.lng != null
  const canPlace = hasItems && !!session.userId && addressPinned && !placing

  async function placeOrder() {
    if (!session.userId || !session.address || placing) return

    setPlacing(true)
    setError("")

    const supabase = createClient()

    // Solo mandamos qué y cuánto. Los precios y el total los pone la base
    // contra el catálogo: si viajaran desde aquí, se podrían adulterar.
    const { data: code, error: rpcError } = await supabase.rpc("place_order", {
      p_items: lines.map(({ product, qty }) => ({ product_id: product.id, qty })),
      p_address_id: session.address.id,
      p_payment_method: payment,
      p_substitution: substitution,
      p_note: note.trim() || null,
    })

    if (rpcError || !code) {
      setPlacing(false)
      setError(
        rpcError?.message.includes("does not exist")
          ? "Falta correr la migración del catálogo en Supabase."
          : "No pudimos registrar el pedido. Intenta de nuevo.",
      )
      return
    }

    clear()
    router.push(`/pedidos/${code as string}`)
  }

  return (
    <div className="min-h-dvh bg-gray-50 pb-28">
      <header className="pt-barra-estado sticky top-0 z-20 border-b border-gray-100 bg-white/90 backdrop-blur">
        <div className="mx-auto flex max-w-lg items-center gap-2 px-4 py-3">
          <BackButton fallback="/catalogo" label="Volver" />
          <h1 className="text-lg font-semibold text-gray-900">Carrito y pago</h1>
        </div>
      </header>

      <main className="mx-auto max-w-lg space-y-4 px-4 py-4">
        {!ready ? (
          <p className="py-16 text-center text-sm text-gray-400">Cargando tu carrito...</p>
        ) : !hasItems ? (
          <section className="rounded-3xl border border-gray-100 bg-white p-8 text-center">
            <span className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-gray-50">
              <ShoppingCart className="h-7 w-7 text-gray-400" aria-hidden="true" />
            </span>
            <h2 className="mt-4 text-lg font-semibold text-gray-900">Tu carrito está vacío</h2>
            <p className="mt-2 text-sm leading-relaxed text-gray-500">
              Agrega productos del catálogo y vuelve aquí para confirmar el pedido.
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
            <DeliveryCard session={session} />
            <CartItemList items={items} onInc={add} onDec={removeOne} onRemove={removeAll} />
            <section className="rounded-2xl border border-gray-100 bg-white p-4 shadow-sm">
              <label htmlFor="nota" className="block text-base font-semibold text-gray-900">
                Indicaciones para la entrega
              </label>
              <p className="mt-0.5 text-xs leading-relaxed text-gray-500">
                Opcional. Lo lee el shopper cuando llega.
              </p>
              <input
                id="nota"
                value={note}
                onChange={(event) => setNote(event.target.value)}
                maxLength={200}
                placeholder="Tocar el timbre dos veces, preguntar por Ana"
                className="mt-3 h-12 w-full rounded-xl border border-gray-200 bg-white px-3 text-base text-gray-900 outline-none transition placeholder:text-gray-400 focus:border-emerald-500"
              />
            </section>

            <SubstitutionOptions value={substitution} onChange={setSubstitution} />
            <PaymentMethods value={payment} onChange={setPayment} />
            <OrderSummary subtotal={subtotal} serviceFee={SERVICE_FEE} deliveryFee={DELIVERY_FEE} />
            {error && (
              <p role="alert" className="text-sm text-rose-600">
                {error}
              </p>
            )}
          </>
        )}
      </main>

      {hasItems && (
        <div className="fixed inset-x-0 bottom-0 z-20 border-t border-gray-100 bg-white/95 p-4 pb-[calc(env(safe-area-inset-bottom)+1rem)] backdrop-blur">
          <div className="mx-auto max-w-lg">
            <button
              type="button"
              onClick={() => void placeOrder()}
              disabled={!canPlace}
              className="flex h-14 w-full items-center justify-center gap-2 rounded-2xl bg-emerald-600 px-6 text-base font-semibold text-white shadow-lg shadow-emerald-600/25 transition active:scale-[0.99] disabled:bg-gray-200 disabled:text-gray-400 disabled:shadow-none"
            >
              {placing ? (
                <Loader2 className="h-5 w-5 animate-spin" aria-hidden="true" />
              ) : (
                <ShoppingBag className="h-5 w-5" aria-hidden="true" />
              )}
              {placing ? "Registrando..." : "Realizar pedido"}
              {!placing && <span className="tabular-nums">· ${total.toFixed(2)}</span>}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

/** Dónde se entrega. Sin esto no se puede pedir, y hay que decirlo claro. */
function DeliveryCard({ session }: { session: Session }) {
  if (session.loading) {
    return (
      <section className="rounded-2xl border border-gray-100 bg-white p-4 text-sm text-gray-400">
        Buscando tu dirección...
      </section>
    )
  }

  if (!session.userId) {
    return (
      <section className="rounded-2xl border border-amber-200 bg-amber-50 p-4">
        <h2 className="text-sm font-semibold text-amber-900">Entra para pedir</h2>
        <p className="mt-1 text-sm leading-relaxed text-amber-800">
          Necesitamos saber quién eres y a dónde llevar el pedido.
        </p>
        <Link
          href="/login?next=/checkout"
          className="mt-3 flex h-12 w-full items-center justify-center rounded-xl bg-amber-900 text-sm font-semibold text-white"
        >
          Iniciar sesión
        </Link>
      </section>
    )
  }

  if (!session.address) {
    return (
      <section className="rounded-2xl border border-amber-200 bg-amber-50 p-4">
        <h2 className="text-sm font-semibold text-amber-900">Falta tu dirección</h2>
        <p className="mt-1 text-sm leading-relaxed text-amber-800">
          Carga una dirección de entrega antes de confirmar el pedido.
        </p>
        <Link
          href="/perfil"
          className="mt-3 flex h-12 w-full items-center justify-center rounded-xl bg-amber-900 text-sm font-semibold text-white"
        >
          Agregar dirección
        </Link>
      </section>
    )
  }

  if (session.address.lat == null || session.address.lng == null) {
    return (
      <section className="rounded-2xl border border-amber-200 bg-amber-50 p-4">
        <h2 className="text-sm font-semibold text-amber-900">Falta marcar el punto</h2>
        <p className="mt-1 text-sm leading-relaxed text-amber-800">
          <span className="font-semibold">{session.address.label}</span> no tiene el punto exacto en
          el mapa, así que el repartidor no tendría a dónde ir. Edítala y márcalo.
        </p>
        <Link
          href="/perfil"
          className="mt-3 flex h-12 w-full items-center justify-center rounded-xl bg-amber-900 text-sm font-semibold text-white"
        >
          Marcar el punto
        </Link>
      </section>
    )
  }

  return (
    <section className="flex items-start gap-3 rounded-2xl border border-gray-100 bg-white p-4 shadow-sm">
      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-emerald-50">
        <MapPin className="h-4 w-4 text-emerald-600" aria-hidden="true" />
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-[11px] font-medium uppercase tracking-wide text-gray-400">Entregar en</p>
        <p className="text-sm font-semibold text-gray-900">{session.address.label}</p>
        <p className="truncate text-sm text-gray-500">{session.address.detail}</p>
      </div>
      <Link href="/perfil" className="min-h-9 shrink-0 text-sm font-medium text-emerald-600">
        Cambiar
      </Link>
    </section>
  )
}
