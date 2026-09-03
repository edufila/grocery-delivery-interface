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
import { nombreDesdeId } from "@/lib/carrito"
import { fetchMetodosPago, sePuedeOfrecer, type MetodoPago } from "@/lib/pagos"
import type { Address } from "@/lib/orders"
import { createClient } from "@/lib/supabase/client"
import { isSupabaseConfigured } from "@/lib/supabase/config"

/**
 * Solo por si no se pueden leer las de verdad. Las tarifas que valen salen de
 * la base: si aquí quedaran fijas, al cambiar el costo de envío desde el panel
 * el cliente vería un total y se le cobraría otro.
 */
const SERVICE_FEE = 1.99
const DELIVERY_FEE = 3.5

type Session = {
  loading: boolean
  userId: string | null
  address: Address | null
}

type Tienda = { id: string; name: string; delivery_fee: number }

/**
 * `place_order` rechaza el pedido con mensajes escritos para que los lea una
 * persona: que la dirección no tiene punto en el mapa, que el carrito mezcla
 * dos abastos, que un producto ya no existe. Antes se tapaban todos con
 * "Intenta de nuevo", que además es un mal consejo: reintentar no arregla
 * ninguno de esos.
 */
function mensajeDeError(mensaje: string | undefined) {
  if (!mensaje) return "No pudimos registrar el pedido. Intenta de nuevo."
  if (mensaje.includes("does not exist")) return "Falta correr la migración del catálogo en Supabase."

  for (const conocido of [
    "Ese método de pago ya no está disponible",
    "Se agotó:",
    "No se puede pedir de dos abastos",
    "no tiene el punto marcado",
    "El carrito está vacío",
    "Esa dirección no es tuya",
    "Hay que iniciar sesión",
  ]) {
    if (mensaje.includes(conocido)) return mensaje
  }

  return "No pudimos registrar el pedido. Intenta de nuevo."
}

