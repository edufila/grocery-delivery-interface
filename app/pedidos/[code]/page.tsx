import type { Metadata } from "next"
import Link from "next/link"
import { notFound, redirect } from "next/navigation"
import { ArrowLeft, Check, MapPin } from "lucide-react"

import { OrderMap } from "@/components/tracking/order-map"
import { ShopperChat } from "@/components/tracking/shopper-chat"
import {
  formatMoney,
  formatOrderDate,
  PAYMENT_LABEL,
  STATUS_FLOW,
  statusDescription,
  statusLabel,
  SUBSTITUTION_LABEL,
  type Order,
  type OrderItem,
} from "@/lib/orders"
import { isSupabaseConfigured } from "@/lib/supabase/config"
import { createClient } from "@/lib/supabase/server"

export const metadata: Metadata = {
  title: "Seguimiento del pedido · Gran Abasto Girasol",
}

export default async function PedidoPage({ params }: { params: Promise<{ code: string }> }) {
  if (!isSupabaseConfigured) redirect("/login")

  const { code } = await params
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) redirect(`/login?next=/pedidos/${code}`)

  const { data: order } = await supabase
    .from("orders")
    .select("*")
    .eq("code", code.toUpperCase())
    .maybeSingle<Order>()

  // RLS ya limita a los pedidos propios: si no vuelve nada, no es suyo o no existe.
  if (!order) notFound()

  const { data: items } = await supabase
    .from("order_items")
    .select("*")
    .eq("order_id", order.id)
    .returns<OrderItem[]>()

  const lines = items ?? []
  const currentStep = STATUS_FLOW.indexOf(order.status)
  const cancelled = order.status === "cancelado"

  return (
    <main className="min-h-dvh bg-gray-50">
      {/* El interior se alinea con el contenido: si no, en pantalla ancha la
          flecha queda sola contra el borde y el resto centrado. */}
      <header className="sticky top-0 z-20 border-b border-gray-100 bg-white/90 backdrop-blur">
        <div className="mx-auto flex max-w-lg items-center gap-2 px-4 py-3">
          <Link
            href="/pedidos"
            aria-label="Volver a tus pedidos"
            className="-ml-2 flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-gray-600 transition active:bg-gray-100"
          >
            <ArrowLeft className="h-5 w-5" />
          </Link>
          <div className="min-w-0">
            <h1 className="truncate text-lg font-semibold text-gray-900">Pedido {order.code}</h1>
            <p className="truncate text-sm text-gray-500">{formatOrderDate(order.created_at)}</p>
          </div>
        </div>
      </header>

      <div className="mx-auto max-w-lg space-y-4 px-4 pb-10 pt-4">
        {!cancelled && (
          <OrderMap
            orderId={order.id}
            destination={
              order.address_lat != null && order.address_lng != null
                ? { lat: order.address_lat, lng: order.address_lng }
                : null
            }
            shopper={
              order.shopper_lat != null && order.shopper_lng != null
                ? { lat: order.shopper_lat, lng: order.shopper_lng }
                : null
            }
            live={order.status !== "entregado"}
          />
        )}

        {order.shopper_located_at && order.status === "en_camino" && (
          <section className="flex items-start gap-3 rounded-2xl border border-emerald-100 bg-emerald-50 p-4">
            <span className="relative mt-1 flex h-2.5 w-2.5 shrink-0" aria-hidden="true">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
              <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-emerald-600" />
            </span>
            <div className="min-w-0">
              <p className="text-sm font-semibold text-emerald-900">Tu shopper va en camino</p>
              <p className="mt-0.5 text-sm text-emerald-800">
                Última señal a las{" "}
                {new Date(order.shopper_located_at).toLocaleTimeString("es-VE", {
                  hour: "numeric",
                  minute: "2-digit",
                })}
                {order.shopper_lat != null && order.shopper_lng != null && (
                  <span className="block font-mono text-xs text-emerald-700">
                    {order.shopper_lat.toFixed(5)}, {order.shopper_lng.toFixed(5)}
                  </span>
                )}
              </p>
            </div>
          </section>
        )}

        <section className="rounded-2xl border border-gray-100 bg-white p-5">
          <h2 className="mb-4 text-base font-semibold text-gray-900">Estado</h2>
          {cancelled ? (
            <p className="rounded-xl bg-rose-50 px-4 py-3 text-sm font-medium text-rose-700">
              Este pedido fue cancelado.
            </p>
          ) : (
            <ol className="flex flex-col gap-4">
              {STATUS_FLOW.map((status, index) => {
                const done = index < currentStep
                const current = index === currentStep
                return (
                  <li key={status} className="flex items-start gap-3">
                    <span
                      className={`mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-bold ${
                        done
                          ? "bg-emerald-600 text-white"
                          : current
                            ? "bg-emerald-100 text-emerald-700 ring-4 ring-emerald-50"
                            : "bg-gray-100 text-gray-400"
                      }`}
                      aria-hidden="true"
                    >
                      {done ? <Check className="h-4 w-4" strokeWidth={3} /> : index + 1}
                    </span>
                    <div className="min-w-0 flex-1">
                      <p
                        className={`text-sm font-semibold ${
                          done || current ? "text-gray-900" : "text-gray-400"
                        }`}
                      >
                        {statusLabel(status, order.shopper_id)}
                      </p>
                      {current && (
                        <>
                          <p className="mt-0.5 text-sm text-gray-500">
                            {statusDescription(status, order.shopper_id)}
                          </p>
                          {status === "preparando" && <ShopperChat />}
                        </>
                      )}
                    </div>
                  </li>
                )
              })}
            </ol>
          )}
        </section>

        <section className="rounded-2xl border border-gray-100 bg-white p-5">
          <h2 className="mb-3 text-base font-semibold text-gray-900">
            Tu pedido{" "}
            <span className="text-sm font-normal text-gray-500">
              ({lines.reduce((n, i) => n + i.qty, 0)} artículos)
            </span>
          </h2>
          <ul className="flex flex-col gap-3">
            {lines.map((item) => (
              <li key={item.id} className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-sm font-medium text-gray-900">
                    {item.qty} × {item.name}
                  </p>
                  <p className="text-xs text-gray-500">{item.unit}</p>
                </div>
                <span className="shrink-0 text-sm font-semibold tabular-nums text-gray-900">
                  {formatMoney(item.unit_price * item.qty)}
                </span>
              </li>
            ))}
          </ul>

          <dl className="mt-4 space-y-2 border-t border-gray-100 pt-4 text-sm">
            <div className="flex justify-between">
              <dt className="text-gray-500">Subtotal</dt>
              <dd className="tabular-nums text-gray-700">{formatMoney(order.subtotal)}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-gray-500">Servicio</dt>
              <dd className="tabular-nums text-gray-700">{formatMoney(order.service_fee)}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-gray-500">Envío</dt>
              <dd className="tabular-nums text-gray-700">{formatMoney(order.delivery_fee)}</dd>
            </div>
            <div className="flex justify-between border-t border-gray-100 pt-2 text-base font-semibold text-gray-900">
              <dt>Total</dt>
              <dd className="tabular-nums">{formatMoney(order.total)}</dd>
            </div>
          </dl>
        </section>

        <section className="rounded-2xl border border-gray-100 bg-white p-5">
          <h2 className="mb-3 text-base font-semibold text-gray-900">Detalles</h2>
          <dl className="flex flex-col gap-3 text-sm">
            <div className="flex items-start gap-3">
              <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-gray-400" aria-hidden="true" />
              <div>
                <dt className="text-xs font-medium uppercase tracking-wide text-gray-400">
                  Entrega
                </dt>
                <dd className="text-gray-900">
                  {order.address_label}
                  {order.address_detail ? ` · ${order.address_detail}` : ""}
                </dd>
              </div>
            </div>
            <div>
              <dt className="text-xs font-medium uppercase tracking-wide text-gray-400">Pago</dt>
              <dd className="text-gray-900">
                {PAYMENT_LABEL[order.payment_method] ?? order.payment_method}
              </dd>
            </div>
            <div>
              <dt className="text-xs font-medium uppercase tracking-wide text-gray-400">
                Si falta un producto
              </dt>
              <dd className="text-gray-900">
                {SUBSTITUTION_LABEL[order.substitution_policy] ?? order.substitution_policy}
              </dd>
            </div>
          </dl>
        </section>
      </div>
    </main>
  )
}
