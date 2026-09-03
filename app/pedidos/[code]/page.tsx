import type { Metadata } from "next"
import Link from "next/link"
import { notFound, redirect } from "next/navigation"
import { ArrowLeft, Check, MapPin } from "lucide-react"

import { OrderLiveRefresh } from "@/components/live-refresh"
import { DeliveryCodeCard } from "@/components/tracking/delivery-code-card"
import { OrderMap } from "@/components/tracking/order-map"
import { CancelOrder } from "@/components/tracking/cancel-order"
import { RepetirPedido } from "@/components/tracking/repetir-pedido"
import { OrderChat } from "@/components/tracking/order-chat"
import { ShopperCard, type OrderShopper } from "@/components/tracking/shopper-card"
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
import { pageTitle } from "@/lib/brand"
import { isSupabaseConfigured } from "@/lib/supabase/config"
import { createClient } from "@/lib/supabase/server"

export const metadata: Metadata = {
  title: pageTitle("Seguimiento del pedido"),
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

  // Solo devuelve nombre, foto y @: no expone teléfono ni correo del shopper.
  const { data: shopperRows } = await supabase.rpc("order_shopper", { p_order_id: order.id })
  const shopper = (shopperRows as OrderShopper[] | null)?.[0] ?? null

  // Solo el dueño del pedido puede leerlo: el shopper no tiene política aquí.
  const { data: deliveryCode } = await supabase
    .from("order_delivery_codes")
    .select("code, attempts")
    .eq("order_id", order.id)
    .maybeSingle<{ code: string; attempts: number }>()

  return (
    <main className="min-h-dvh bg-gray-50">
      {/* El interior se alinea con el contenido: si no, en pantalla ancha la
          flecha queda sola contra el borde y el resto centrado. */}
      <header className="pt-barra-estado sticky top-0 z-20 border-b border-gray-100 bg-white/90 backdrop-blur">
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

      <OrderLiveRefresh orderId={order.id} status={order.status} shopperId={order.shopper_id} />

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
            route={order.status === "en_camino"}
          />
        )}

        {shopper && !cancelled && <ShopperCard shopper={shopper} />}

        {deliveryCode && order.status !== "entregado" && !cancelled && (
          <DeliveryCodeCard
            orderId={order.id}
            initialCode={deliveryCode.code}
            initialAttempts={deliveryCode.attempts ?? 0}
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
            <div className="rounded-xl bg-rose-50 px-4 py-3">
              <p className="text-sm font-medium text-rose-700">Este pedido fue cancelado.</p>
              {order.cancel_reason && (
                <p className="mt-1 text-sm leading-relaxed text-rose-800">
                  Motivo: {order.cancel_reason}
                </p>
              )}
            </div>
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
                          {order.shopper_id && status !== "entregado" && (
                            <OrderChat
                              orderId={order.id}
                              userId={user.id}
                              title="Chat con tu shopper"
                              subtitle={shopper?.full_name ?? "Sobre este pedido"}
                            />
                          )}
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
            {lines.map((item) => {
              const faltante = item.status === "faltante"
              const llevadas = item.final_qty ?? item.qty
              const ajustado = item.status === "ajustado" && llevadas !== item.qty

              return (
                <li key={item.id} className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p
                      className={`text-sm font-medium ${
                        faltante ? "text-gray-400 line-through" : "text-gray-900"
                      }`}
                    >
                      {faltante ? item.qty : llevadas} × {item.name}
                    </p>
                    <p className="text-xs text-gray-500">{item.unit}</p>
                    {faltante && (
                      <p className="text-xs font-medium text-rose-600">
                        No había. No se te cobra.
                      </p>
                    )}
                    {ajustado && (
                      <p className="text-xs font-medium text-amber-700">
                        Solo había {llevadas} de {item.qty}.
                      </p>
                    )}
                  </div>
                  <span
                    className={`shrink-0 text-sm font-semibold tabular-nums ${
                      faltante ? "text-gray-400 line-through" : "text-gray-900"
                    }`}
                  >
                    {formatMoney(item.unit_price * (faltante ? item.qty : llevadas))}
                  </span>
                </li>
              )
            })}
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
            {order.final_total != null && order.final_total !== order.total ? (
              <>
                <div className="flex justify-between text-gray-400">
                  <dt>Estimado al confirmar</dt>
                  <dd className="tabular-nums line-through">{formatMoney(order.total)}</dd>
                </div>
                <div className="flex justify-between border-t border-gray-100 pt-2 text-base font-semibold text-gray-900">
                  <dt>Total</dt>
                  <dd className="tabular-nums">{formatMoney(order.final_total)}</dd>
                </div>
                <p className="text-xs leading-relaxed text-gray-500">
                  El monto cambió porque no estaba todo disponible. Solo se cobra lo que el shopper
                  llevó.
                </p>
              </>
            ) : (
              <div className="flex justify-between border-t border-gray-100 pt-2 text-base font-semibold text-gray-900">
                <dt>Total</dt>
                <dd className="tabular-nums">{formatMoney(order.final_total ?? order.total)}</dd>
              </div>
            )}
          </dl>
        </section>

        {order.status === "confirmado" && !order.shopper_id && (
          <CancelOrder orderId={order.id} />
        )}

        {/* Solo con el pedido cerrado: mientras está en curso, lo que quiere
            el cliente es seguirlo, no arrancar otro igual. */}
        {(order.status === "entregado" || cancelled) && (
          <RepetirPedido
            items={lines.map((item) => ({ product_id: item.product_id, qty: item.qty }))}
          />
        )}

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
