import type { Metadata } from "next"
import Link from "next/link"
import { redirect } from "next/navigation"
import { ChevronRight, ShoppingBasket } from "lucide-react"

import { BottomNav } from "@/components/bottom-nav"
import { OrdersLiveRefresh } from "@/components/live-refresh"
import { pageTitle } from "@/lib/brand"
import { formatMoney, formatOrderDate, statusLabel, type Order } from "@/lib/orders"
import { isSupabaseConfigured } from "@/lib/supabase/config"
import { createClient } from "@/lib/supabase/server"
import { cuandoLlega } from "@/lib/horario"

export const metadata: Metadata = {
  title: pageTitle("Pedidos"),
}

type Fila = Pick<
  Order,
  | "id"
  | "code"
  | "status"
  | "total"
  | "final_total"
  | "created_at"
  | "address_label"
  | "shopper_id"
  | "payment_required"
  | "payment_verified_at"
  | "payment_reference"
  | "store_id"
  | "entregar_desde"
>

/**
 * La etiqueta de cada pedido, con el color de lo que significa.
 *
 * Antes todo lo que no fuera "buscando shopper" iba en verde, cancelado
 * incluido, y un pedido esperando pago decía "Buscando shopper" aunque ningún
 * shopper lo puede ver hasta que el pago esté confirmado.
 */
function etiqueta(o: Fila): { texto: string; clase: string; vivo: boolean } {
  if (o.status === "cancelado") {
    return { texto: "Cancelado", clase: "bg-rose-50 text-rose-700", vivo: false }
  }
  if (o.status === "entregado") {
    return { texto: "Entregado", clase: "bg-gray-100 text-gray-700", vivo: false }
  }
  if (o.payment_required !== false && o.payment_verified_at == null) {
    return {
      texto: o.payment_reference ? "Verificando pago" : "Falta tu pago",
      clase: "bg-amber-50 text-amber-800",
      vivo: false,
    }
  }
  return { texto: statusLabel(o.status, o.shopper_id), clase: "bg-emerald-50 text-emerald-700", vivo: true }
}

function Grupo({
  titulo,
  pedidos,
  tiendas,
}: {
  titulo: string
  pedidos: Fila[]
  tiendas: Map<string, string>
}) {
  return (
    <section>
      <h2 className="mb-2 px-1 text-sm font-semibold text-gray-500">{titulo}</h2>
      <ul className="flex flex-col gap-3">
        {pedidos.map((order) => {
          const { texto, clase, vivo } = etiqueta(order)
          return (
            <li key={order.id}>
              <Link
                href={`/pedidos/${order.code}`}
                className="flex items-center gap-3 rounded-2xl border border-gray-100 bg-white p-4 shadow-sm shadow-gray-900/[0.06] transition active:scale-[0.99]"
              >
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-sm font-semibold text-gray-900">
                      {(order.store_id && tiendas.get(order.store_id)) || `Pedido ${order.code}`}
                    </span>
                    <span
                      className={`inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-xs font-semibold ${clase}`}
                    >
                      {vivo && (
                        <span className="relative flex h-1.5 w-1.5" aria-hidden="true">
                          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-500 opacity-75" />
                          <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-emerald-600" />
                        </span>
                      )}
                      {texto}
                    </span>
                  </div>
                  <p className="mt-1 truncate text-sm text-gray-500">
                    <span className="font-mono">{order.code}</span> ·{" "}
                    {/* Programado y en curso: importa cuándo llega, no cuándo se pidió. */}
                    {order.entregar_desde && order.status !== "entregado" && order.status !== "cancelado"
                      ? `llega ${cuandoLlega(order.entregar_desde)}`
                      : formatOrderDate(order.created_at)}
                  </p>
                </div>
                <span className="shrink-0 text-base font-semibold tabular-nums text-gray-900">
                  {formatMoney(order.final_total ?? order.total)}
                </span>
                <ChevronRight className="h-5 w-5 shrink-0 text-gray-400" aria-hidden="true" />
              </Link>
            </li>
          )
        })}
      </ul>
    </section>
  )
}

export default async function PedidosPage() {
  if (!isSupabaseConfigured) redirect("/login")

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) redirect("/login?next=/pedidos")

  // Los abastos junto con los pedidos: cada renglón dice de dónde es, que es lo
  // primero que uno recuerda de un pedido, antes que el código o la fecha.
  const [{ data: orders }, { data: locales }] = await Promise.all([
    supabase
      .from("orders")
      .select(
        "id, code, status, total, final_total, created_at, address_label, shopper_id, payment_required, payment_verified_at, payment_reference, store_id, entregar_desde",
      )
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .returns<Fila[]>(),
    supabase.from("stores").select("id, name").returns<{ id: string; name: string }[]>(),
  ])

  const tiendas = new Map((locales ?? []).map((t) => [t.id, t.name]))
  const list = orders ?? []
  const enCurso = list.filter((o) => o.status !== "entregado" && o.status !== "cancelado")
  const anteriores = list.filter((o) => o.status === "entregado" || o.status === "cancelado")

  return (
    <main className="min-h-dvh bg-gray-50">
      <header className="pt-barra-estado border-b border-gray-100 bg-white">
        <div className="mx-auto max-w-md px-4 py-4">
          <h1 className="text-lg font-semibold text-gray-900">Tus pedidos</h1>
        </div>
      </header>

      <OrdersLiveRefresh />

      <div className="mx-auto flex max-w-md flex-col gap-6 px-4 pb-28 pt-4">
        {list.length === 0 ? (
          <section className="rounded-3xl border border-gray-100 bg-white p-8 text-center">
            <span className="mx-auto flex h-16 w-16 items-center justify-center rounded-3xl bg-gradient-to-br from-emerald-400 to-emerald-600 shadow-md shadow-emerald-900/15">
              <ShoppingBasket className="h-8 w-8 text-white" aria-hidden="true" />
            </span>
            <h2 className="mt-4 text-lg font-semibold text-gray-900">Todavía no pediste nada</h2>
            <p className="mt-2 text-sm leading-relaxed text-gray-500">
              Cuando hagas tu primer pedido lo vas a ver aquí, con su seguimiento en vivo.
            </p>
            {/* Al inicio y no a /catalogo: sin tienda elegida, el catálogo
                caía en un abasto que la persona no escogió. */}
            <Link
              href="/"
              className="mt-6 flex h-14 w-full items-center justify-center rounded-2xl bg-emerald-600 text-base font-semibold text-white transition active:scale-[0.99]"
            >
              Elegir un abasto
            </Link>
          </section>
        ) : (
          <>
            {enCurso.length > 0 && <Grupo titulo="En curso" pedidos={enCurso} tiendas={tiendas} />}
            {anteriores.length > 0 && <Grupo titulo="Anteriores" pedidos={anteriores} tiendas={tiendas} />}
          </>
        )}
      </div>

      <BottomNav />
    </main>
  )
}
