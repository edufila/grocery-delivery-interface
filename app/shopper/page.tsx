import type { Metadata } from "next"
import Link from "next/link"
import { redirect } from "next/navigation"
import { ChevronRight, PackageSearch } from "lucide-react"

import { OrdersLiveRefresh } from "@/components/live-refresh"
import {
  formatMoney,
  formatOrderDate,
  SHOPPER_ROLES,
  STATUS_LABEL,
  type Order,
  type Role,
} from "@/lib/orders"
import { isSupabaseConfigured } from "@/lib/supabase/config"
import { createClient } from "@/lib/supabase/server"

export const metadata: Metadata = {
  title: "Panel del shopper · Gran Abasto Girasol",
}

type ShopperOrder = Pick<
  Order,
  "id" | "code" | "status" | "total" | "created_at" | "address_label" | "shopper_id"
>

export default async function ShopperPage() {
  if (!isSupabaseConfigured) redirect("/login")

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) redirect("/login?next=/shopper")

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .maybeSingle<{ role: Role }>()

  if (!profile || !SHOPPER_ROLES.includes(profile.role)) {
    return <SinPermiso rol={profile?.role ?? "cliente"} />
  }

  // RLS ya limita a disponibles + propios; acá solo los separamos.
  const { data: orders } = await supabase
    .from("orders")
    .select("id, code, status, total, created_at, address_label, shopper_id")
    .order("created_at", { ascending: false })
    .returns<ShopperOrder[]>()

  const todos = orders ?? []
  const mios = todos.filter((o) => o.shopper_id === user.id && o.status !== "entregado")
  const disponibles = todos.filter((o) => o.shopper_id === null && o.status !== "cancelado")
  const entregados = todos.filter((o) => o.shopper_id === user.id && o.status === "entregado")

  return (
    <main className="min-h-dvh bg-gray-50">
      <header className="border-b border-gray-100 bg-white">
        <div className="mx-auto max-w-md px-4 py-4">
          <h1 className="text-lg font-semibold text-gray-900">Panel del shopper</h1>
          <p className="text-sm text-gray-500">Entrás como {profile.role}</p>
        </div>
      </header>

      <OrdersLiveRefresh />

      <div className="mx-auto flex max-w-md flex-col gap-6 px-4 pb-16 pt-5">
        <Grupo titulo="En curso" vacio="No tenés pedidos tomados." pedidos={mios} />
        <Grupo
          titulo="Disponibles"
          vacio="No hay pedidos esperando. Cuando alguien compre, aparece acá."
          pedidos={disponibles}
        />
        {entregados.length > 0 && (
          <Grupo titulo="Entregados" vacio="" pedidos={entregados} apagado />
        )}
      </div>
    </main>
  )
}

function Grupo({
  titulo,
  vacio,
  pedidos,
  apagado,
}: {
  titulo: string
  vacio: string
  pedidos: ShopperOrder[]
  apagado?: boolean
}) {
  return (
    <section>
      <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-gray-400">
        {titulo}
      </h2>

      {pedidos.length === 0 ? (
        <p className="rounded-2xl border border-dashed border-gray-200 bg-white px-4 py-6 text-center text-sm text-gray-500">
          {vacio}
        </p>
      ) : (
        <ul className="flex flex-col gap-2">
          {pedidos.map((order) => (
            <li key={order.id}>
              <Link
                href={`/shopper/${order.code}`}
                className={`flex items-center gap-3 rounded-2xl border border-gray-100 bg-white p-4 shadow-sm shadow-gray-100 transition active:scale-[0.99] ${
                  apagado ? "opacity-60" : ""
                }`}
              >
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-emerald-50">
                  <PackageSearch className="h-5 w-5 text-emerald-600" aria-hidden="true" />
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-sm font-semibold text-gray-900">
                      {order.code}
                    </span>
                    <span className="rounded-full bg-gray-100 px-2 py-0.5 text-xs font-semibold text-gray-600">
                      {STATUS_LABEL[order.status]}
                    </span>
                  </div>
                  <p className="mt-0.5 truncate text-sm text-gray-500">
                    {formatOrderDate(order.created_at)}
                    {order.address_label ? ` · ${order.address_label}` : ""}
                  </p>
                </div>
                <span className="shrink-0 text-sm font-semibold tabular-nums text-gray-900">
                  {formatMoney(order.total)}
                </span>
                <ChevronRight className="h-5 w-5 shrink-0 text-gray-300" aria-hidden="true" />
              </Link>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}

function SinPermiso({ rol }: { rol: string }) {
  return (
    <main className="flex min-h-dvh items-center bg-gray-50">
      <div className="mx-auto w-full max-w-md px-5 text-center">
        <h1 className="text-xl font-semibold text-gray-900">Esta zona es para shoppers</h1>
        <p className="mt-3 text-sm leading-relaxed text-gray-600">
          Tu cuenta figura como <span className="font-semibold">{rol}</span>. Para entrar acá hace
          falta el rol shopper, admin o dev.
        </p>
        <p className="mt-3 text-sm leading-relaxed text-gray-500">
          Se cambia desde Supabase, en la tabla <code className="text-xs">profiles</code>.
        </p>
        <Link
          href="/"
          className="mt-6 flex h-14 w-full items-center justify-center rounded-2xl bg-emerald-600 text-base font-semibold text-white"
        >
          Ir al inicio
        </Link>
      </div>
    </main>
  )
}
