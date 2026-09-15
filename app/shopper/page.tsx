import type { Metadata } from "next"
import Link from "next/link"
import { redirect } from "next/navigation"
import { ArrowLeft, ChevronRight, PackageSearch } from "lucide-react"

import { OrdersLiveRefresh } from "@/components/live-refresh"
import { AvisoPedidos } from "@/components/shopper/aviso-pedidos"
import { pageTitle } from "@/lib/brand"
import {
  formatMoney,
  formatOrderDate,
  haceCuanto,
  SHOPPER_ROLES,
  STATUS_LABEL,
  type Order,
  type Role,
} from "@/lib/orders"
import { isSupabaseConfigured } from "@/lib/supabase/config"
import { createClient } from "@/lib/supabase/server"

export const metadata: Metadata = {
  title: pageTitle("Panel del shopper"),
}

type ShopperOrder = Pick<
  Order,
  | "id"
  | "code"
  | "status"
  | "total"
  | "created_at"
  | "address_label"
  | "shopper_id"
  | "payment_required"
  | "payment_verified_at"
>

export default async function ShopperPage() {
  if (!isSupabaseConfigured) redirect("/login")

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) redirect("/login?next=/shopper")

  /**
   * El rol y los pedidos a la vez. Los pedidos no hace falta esperarlos al rol:
   * si no es shopper se descartan sin mostrarse, y la RLS igual no le habría
   * dado nada que no pueda ver.
   */
  const [{ data: profile }, { data: orders }] = await Promise.all([
    supabase.from("profiles").select("role").eq("id", user.id).maybeSingle<{ role: Role }>(),
    supabase
      .from("orders")
      .select(
        "id, code, status, total, created_at, address_label, shopper_id, payment_required, payment_verified_at",
      )
      /**
       * Los suyos y los sin dueño, nada más.
       *
       * A un shopper la RLS ya le da solo eso. A admin y dev les da todos los
       * pedidos del sistema -- los de cada shopper, de siempre --, y esta
       * pantalla los bajaba enteros para después tirar casi todos. Crece con
       * cada pedido que se hace.
       */
      .or(`shopper_id.eq.${user.id},shopper_id.is.null`)
      .order("created_at", { ascending: false })
      .limit(300)
      .returns<ShopperOrder[]>(),
  ])

  if (!profile || !SHOPPER_ROLES.includes(profile.role)) {
    return <SinPermiso rol={profile?.role ?? "cliente"} />
  }

  const todos = orders ?? []
  const mios = todos.filter((o) => o.shopper_id === user.id && o.status !== "entregado")
  /**
   * Disponible es sin shopper, sin cancelar y con el pago resuelto.
   *
   * A un shopper la RLS ya le esconde lo que no está pagado. Pero a admin y dev
   * les deja leer todos los pedidos -- lo necesita el panel --, y aquí les
   * aparecían como disponibles pedidos que esperan pago, que la base no les
   * deja tomar: tocaban y no pasaba nada.
   */
  const disponibles = todos.filter(
    (o) =>
      o.shopper_id === null &&
      o.status === "confirmado" &&
      (o.payment_required === false || o.payment_verified_at != null),
  )
  const entregados = todos.filter((o) => o.shopper_id === user.id && o.status === "entregado")

  /**
   * Lo entregado esta semana, contando desde el lunes. Se calcula sobre los
   * pedidos que ya se trajeron: no cuesta una consulta más.
   *
   * Por qué la semana y no el total: es el período con el que se le paga a
   * alguien, y es lo que un shopper quiere saber sin ponerse a contar.
   *
   * El lunes es el de Venezuela: el servidor corre en UTC, y contado allá la
   * semana empezaba el domingo a las 8 de la noche.
   */
  const lunes = lunesEnVenezuela(new Date())
  const deLaSemana = entregados.filter((o) => new Date(o.created_at) >= lunes)
  const vendidoEnLaSemana = deLaSemana.reduce((suma, o) => suma + Number(o.total ?? 0), 0)

  return (
    <main className="min-h-dvh bg-gray-50">
      <header className="pt-barra-estado border-b border-gray-100 bg-white">
        <div className="mx-auto flex max-w-md items-center gap-2 px-4 py-4">
          <Link
            href="/perfil"
            aria-label="Volver al perfil"
            className="-ml-2 flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-gray-600 transition active:bg-gray-100"
          >
            <ArrowLeft className="h-5 w-5" aria-hidden="true" />
          </Link>
          <div>
            <h1 className="text-lg font-semibold text-gray-900">Panel del shopper</h1>
            <p className="text-sm text-gray-500">Entras como {profile.role}</p>
          </div>
        </div>
      </header>

      <OrdersLiveRefresh />

      <div className="mx-auto flex max-w-md flex-col gap-6 px-4 pb-16 pt-5">
        {/* Solo cuando ya entregó algo: a quien empieza, un cero grande no le
            dice nada y le ocupa la pantalla. */}
        {entregados.length > 0 && (
          <section className="grid grid-cols-3 gap-2">
            <Dato valor={String(deLaSemana.length)} etiqueta="esta semana" />
            <Dato valor={formatMoney(vendidoEnLaSemana)} etiqueta="vendido" />
            <Dato valor={String(entregados.length)} etiqueta="en total" />
          </section>
        )}

        <AvisoPedidos userId={user.id} />
        <Grupo titulo="En curso" vacio="No tienes pedidos tomados." pedidos={mios} />
        <Grupo
          titulo="Disponibles"
          vacio="No hay pedidos esperando. Cuando alguien compre, aparece aquí."
          pedidos={disponibles}
          destacado
        />
        {/* Los últimos diez: la lista entera crecía para siempre, y lo que se
            necesita aquí es lo reciente. El total ya está en el resumen. */}
        {entregados.length > 0 && (
          <Grupo
            titulo="Entregados"
            vacio=""
            pedidos={entregados.slice(0, 10)}
            apagado
          />
        )}
      </div>
    </main>
  )
}

