import type { Metadata } from "next"
import Link from "next/link"
import { redirect } from "next/navigation"
import { ChevronRight, ClipboardList } from "lucide-react"

import { BottomNav } from "@/components/bottom-nav"
import { formatMoney, formatOrderDate, statusLabel, type Order } from "@/lib/orders"
import { isSupabaseConfigured } from "@/lib/supabase/config"
import { createClient } from "@/lib/supabase/server"

export const metadata: Metadata = {
  title: "Pedidos · Gran Abasto Girasol",
}

export default async function PedidosPage() {
  if (!isSupabaseConfigured) redirect("/login")

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) redirect("/login?next=/pedidos")

  const { data: orders } = await supabase
    .from("orders")
    .select("id, code, status, total, created_at, address_label, shopper_id")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false })
    .returns<
      Pick<
        Order,
        "id" | "code" | "status" | "total" | "created_at" | "address_label" | "shopper_id"
      >[]
    >()

  const list = orders ?? []

  return (
    <main className="min-h-dvh bg-gray-50">
      <header className="border-b border-gray-100 bg-white">
        <div className="mx-auto max-w-md px-4 py-4">
          <h1 className="text-lg font-semibold text-gray-900">Tus pedidos</h1>
        </div>
      </header>

      <div className="mx-auto max-w-md px-4 pb-28 pt-4">
        {list.length === 0 ? (
          <section className="rounded-3xl border border-gray-100 bg-white p-8 text-center">
            <span className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-gray-50">
              <ClipboardList className="h-7 w-7 text-gray-400" aria-hidden="true" />
            </span>
            <h2 className="mt-4 text-lg font-semibold text-gray-900">Todavía no pediste nada</h2>
            <p className="mt-2 text-sm leading-relaxed text-gray-500">
              Cuando hagas tu primer pedido lo vas a ver acá, con su seguimiento.
            </p>
            <Link
              href="/catalogo"
              className="mt-6 flex h-14 w-full items-center justify-center rounded-2xl bg-emerald-600 text-base font-semibold text-white transition active:scale-[0.99]"
            >
              Ir al catálogo
            </Link>
          </section>
        ) : (
          <ul className="flex flex-col gap-3">
            {list.map((order) => (
              <li key={order.id}>
                <Link
                  href={`/pedidos/${order.code}`}
                  className="flex items-center gap-3 rounded-2xl border border-gray-100 bg-white p-4 shadow-sm shadow-gray-100 transition active:scale-[0.99]"
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-sm font-semibold text-gray-900">
                        {order.code}
                      </span>
                      <span
                        className={`rounded-full px-2 py-0.5 text-xs font-semibold ${
                          order.status === "confirmado" && !order.shopper_id
                            ? "bg-amber-50 text-amber-700"
                            : "bg-emerald-50 text-emerald-700"
                        }`}
                      >
                        {statusLabel(order.status, order.shopper_id)}
                      </span>
                    </div>
                    <p className="mt-1 truncate text-sm text-gray-500">
                      {formatOrderDate(order.created_at)}
                      {order.address_label ? ` · ${order.address_label}` : ""}
                    </p>
                  </div>
                  <span className="shrink-0 text-base font-semibold tabular-nums text-gray-900">
                    {formatMoney(order.total)}
                  </span>
                  <ChevronRight className="h-5 w-5 shrink-0 text-gray-300" aria-hidden="true" />
                </Link>
              </li>
            ))}
          </ul>
        )}
      </div>

      <BottomNav />
    </main>
  )
}
