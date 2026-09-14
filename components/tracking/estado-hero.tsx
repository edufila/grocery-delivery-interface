import { Bike, PartyPopper, Search, ShoppingBasket, UserCheck, Wallet, XCircle } from "lucide-react"
import type { LucideIcon } from "lucide-react"

import { STATUS_FLOW, statusDescription, statusLabel, type Order } from "@/lib/orders"

type Vista = {
  titulo: string
  detalle: string
  Icon: LucideIcon
  tono: "verde" | "fiesta" | "ambar" | "gris"
}

/**
 * Qué se le dice arriba de todo al cliente.
 *
 * El pago va antes que el estado: un pedido "confirmado" que espera pago no está
 * buscando shopper -- la base no se lo muestra a ninguno hasta que el pago esté
 * verificado --, así que decir "Buscando shopper" ahí sería mentirle mientras
 * el pedido no avanza por algo que solo él puede destrabar.
 */
function vista(order: Order, esperaPago: boolean): Vista {
  if (order.status === "cancelado") {
    return {
      titulo: "Pedido cancelado",
      detalle: order.cancel_reason ? `Motivo: ${order.cancel_reason}` : "Este pedido no sigue.",
      Icon: XCircle,
      tono: "gris",
    }
  }

  if (esperaPago) {
    return order.payment_reference
      ? {
          titulo: "Verificando tu pago",
          detalle: "Apenas lo confirmemos, un shopper sale a hacer tu compra.",
          Icon: Wallet,
          tono: "ambar",
        }
      : {
          titulo: "Falta tu pago",
          detalle: "Paga y manda la referencia aquí abajo para que tu pedido arranque.",
          Icon: Wallet,
          tono: "ambar",
        }
  }

  const iconos: Record<string, LucideIcon> = {
    confirmado: order.shopper_id ? UserCheck : Search,
    preparando: ShoppingBasket,
    en_camino: Bike,
    entregado: PartyPopper,
  }

  if (order.status === "entregado") {
    return {
      titulo: "¡Llegó tu pedido!",
      detalle: "Gracias por comprar con nosotros. Que lo disfrutes.",
      Icon: PartyPopper,
      tono: "fiesta",
    }
  }

  return {
    titulo: statusLabel(order.status, order.shopper_id),
    detalle: statusDescription(order.status, order.shopper_id),
    Icon: iconos[order.status] ?? Search,
    tono: "verde",
  }
}

/**
 * El claro de cada degradado es el tono 600 o más oscuro, que es donde el texto
 * blanco todavía pasa 4,5 a 1. Un 500 se ve más alegre y no se lee.
 */
const FONDO: Record<Vista["tono"], string> = {
  verde: "from-emerald-600 via-emerald-700 to-emerald-800 shadow-emerald-900/20",
  fiesta: "from-emerald-600 via-emerald-700 to-teal-800 shadow-emerald-900/20",
  ambar: "from-amber-700 via-amber-800 to-amber-900 shadow-amber-900/20",
  gris: "from-gray-600 via-gray-700 to-gray-800 shadow-gray-900/20",
}

const PASOS = ["Confirmado", "Comprando", "En camino", "Entregado"]

/**
 * La tarjeta grande de arriba en el seguimiento: dónde está el pedido, de un
 * vistazo, con una barra de avance.
 *
 * Antes el estado vivía en una lista numerada debajo del mapa, del pago y del
 * código de entrega: quien abría la pantalla para saber "¿ya viene?" tenía que
 * bajar a buscarlo. La lista sigue más abajo, con el chat; esto la resume.
 */
export function EstadoHero({ order, esperaPago }: { order: Order; esperaPago: boolean }) {
  const { titulo, detalle, Icon, tono } = vista(order, esperaPago)
  const cancelado = order.status === "cancelado"
  const terminado = order.status === "entregado"
  // Esperando pago el avance no empezó: la barra se queda vacía en vez de
  // marcar un primer paso que todavía no es cierto.
  const paso = esperaPago ? -1 : STATUS_FLOW.indexOf(order.status)

  return (
    <section
      className={`relative animate-[entra_0.35s_ease-out] overflow-hidden rounded-3xl bg-gradient-to-br p-5 text-white shadow-lg ${FONDO[tono]}`}
      aria-live="polite"
    >
      <span
        className="pointer-events-none absolute -right-8 -top-10 h-36 w-36 rounded-full bg-white/10"
        aria-hidden="true"
      />

      <div className="relative flex items-start gap-4">
        <span className="relative flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-white/15 ring-1 ring-white/25">
          {/* El pulso solo mientras algo está pasando de verdad: en un pedido
              entregado o cancelado ya no hay nada que esperar. */}
          {!cancelado && !terminado && (
            <span
              className="absolute inset-0 animate-ping rounded-2xl bg-white/20 [animation-duration:2s]"
              aria-hidden="true"
            />
          )}
          <Icon className="relative h-7 w-7" aria-hidden="true" />
        </span>
        <div className="min-w-0 pt-0.5">
          <h2 className="text-xl font-bold leading-tight tracking-tight text-balance">{titulo}</h2>
          <p className="mt-1 text-sm leading-relaxed text-white">{detalle}</p>
        </div>
      </div>

      {!cancelado && (
        <div className="relative mt-5">
          <div className="flex gap-1.5" aria-hidden="true">
            {STATUS_FLOW.map((status, index) => (
              <span
                key={status}
                className="relative h-1.5 flex-1 overflow-hidden rounded-full bg-white/25"
              >
                <span
                  className={`absolute inset-y-0 left-0 rounded-full bg-white ${
                    index <= paso ? "w-full" : "w-0"
                  } ${index === paso && !terminado ? "animate-pulse" : ""}`}
                />
              </span>
            ))}
          </div>
          <p className="sr-only">
            {paso < 0 ? "Todavía sin empezar" : `Paso ${paso + 1} de ${STATUS_FLOW.length}`}
          </p>
          <div
            className="mt-2 grid grid-cols-4 gap-1.5 text-[11px] font-medium text-white"
            aria-hidden="true"
          >
            {PASOS.map((nombre) => (
              <span key={nombre} className="truncate">
                {nombre}
              </span>
            ))}
          </div>
        </div>
      )}
    </section>
  )
}
