/**
 * La semana de trabajo: de lunes a domingo, en hora de Venezuela.
 *
 * Es el período con el que se le paga a un shopper. Antes solo lo veía el
 * shopper en su panel; el admin, que es quien paga, tenía que contar pedidos a
 * mano.
 */

/** Venezuela es UTC-4 todo el año: no hay horario de verano. */
const OFFSET_MS = 4 * 60 * 60 * 1000

/** El lunes de esta semana a medianoche, en hora de Venezuela. */
export function lunesEnVenezuela(ahora: Date): Date {
  const local = new Date(ahora.getTime() - OFFSET_MS)
  const diasDesdeLunes = (local.getUTCDay() + 6) % 7
  const lunesLocal = Date.UTC(local.getUTCFullYear(), local.getUTCMonth(), local.getUTCDate() - diasDesdeLunes)
  return new Date(lunesLocal + OFFSET_MS)
}

export type PedidoDeSemana = {
  shopper_id: string | null
  status: string
  created_at: string
  total: number | string | null
  final_total?: number | string | null
  delivery_fee?: number | string | null
}

export type ResumenShopper = {
  shopperId: string
  entregas: number
  /** Suma de los envíos cobrados: lo que suele ir al shopper. */
  envios: number
  /** Lo que se cobró en esos pedidos, con faltantes descontados. */
  vendido: number
}

/**
 * Cuánto entregó cada shopper desde el lunes. Solo pedidos entregados; los que
 * más entregaron primero.
 */
export function resumenPorShopper(pedidos: PedidoDeSemana[], desde: Date): ResumenShopper[] {
  const porShopper = new Map<string, ResumenShopper>()

  for (const p of pedidos) {
    if (p.status !== "entregado" || !p.shopper_id) continue
    if (new Date(p.created_at) < desde) continue

    const fila = porShopper.get(p.shopper_id) ?? { shopperId: p.shopper_id, entregas: 0, envios: 0, vendido: 0 }
    fila.entregas += 1
    fila.envios += Number(p.delivery_fee ?? 0)
    fila.vendido += Number(p.final_total ?? p.total ?? 0)
    porShopper.set(p.shopper_id, fila)
  }

  return [...porShopper.values()]
    .map((f) => ({ ...f, envios: redondear(f.envios), vendido: redondear(f.vendido) }))
    .sort((a, b) => b.entregas - a.entregas || b.vendido - a.vendido)
}

function redondear(n: number) {
  return Math.round(n * 100) / 100
}
