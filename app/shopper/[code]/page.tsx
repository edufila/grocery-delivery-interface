import type { Metadata } from "next"
import Link from "next/link"
import { notFound, redirect } from "next/navigation"
import { ArrowLeft, MapPin } from "lucide-react"

import { OrderLiveRefresh } from "@/components/live-refresh"
import { LocationShare } from "@/components/shopper/location-share"
import { ShopperActions } from "@/components/shopper/shopper-actions"
import {
  formatMoney,
  formatOrderDate,
  SHOPPER_ROLES,
  STATUS_LABEL,
  SUBSTITUTION_LABEL,
  type Order,
  type OrderItem,
  type Role,
} from "@/lib/orders"
import { isSupabaseConfigured } from "@/lib/supabase/config"
import { createClient } from "@/lib/supabase/server"

export const metadata: Metadata = {
  title: "Preparar pedido · Gran Abasto Girasol",
}

export default async function ShopperOrderPage({
  params,
}: {
  params: Promise<{ code: string }>
}) {
  if (!isSupabaseConfigured) redirect("/login")

  const { code } = await params
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) redirect(`/login?next=/shopper/${code}`)

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .maybeSingle<{ role: Role }>()

  if (!profile || !SHOPPER_ROLES.includes(profile.role)) redirect("/shopper")

  const { data: order } = await supabase
    .from("orders")
    .select("*")
    .eq("code", code.toUpperCase())
    .maybeSingle<Order>()

  if (!order) notFound()

  const { data: items } = await supabase
    .from("order_items")
    .select("*")
    .eq("order_id", order.id)
    .returns<OrderItem[]>()

  const lines = items ?? []
  const mine = order.shopper_id === user.id

  return (
    <main className="min-h-dvh bg-gray-50">
      <header className="sticky top-0 z-20 border-b border-gray-100 bg-white/90 backdrop-blur">
        <div className="mx-auto flex max-w-lg items-center gap-2 px-4 py-3">
          <Link
            href="/shopper"
            aria-label="Volver al panel"
            className="-ml-2 flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-gray-600 transition active:bg-gray-100"
          >
            <ArrowLeft className="h-5 w-5" />
          </Link>
          <div className="min-w-0">
            <h1 className="truncate text-lg font-semibold text-gray-900">Pedido {order.code}</h1>
            <p className="truncate text-sm text-gray-500">
              {STATUS_LABEL[order.status]} · {formatOrderDate(order.created_at)}
            </p>
          </div>
        </div>
      </header>

      <OrderLiveRefresh orderId={order.id} status={order.status} shopperId={order.shopper_id} />

      <div className="mx-auto flex max-w-lg flex-col gap-4 px-4 pb-10 pt-4">
        <section className="flex items-start gap-3 rounded-2xl border border-gray-100 bg-white p-4">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-emerald-50">
            <MapPin className="h-4 w-4 text-emerald-600" aria-hidden="true" />
          </span>
          <div className="min-w-0">
            <p className="text-[11px] font-medium uppercase tracking-wide text-gray-400">
              Entregar en
            </p>
            <p className="text-sm font-semibold text-gray-900">{order.address_label}</p>
            <p className="text-sm text-gray-500">{order.address_detail}</p>
          </div>
        </section>

        <section className="rounded-2xl border border-gray-100 bg-white p-5">
          <h2 className="mb-1 text-base font-semibold text-gray-900">
            Qué comprar{" "}
            <span className="text-sm font-normal text-gray-500">
              ({lines.reduce((n, i) => n + i.qty, 0)} artículos)
            </span>
          </h2>
          <p className="mb-4 text-xs text-gray-500">
            Si falta algo: {SUBSTITUTION_LABEL[order.substitution_policy]}
          </p>

          <ul className="flex flex-col divide-y divide-gray-100">
            {lines.map((item) => (
              <li key={item.id} className="flex items-start justify-between gap-3 py-3">
                <div className="flex min-w-0 gap-3">
                  <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-emerald-50 text-sm font-bold text-emerald-700 tabular-nums">
                    {item.qty}
                  </span>
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-gray-900">{item.name}</p>
                    <p className="text-xs text-gray-500">{item.unit}</p>
                  </div>
                </div>
                <span className="shrink-0 text-sm tabular-nums text-gray-500">
                  {formatMoney(item.unit_price * item.qty)}
                </span>
              </li>
            ))}
          </ul>

          <p className="mt-4 flex justify-between border-t border-gray-100 pt-4 text-base font-semibold text-gray-900">
            <span>Total del pedido</span>
            <span className="tabular-nums">{formatMoney(order.total)}</span>
          </p>
        </section>

        {mine && <LocationShare orderId={order.id} />}

        <ShopperActions order={order} userId={user.id} />
      </div>
    </main>
  )
}