export function CheckoutView() {
  const router = useRouter()
  const {
    lines,
    subtotal,
    ready,
    storeIds,
    perdidos,
    agotados,
    add,
    removeOne,
    removeAll,
    keepOnly,
    descartarPerdidos,
    clear,
  } = useCart()

  const [substitution, setSubstitution] = useState("shopper")
  // Sin método elegido hasta saber cuáles hay: el que estaba fijo aquí podía
  // no estar ofreciéndose, y el pedido entraba con algo que nadie sabe cobrar.
  const [payment, setPayment] = useState("")
  const [note, setNote] = useState("")
  const [session, setSession] = useState<Session>({ loading: true, userId: null, address: null })
  const [placing, setPlacing] = useState(false)
  const [error, setError] = useState("")
  const [tiendas, setTiendas] = useState<Tienda[]>([])
  const [serviceFee, setServiceFee] = useState(SERVICE_FEE)
  const [metodos, setMetodos] = useState<MetodoPago[]>([])

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

  /**
   * Las tarifas se leen de la base, que es de donde las toma `place_order` al
   * cobrar. Antes estaban escritas aquí: cambiar el envío desde el panel dejaba
   * al cliente viendo un total que no era el que se le iba a cobrar.
   */
  useEffect(() => {
    if (!isSupabaseConfigured || storeIds.length === 0) return
    let cancelled = false

    void (async () => {
      const supabase = createClient()
      const [{ data: filas }, { data: ajustes }] = await Promise.all([
        supabase
          .from("stores")
          .select("id, name, delivery_fee")
          .in("id", storeIds)
          .returns<Tienda[]>(),
        supabase
          .from("settings")
          .select("service_fee")
          .eq("id", "global")
          .maybeSingle<{ service_fee: number }>(),
      ])

      if (cancelled) return
      if (filas) setTiendas(filas.map((t) => ({ ...t, delivery_fee: Number(t.delivery_fee) })))
      if (ajustes?.service_fee != null) setServiceFee(Number(ajustes.service_fee))
    })()

    return () => {
      cancelled = true
    }
    // La lista de ids, no el arreglo: se arma nuevo en cada render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [storeIds.join(",")])

  /** Los métodos que hoy se pueden cumplir, y el primero queda elegido. */
  useEffect(() => {
    if (!isSupabaseConfigured) return
    let cancelado = false

    void (async () => {
      const todos = await fetchMetodosPago(createClient())
      if (cancelado) return

      const ofrecibles = todos.filter(sePuedeOfrecer)
      setMetodos(ofrecibles)
      setPayment((actual) =>
        ofrecibles.some((m) => m.id === actual) ? actual : (ofrecibles[0]?.id ?? ""),
      )
    })()

    return () => {
      cancelado = true
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
  // El envío lo pone el abasto del carrito, que es de donde lo saca la base.
  const deliveryFee = tiendas[0]?.delivery_fee ?? DELIVERY_FEE
  const total = subtotal + (hasItems ? serviceFee + deliveryFee : 0)
  // Sin punto en el mapa el repartidor no tiene a dónde ir: no se puede pedir.
  const addressPinned = session.address?.lat != null && session.address?.lng != null
  /**
   * Red de seguridad: al entrar a otro abasto se pregunta qué hacer con el
   * carrito, así que mezclado no debería llegar nunca. Pero un carrito viejo
   * guardado en el teléfono desde antes de ese aviso sí puede estar mezclado, y
   * la base lo rechazaría al final sin decir qué quitar.
   */
  const mezclado = storeIds.length > 1
  /**
   * Lo que frena el pedido: agotado o desaparecido del catálogo. Se avisa
   * junto porque para el cliente el problema es el mismo, aunque la causa no.
   */
  const noPedibles = [...agotados.map((l) => l.product.id), ...perdidos]
  const canPlace =
    hasItems &&
    !!session.userId &&
    addressPinned &&
    !mezclado &&
    noPedibles.length === 0 &&
    // Sin método de pago no hay pedido: la base lo rechazaría igual.
    payment.length > 0 &&
    !placing

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
      setError(mensajeDeError(rpcError?.message))
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
            {/* Se agotaron o los desactivaron mientras el carrito esperaba en
                el teléfono. Antes se caían solos y el cliente llegaba aquí con
                menos cosas de las que puso, sin enterarse. */}
            {noPedibles.length > 0 && (
              <section className="rounded-2xl border border-amber-200 bg-amber-50 p-4">
                <p className="text-sm font-semibold text-amber-900">
                  {noPedibles.length === 1
                    ? "Un producto de tu carrito no se puede pedir"
                    : `${noPedibles.length} productos de tu carrito no se pueden pedir`}
                </p>
                <ul className="mt-1.5 flex flex-col gap-1">
                  {agotados.map(({ product }) => (
                    <li key={product.id} className="text-sm leading-relaxed text-amber-800">
                      <span className="font-medium">{product.name}</span> — se agotó
                    </li>
                  ))}
                  {perdidos.map((id) => (
                    <li key={id} className="text-sm leading-relaxed text-amber-800">
                      <span className="font-medium">{nombreDesdeId(id)}</span> — ya no está en el
                      catálogo
                    </li>
                  ))}
                </ul>
                <button
                  type="button"
                  onClick={descartarPerdidos}
                  className="mt-3 flex h-11 items-center justify-center rounded-xl bg-amber-600 px-4 text-sm font-semibold text-white"
                >
                  Entendido, quitarlos
                </button>
              </section>
            )}

            {mezclado && (
              <section className="rounded-2xl border border-amber-200 bg-amber-50 p-4">
                <p className="text-sm font-semibold text-amber-900">
                  Tu carrito tiene productos de dos abastos
                </p>
                <p className="mt-1 text-sm leading-relaxed text-amber-800">
                  Cada pedido es de uno solo, porque el shopper hace un recorrido. Elige con cuál
                  te quedas; lo del otro se quita del carrito.
                </p>
                <div className="mt-3 flex flex-col gap-2">
                  {tiendas.map((tienda) => (
                    <button
                      key={tienda.id}
                      type="button"
                      onClick={() => keepOnly(tienda.id)}
                      className="flex h-12 w-full items-center justify-center rounded-xl bg-amber-600 px-4 text-sm font-semibold text-white"
                    >
                      Dejar solo lo de {tienda.name}
                    </button>
                  ))}
                </div>
              </section>
            )}

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
            <PaymentMethods value={payment} onChange={setPayment} metodos={metodos} />
            <OrderSummary subtotal={subtotal} serviceFee={serviceFee} deliveryFee={deliveryFee} />
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
