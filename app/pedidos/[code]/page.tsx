import type { Metadata } from "next"
import Link from "next/link"
import { notFound, redirect } from "next/navigation"
import { ArrowLeft, MapPin, MessageCircle } from "lucide-react"

import { OrderLiveRefresh } from "@/components/live-refresh"
import { AvisamePedido } from "@/components/tracking/avisame-pedido"
import { FestejoPedido } from "@/components/tracking/festejo-pedido"
import { EstadoHero } from "@/components/tracking/estado-hero"
import { DeliveryCodeCard } from "@/components/tracking/delivery-code-card"
import { MapaSeguimiento } from "@/components/tracking/mapa-seguimiento"
import { CancelOrder } from "@/components/tracking/cancel-order"
import { PagarPedido } from "@/components/tracking/pagar-pedido"
import { RepetirPedido } from "@/components/tracking/repetir-pedido"
import { OrderChat } from "@/components/tracking/order-chat"
import { ShopperCard, type OrderShopper } from "@/components/tracking/shopper-card"
import {
  formatMoney,
  formatOrderDate,
  PAYMENT_LABEL,
  SUBSTITUTION_LABEL,
  type Order,
  type OrderItem,
  ZONA_HORARIA,
} from "@/lib/orders"
import { pageTitle } from "@/lib/brand"
import { soportePublico } from "@/lib/datos-publicos"
import { cuandoLlega } from "@/lib/horario"
import { formatBolivares } from "@/lib/pagos"
import { isSupabaseConfigured } from "@/lib/supabase/config"
import { createClient } from "@/lib/supabase/server"
import { fotoLigera } from "@/lib/fotos"

export const metadata: Metadata = {
  title: pageTitle("Seguimiento del pedido"),
}

