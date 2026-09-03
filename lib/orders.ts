export type OrderStatus = "confirmado" | "preparando" | "en_camino" | "entregado" | "cancelado"

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
}

export type OrderItem = {
  id: string
  product_id: string
  name: string
  unit: string
  unit_price: number
  qty: number
}

export type Order = {
  id: string
  code: string
  shopper_id: string | null
  shopper_lat: number | null
  shopper_lng: number | null
  shopper_located_at: string | null
  address_label: string | null
  address_detail: string | null
  status: OrderStatus
  substitution_policy: "shopper" | "chat" | "none"
  payment_method: string
  subtotal: number
  service_fee: number
  delivery_fee: number
  total: number
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

export function formatOrderDate(iso: string) {
  return new Date(iso).toLocaleDateString("es-VE", {
    day: "numeric",
    month: "long",
    hour: "numeric",
    minute: "2-digit",
  })
}