/**
 * Un número del resumen. El valor grande y la etiqueta chica debajo: se lee de
 * un vistazo, que es para lo que sirve.
 */
function Dato({ valor, etiqueta }: { valor: string; etiqueta: string }) {
  return (
    <div className="rounded-2xl border border-gray-100 bg-white px-3 py-3 text-center">
      <p className="text-lg font-bold tabular-nums text-gray-900">{valor}</p>
      <p className="mt-0.5 text-xs leading-tight text-gray-500">{etiqueta}</p>
    </div>
  )
}

function Grupo({
  titulo,
  vacio,
  pedidos,
  apagado,
  destacado,
}: {
  titulo: string
  vacio: string
  pedidos: ShopperOrder[]
  apagado?: boolean
  /** Lo que se puede tomar ya: se marca para que salte a la vista. */
  destacado?: boolean
}) {
  const hayParaTomar = destacado && pedidos.length > 0

  return (
    <section>
      <h2 className="mb-2 flex items-center gap-2 text-sm font-semibold uppercase tracking-wide text-gray-500">
        {titulo}
        {hayParaTomar && (
          <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-600 px-2 py-0.5 text-xs font-bold normal-case tracking-normal text-white">
            <span className="relative flex h-1.5 w-1.5" aria-hidden="true">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-white opacity-75" />
              <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-white" />
            </span>
            {pedidos.length}
          </span>
        )}
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
                className={`flex items-center gap-3 rounded-2xl border bg-white p-4 shadow-sm shadow-gray-900/[0.06] transition active:scale-[0.99] ${
                  apagado ? "border-gray-100 opacity-60" : destacado ? "border-emerald-200 ring-1 ring-emerald-100" : "border-gray-100"
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
                      {/* "Confirmado" no le dice nada a quien busca qué tomar. */}
                      {destacado ? "Nuevo" : STATUS_LABEL[order.status]}
                    </span>
                  </div>
                  <p className="mt-0.5 truncate text-sm text-gray-500">
                    {/* Para lo que se puede tomar, cuánto lleva esperando dice más
                        que la hora: un pedido de hace cuarenta minutos va primero. */}
                    {destacado ? `Entró ${haceCuanto(order.created_at)}` : formatOrderDate(order.created_at)}
                    {order.address_label ? ` · ${order.address_label}` : ""}
                  </p>
                </div>
                <span className="shrink-0 text-sm font-semibold tabular-nums text-gray-900">
                  {formatMoney(order.total)}
                </span>
                <ChevronRight className="h-5 w-5 shrink-0 text-gray-400" aria-hidden="true" />
              </Link>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}

/** El lunes de esta semana a medianoche, en hora de Venezuela (UTC-4, sin horario de verano). */
function lunesEnVenezuela(ahora: Date) {
  const OFFSET_MS = 4 * 60 * 60 * 1000
  const local = new Date(ahora.getTime() - OFFSET_MS)
  const diasDesdeLunes = (local.getUTCDay() + 6) % 7
  const lunesLocal = Date.UTC(
    local.getUTCFullYear(),
    local.getUTCMonth(),
    local.getUTCDate() - diasDesdeLunes,
  )
  return new Date(lunesLocal + OFFSET_MS)
}

function SinPermiso({ rol }: { rol: string }) {
  return (
    <main className="flex min-h-dvh items-center bg-gray-50">
      <div className="mx-auto w-full max-w-md px-5 text-center">
        <h1 className="text-xl font-semibold text-gray-900">Esta zona es para shoppers</h1>
        <p className="mt-3 text-sm leading-relaxed text-gray-600">
          Tu cuenta figura como <span className="font-semibold">{rol}</span>. Para entrar aquí hace
          falta el rol shopper, admin o dev.
        </p>
        {/* Antes decía que se cambiaba en la tabla profiles de Supabase: una
            instrucción para programadores, vista por clientes que llegaban aquí
            por un enlace. Los roles ya se reparten desde Administración. */}
        <p className="mt-3 text-sm leading-relaxed text-gray-500">
          Si trabajas con nosotros, pídele a un administrador que te dé acceso.
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