export default async function PedidoPage({
  params,
  searchParams,
}: {
  params: Promise<{ code: string }>
  searchParams: Promise<{ nuevo?: string }>
}) {
  if (!isSupabaseConfigured) redirect("/login")

  const { code } = await params
  const { nuevo } = await searchParams
  const supabase = await createClient()

  // La sesión y el pedido a la vez: esta es la pantalla que se rearma sola con
  // cada cambio en vivo, y esperar una para pedir la otra se pagaba cada vez.
  const [
    {
      data: { user },
    },
    { data: order },
  ] = await Promise.all([
  supabase.auth.getUser(),
  supabase.from("orders").select("*").eq("code", code.toUpperCase()).maybeSingle<Order>(),
])

if (!user) redirect(`/login?next=/pedidos/${code}`)

/**
 * Tiene que ser suyo, y eso se mira aquí y no se le deja a la RLS.
 *
 * Para un cliente la política ya limita a sus pedidos. Pero a admin y dev les
 * deja leer todos, y a un shopper los disponibles: abriendo el enlace de un
 * pedido ajeno veían el seguimiento como si fuera suyo, con el chat del
 * cliente y la pantalla de pagar. Para mirar un pedido de otro está el
 * detalle en Administración.
 */
if (!order || order.user_id !== user.id) notFound()

/**
 * Lo que falta, todo junto.
 *
 * Dependen del pedido pero no entre sí, y encadenadas eran
 * viajes de ida y vuelta a Supabase uno detrás de otro. Esta es la pantalla
 * que el cliente deja abierta mirando por dónde viene su pedido, y que se
 * rearma sola cada vez que algo cambia: cada viaje de más se paga muchas
 * veces. Juntas cuestan lo que la más lenta.
 */
const [
  { data: items },
  { data: shopperRows },
  { data: deliveryCode },
  { data: metodo },
  { data: fotos },
  soporte,
] = await Promise.all([
    supabase.from("order_items").select("*").eq("order_id", order.id).returns<OrderItem[]>(),
    // Solo nombre, foto y @: no expone teléfono ni correo del shopper.
    supabase.rpc("order_shopper", { p_order_id: order.id }),
    // Solo el dueño del pedido puede leerlo: el shopper no tiene política aquí.
    supabase
      .from("order_delivery_codes")
      .select("code, attempts")
      .eq("order_id", order.id)
      .maybeSingle<{ code: string; attempts: number }>(),
    // Solo a dónde pagar. Si el pedido espera pago o no, lo dice el pedido:
    // ver `hayQuePagar` abajo.
    supabase
      .from("payment_methods")
      .select("instructions")
      .eq("id", order.payment_method)
      .maybeSingle<{ instructions: string | null }>(),
    // Las fotos del catálogo del abasto: el renglón del pedido no la guarda.
    supabase
      .from("products")
      .select("id, image")
      .eq("store_id", order.store_id ?? "girasol")
      .returns<{ id: string; image: string | null }[]>(),
    // Guardado un minuto y igual para todos: no suma un viaje por visita.
    soportePublico(),
  ])

  const imagenes = new Map((fotos ?? []).map((f) => [f.id, f.image]))

  const lines = items ?? []
  const cancelled = order.status === "cancelado"
  const shopper = (shopperRows as OrderShopper[] | null)?.[0] ?? null

  /**
   * Si este pedido espera pago lo dice el pedido, no el método.
   *
   * Antes se miraba `needs_reference` del método tal como está hoy. Eso deja
   * dos trampas, porque la base decide con `payment_required`, que se guardó al
   * pedir y ya no cambia: si alguien apaga "pide referencia" en Pago Móvil, un
   * cliente con el pedido detenido pierde la pantalla de pagar y se queda
   * trabado sin forma de reportar nada; y al revés, un pedido en efectivo
   * empezaría a pedir pago por un cambio de configuración que no le tocaba.
   */
  const hayQuePagar =
    !cancelled && order.status !== "entregado" && order.payment_required !== false
  const esperaPago = hayQuePagar && order.payment_verified_at == null

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

      <FestejoPedido nuevo={nuevo === "1"} />

      <OrderLiveRefresh
        orderId={order.id}
        status={order.status}
        shopperId={order.shopper_id}
        pagoVerificado={order.payment_verified_at}
      />

      <div className="mx-auto max-w-lg space-y-4 px-4 pb-10 pt-4">
        <EstadoHero order={order} esperaPago={esperaPago} />

        {order.entregar_desde && order.status !== "entregado" && !cancelled && (
          <p className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
            <span className="font-semibold">Entrega programada:</span> llega{" "}
            {cuandoLlega(order.entregar_desde)} o poco después.
          </p>
        )}

        {/* Solo con el pedido cerrado, y justo debajo del estado: antes estaba al
            fondo de la página, debajo del detalle y los totales. Mientras está en
            curso lo que quiere el cliente es seguirlo, no arrancar otro igual. */}
        {(order.status === "entregado" || cancelled) && (
          <RepetirPedido
            items={lines.map((item) => ({ product_id: item.product_id, qty: item.qty }))}
          />
        )}

        {/* Justo debajo del estado mientras no esté pagado: es lo único que la
            persona puede hacer para que el pedido avance. Antes quedaba debajo
            del aviso y de un mapa que, sin shopper todavía, solo mostraba su
            propia casa. */}
        {hayQuePagar && (
          <PagarPedido
            orderId={order.id}
            total={order.final_total ?? order.total}
            montoVes={order.amount_ves}
            instrucciones={metodo?.instructions?.trim() ?? ""}
            referencia={order.payment_reference}
            verificado={order.payment_verified_at != null}
          />
        )}

        {/* Mientras hay algo por pasar: con el pedido cerrado no queda qué avisar. */}
        {!cancelled && order.status !== "entregado" && <AvisamePedido />}

        {/* Entregado, el mapa ya no dice nada; esperando pago, tampoco -- nadie
            salió todavía y solo mostraría la casa del cliente. */}
        {!cancelled && order.status !== "entregado" && !esperaPago && (
          <MapaSeguimiento
            orderId={order.id}
            destino={
              order.address_lat != null && order.address_lng != null
                ? { lat: order.address_lat, lng: order.address_lng }
                : null
            }
            shopper={
              order.shopper_lat != null && order.shopper_lng != null
                ? { lat: order.shopper_lat, lng: order.shopper_lng }
                : null
            }
            enVivo
            enCamino={order.status === "en_camino"}
          />
        )}

        {shopper && !cancelled && <ShopperCard shopper={shopper} />}

        {/* El chat con el shopper, aparte y cerca de su tarjeta. Antes vivía
            dentro de una lista numerada de estados que repetía lo que ya dice la
            tarjeta grande de arriba. */}
        {order.shopper_id && !cancelled && order.status !== "entregado" && (
          <section className="rounded-2xl border border-gray-100 bg-white p-4">
            <p className="text-sm font-semibold text-gray-900">¿Algo que coordinar?</p>
            <p className="mt-0.5 text-sm leading-relaxed text-gray-500">
              Si falta un producto o no encuentra la casa, tu shopper te escribe por aquí.
            </p>
            <OrderChat
              orderId={order.id}
              userId={user.id}
              title="Chat con tu shopper"
              respuestasRapidas={
                order.status === "en_camino"
                  ? ["Ya bajo", "Espérame un momento", "Toca el timbre"]
                  : ["Sí, otra marca está bien", "Mejor no lo lleves", "Gracias"]
              }
              subtitle={shopper?.full_name ?? "Sobre este pedido"}
            />
          </section>
        )}

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
                  timeZone: ZONA_HORARIA,
                  hour: "numeric",
                  minute: "2-digit",
                })}
              </p>
            </div>
          </section>
        )}

        <section className="rounded-2xl border border-gray-100 bg-white p-5">
          <h2 className="mb-3 text-base font-semibold text-gray-900">
            Tu pedido{" "}
            <span className="text-sm font-normal text-gray-500">
              ({lines.reduce((n, i) => n + i.qty, 0)}{" "}
              {lines.reduce((n, i) => n + i.qty, 0) === 1 ? "artículo" : "artículos"})
            </span>
          </h2>
          <ul className="flex flex-col gap-3">
            {lines.map((item) => {
              const faltante = item.status === "faltante"
              const llevadas = item.final_qty ?? item.qty
              const ajustado = item.status === "ajustado" && llevadas !== item.qty

              return (
                <li key={item.id} className="flex items-start gap-3">
                  <img
                    src={fotoLigera(imagenes.get(item.product_id)) || "/placeholder.svg"}
                    alt=""
                    loading="lazy"
                    decoding="async"
                    className={`h-12 w-12 shrink-0 rounded-xl bg-gray-50 object-cover ${faltante ? "opacity-40 grayscale" : ""}`}
                  />
                  <div className="min-w-0 flex-1">
                    <p
                      className={`text-sm font-medium ${
                        faltante ? "text-gray-500 line-through" : "text-gray-900"
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
                      faltante ? "text-gray-500 line-through" : "text-gray-900"
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
                <div className="flex justify-between text-gray-500">
                  <dt>Estimado al confirmar</dt>
                  <dd className="tabular-nums line-through">{formatMoney(order.total)}</dd>
                </div>
                <div className="flex justify-between border-t border-gray-100 pt-2 text-base font-semibold text-gray-900">
                  <dt>Total</dt>
                  <dd className="text-right tabular-nums">
                    {formatMoney(order.final_total)}
                    <TotalEnBolivares order={order} dolares={order.final_total} />
                  </dd>
                </div>
                <p className="text-xs leading-relaxed text-gray-500">
                  El monto cambió porque no estaba todo disponible. Solo se cobra lo que el shopper
                  llevó.
                </p>
              </>
            ) : (
              <div className="flex justify-between border-t border-gray-100 pt-2 text-base font-semibold text-gray-900">
                <dt>Total</dt>
                <dd className="text-right tabular-nums">
                  {formatMoney(order.final_total ?? order.total)}
                  <TotalEnBolivares order={order} dolares={order.final_total ?? order.total} />
                </dd>
              </div>
            )}
          </dl>
        </section>

        {order.status === "confirmado" && !order.shopper_id && (
          <CancelOrder
            orderId={order.id}
            pagoEncima={order.payment_reported_at != null || order.payment_verified_at != null}
          />
        )}


        <section className="rounded-2xl border border-gray-100 bg-white p-5">
          <h2 className="mb-3 text-base font-semibold text-gray-900">Detalles</h2>
          <dl className="flex flex-col gap-3 text-sm">
            <div className="flex items-start gap-3">
              <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-gray-400" aria-hidden="true" />
              <div>
                <dt className="text-xs font-medium uppercase tracking-wide text-gray-500">
                  Entrega
                </dt>
                <dd className="text-gray-900">
                  {/* Vacía si la persona borró sus datos (0050). */}
                  {order.address_label || order.address_detail
                    ? `${order.address_label ?? ""}${order.address_detail ? ` · ${order.address_detail}` : ""}`
                    : "Dirección borrada"}
                </dd>
              </div>
            </div>
            <div>
              <dt className="text-xs font-medium uppercase tracking-wide text-gray-500">Pago</dt>
              <dd className="text-gray-900">
                {PAYMENT_LABEL[order.payment_method] ?? order.payment_method}
              </dd>
            </div>
            <div>
              <dt className="text-xs font-medium uppercase tracking-wide text-gray-500">
                Si falta un producto
              </dt>
              <dd className="text-gray-900">
                {SUBSTITUTION_LABEL[order.substitution_policy] ?? order.substitution_policy}
              </dd>
            </div>
          </dl>
        </section>

        {/* El chat es con el shopper, y solo existe mientras hay uno. Para lo
            demás (un cobro, una devolución, un pedido que no llega) hace falta
            alguien del equipo. Sin número cargado no sale. */}
        {soporte && (
          <a
            href={`https://wa.me/${soporte}?text=${encodeURIComponent(`Hola, necesito ayuda con mi pedido ${order.code}.`)}`}
            target="_blank"
            rel="noopener noreferrer"
            className="flex min-h-12 items-center justify-center gap-2 rounded-2xl border border-gray-200 bg-white px-4 text-sm font-semibold text-gray-700 transition active:scale-[0.99]"
          >
            <MessageCircle className="h-4 w-4 text-emerald-600" aria-hidden="true" />
            ¿Un problema con este pedido? Escríbenos
          </a>
        )}
      </div>
    </main>
  )
}

/**
 * El total en bolívares, debajo del de dólares.
 *
 * Con la tasa congelada en el pedido y no con la de hoy: es la que se usó para
 * cotizar y la que decide cuánto se pagó. Si el pedido cobra en bolívares, el
 * monto exacto con sus céntimos únicos manda mientras el total no cambió; si
 * cambió por faltantes, se recalcula con la misma tasa.
 */
function TotalEnBolivares({ order, dolares }: { order: Order; dolares: number }) {
  const tasa = order.rate_ves != null ? Number(order.rate_ves) : null
  if (!tasa) return null

  const cambio = order.final_total != null && order.final_total !== order.total
  const bolivares =
    !cambio && order.amount_ves != null ? Number(order.amount_ves) : Number(dolares) * tasa

  return (
    <span className="block text-xs font-medium text-gray-500">
      Bs {formatBolivares(bolivares)}
    </span>
  )
}
