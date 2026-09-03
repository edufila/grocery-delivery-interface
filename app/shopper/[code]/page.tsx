import type { Metadata } from "next"
import Link from "next/link"
import { notFound, redirect } from "next/navigation"
import { ArrowLeft, MapPin, Phone, User } from "lucide-react"

import { OrderLiveRefresh } from "@/components/live-refresh"
import { ShopperPanel } from "@/components/shopper/shopper-panel"
import { ShoppingList } from "@/components/shopper/shopping-list"
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
import { firstName } from "@/lib/profile"
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

  // Solo nombre y teléfono, y solo mientras el pedido esté en curso.
  const { data: customerRows } = await supabase.rpc("order_customer", { p_order_id: order.id })
  const customer = (customerRows as { full_name: string | null; phone: string | null }[] | null)?.[0]

  const { data: store } = await supabase
    .from("stores")
    .select("name, lat, lng")
    .eq("id", order.store_id ?? "girasol")
    .maybeSingle<{ name: string; lat: number | null; lng: number | null }>()

  return (
    <main className="min-h-dvh bg-gray-50">
      <header className="pt-barra-estado sticky top-0 z-20 border-b border-gray-100 bg-white/90 backdrop-blur">
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
        <section className="rounded-2xl border border-gray-100 bg-white p-4">
          <div className="flex items-start gap-3">
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
          </div>

          {order.customer_note && (
            <p className="mt-3 rounded-xl bg-amber-50 px-3 py-2.5 text-sm leading-relaxed text-amber-900">
              <span className="font-semibold">Indicaciones: </span>
              {order.customer_note}
            </p>
          )}

          {customer && (
            <div className="mt-3 flex items-center gap-3 border-t border-gray-100 pt-3">
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-gray-100">
                <User className="h-4 w-4 text-gray-500" aria-hidden="true" />
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-[11px] font-medium uppercase tracking-wide text-gray-400">
                  Le entregas a
                </p>
                <p className="truncate text-sm font-semibold text-gray-900">
                  {firstName(customer.full_name) || "Sin nombre cargado"}
                </p>
              </div>
              {customer.phone && (
                <a
                  href={`tel:${customer.phone.replace(/\s/g, "")}`}
                  className="flex h-11 shrink-0 items-center gap-1.5 rounded-xl border border-gray-200 px-3 text-sm font-semibold text-emerald-600"
                >
                  <Phone className="h-4 w-4" aria-hidden="true" />
                  Llamar
                </a>
              )}
            </div>
          )}
        </section>

        <ShoppingList
          items={lines}
          substitutionPolicy={SUBSTITUTION_LABEL[order.substitution_policy]}
          editable={mine && (order.status === "confirmado" || order.status === "preparando")}
        />

        <section className="rounded-2xl border border-gray-100 bg-white p-5">
          <p className="flex justify-between text-sm text-gray-500">
            <span>Estimado al confirmar</span>
            <span className="tabular-nums">{formatMoney(order.total)}</span>
          </p>
          <p className="mt-2 flex justify-between border-t border-gray-100 pt-2 text-base font-semibold text-gray-900">
            <span>A cobrar</span>
            <span className="tabular-nums">
              {formatMoney(order.final_total ?? order.total)}
            </span>
          </p>
        </section>

        <ShopperPanel order={order} userId={user.id} store={store ?? null} />
      </div>
    </main>
  )
}
