export type OrderStatus = "confirmado" | "preparando" | "en_camino" | "entregado" | "cancelado"

/**
 * Un pedido recién hecho está confirmado, pero para el cliente lo que importa
 * es que todavía no lo tomó nadie. El primer paso cambia de nombre según eso.
 */
export function statusLabel(status: OrderStatus, shopperId: string | null) {
  if (status === "confirmado") {
    return shopperId ? "Shopper asignado" : "Buscando shopper"
  }
  return STATUS_LABEL[status]
}

export function statusDescription(status: OrderStatus, shopperId: string | null) {
  switch (status) {
    case "confirmado":
      return shopperId
        ? "Ya tienes shopper asignado. En breve empieza tu compra."
        : "Estamos buscando un shopper disponible para tu pedido."
    case "preparando":
      return "Tu shopper está recorriendo el abasto."
    case "en_camino":
      return "Va en camino a tu dirección."
    case "entregado":
      return "Tu pedido fue entregado."
    default:
      return ""
  }
}

export const STATUS_LABEL: Record<OrderStatus, string> = {
  confirmado: "Confirmado",
  preparando: "Preparando tu compra",
  en_camino: "En camino",
  entregado: "Entregado",
  cancelado: "Cancelado",
}

/** Orden real del recorrido, para dibujar la línea de tiempo. */
export const STATUS_FLOW: OrderStatus[] = ["confirmado", "preparando", "en_camino", "entregado"]

export type Role = "cliente" | "shopper" | "admin" | "dev"

/** Quiénes pueden entrar a /shopper. dev existe para probar sin ser repartidor. */
export const SHOPPER_ROLES: Role[] = ["shopper", "admin", "dev"]

/** El siguiente estado al que puede pasar un pedido, o null si ya terminó. */
export function nextStatus(status: OrderStatus): OrderStatus | null {
  const index = STATUS_FLOW.indexOf(status)
  if (index === -1 || index >= STATUS_FLOW.length - 1) return null
  return STATUS_FLOW[index + 1]
}

export const NEXT_STATUS_ACTION: Record<string, string> = {
  preparando: "Empezar a preparar",
  en_camino: "Salir a entregar",
  entregado: "Marcar como entregado",
}

export type Address = {
  id: string
  label: string
  detail: string
  is_default: boolean
  lat: number | null
  lng: number | null
}

export type OrderItem = {
  id: string
  product_id: string
  name: string
  unit: string
  unit_price: number
  qty: number
  status: string
  final_qty: number | null
}

export const ITEM_STATUS_LABEL: Record<string, string> = {
  pendiente: "Sin revisar",
  ok: "Completo",
  ajustado: "Llevó menos",
  faltante: "No había",
}

export type Order = {
  id: string
  code: string
  /** Quién lo pidió. Solo el dueño del pedido y un admin pueden verlo. */
  user_id: string
  store_id: string | null
  shopper_id: string | null
  shopper_lat: number | null
  shopper_lng: number | null
  shopper_located_at: string | null
  /** A partir de cuándo se entrega (0051). Nulo o ausente = lo antes posible. */
  entregar_desde?: string | null
  address_label: string | null
  address_detail: string | null
  address_lat: number | null
  address_lng: number | null
  customer_note: string | null
  cancel_reason: string | null
  status: OrderStatus
  substitution_policy: "shopper" | "chat" | "none"
  payment_method: string
  subtotal: number
  service_fee: number
  delivery_fee: number
  /** Lo estimado al confirmar. */
  total: number
  /** Lo que se paga de verdad, una vez que el shopper revisó la cesta. */
  final_subtotal: number | null
  final_total: number | null
  /** La tasa con la que se cotizó, congelada al pedir. */
  rate_ves: number | null
  /** Lo exacto a pagar en bolívares, con céntimos únicos para identificarlo. */
  amount_ves: number | null
  /**
   * Si hay que confirmar el pago antes de que el pedido salga a buscar shopper.
   * Falso en el efectivo contra entrega, que se cobra en la puerta.
   *
   * Se guarda en el pedido y no se consulta al método cada vez: si mañana el
   * abasto cambia cómo cobra, los pedidos viejos siguen con la regla bajo la
   * que se hicieron.
   */
  payment_required: boolean
  /** Lo que el cliente reportó de su transferencia. */
  payment_reference: string | null
  payment_reported_at: string | null
  /** Cuándo el abasto confirmó que el dinero llegó. */
  payment_verified_at: string | null
  created_at: string
}

export const PAYMENT_LABEL: Record<string, string> = {
  "pago-movil": "Pago Móvil",
  zelle: "Zelle",
  efectivo: "Efectivo divisas",
  tarjeta: "Tarjeta",
}

export const SUBSTITUTION_LABEL: Record<string, string> = {
  shopper: "El shopper elige un reemplazo similar",
  chat: "Te contactamos por chat",
  none: "No reemplazar",
}

export function formatMoney(value: number) {
  return `$${Number(value).toFixed(2)}`
}

/**
 * La zona de todas las fechas y horas que se muestran.
 *
 * Sin ella, cada una sale en la zona del equipo que la dibuja. En el teléfono
 * eso es Venezuela, pero la mayoría de las pantallas se arman en el servidor, y
 * Vercel corre en UTC: un pedido hecho a la 1:57 de la tarde decía 5:57.
 */
export const ZONA_HORARIA = "America/Caracas"

export function formatOrderDate(iso: string) {
  return new Date(iso).toLocaleDateString("es-VE", {
    day: "numeric",
    month: "long",
    hour: "numeric",
    minute: "2-digit",
    timeZone: ZONA_HORARIA,
  })
}

/**
 * "hace 12 min", "hace 2 h", "hace 3 días": cuánto lleva algo esperando.
 *
 * Para lo que alguien está esperando la hora exacta dice poco; lo que importa
 * es si son dos minutos o cuarenta. `ahora` se pasa para poder probarlo y para
 * calcularlo en el teléfono, no en el servidor.
 */
export function haceCuanto(iso: string, ahora: number = Date.now()) {
  const minutos = Math.max(0, Math.floor((ahora - new Date(iso).getTime()) / 60_000))
  if (minutos < 1) return "recién"
  if (minutos < 60) return `hace ${minutos} min`
  const horas = Math.floor(minutos / 60)
  if (horas < 24) return `hace ${horas} h`
  const dias = Math.floor(horas / 24)
  return dias === 1 ? "hace 1 día" : `hace ${dias} días`
}

/** "2026-09-14" en Venezuela, para comparar días sin que la zona del servidor mande. */
export function diaEnVenezuela(fecha: Date | string) {
  return new Intl.DateTimeFormat("en-CA", { timeZone: ZONA_HORARIA }).format(new Date(fecha))
}
