/**
 * Cuánto tarda en llegar un pedido, antes de pedirlo.
 *
 * El "35-45 min" de cada abasto lo escribe un admin a mano y es el mismo para
 * quien vive a dos cuadras y para quien vive al otro lado de Araure. Con el
 * punto del abasto y el de la dirección se puede decir algo más cierto.
 *
 * Es una estimación sin red: línea recta corregida por calles, a velocidad de
 * moto en ciudad, más lo que tarda comprar. No llama a ningún servicio de rutas
 * -- eso ya se hace en el seguimiento, con el shopper en camino --, así que no
 * cuesta datos ni manda la dirección a nadie para mostrar un número aproximado.
 */

export type Punto = { lat: number; lng: number }

/** Comprar el pedido en el anaquel y cobrarlo. */
const PREPARACION_MIN = 20
/** Las calles no van en línea recta: un recorrido real es ~35% más largo. */
const FACTOR_CALLES = 1.35
/** Moto en Acarigua/Araure, con semáforos y reductores. */
const KM_POR_HORA = 25
/** Estacionar, tocar, entregar. */
const ENTREGA_MIN = 5

/** Distancia en línea recta, en kilómetros (fórmula de haversine). */
export function distanciaKm(a: Punto, b: Punto): number {
  const R = 6371
  const rad = (g: number) => (g * Math.PI) / 180
  const dLat = rad(b.lat - a.lat)
  const dLng = rad(b.lng - a.lng)
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLng / 2) ** 2
  return 2 * R * Math.asin(Math.sqrt(h))
}

export type Estimado = { desde: number; hasta: number; km: number }

type PuntoQuizas = { lat?: number | null; lng?: number | null } | null | undefined

/**
 * Un rango de minutos redondeado de 5 en 5, del abasto a la dirección.
 * Null si falta alguno de los dos puntos.
 */
export function estimarEntrega(abasto: PuntoQuizas, destino: PuntoQuizas): Estimado | null {
  if (abasto?.lat == null || abasto?.lng == null || destino?.lat == null || destino?.lng == null) return null

  const km = distanciaKm({ lat: abasto.lat, lng: abasto.lng }, { lat: destino.lat, lng: destino.lng })
  const viaje = ((km * FACTOR_CALLES) / KM_POR_HORA) * 60
  const total = PREPARACION_MIN + viaje + ENTREGA_MIN
  const desde = Math.max(25, Math.round(total / 5) * 5)

  return { desde, hasta: desde + 10, km: Math.round(km * 10) / 10 }
}

/** "30-40 min". */
export function textoEstimado(e: Estimado): string {
  return `${e.desde}-${e.hasta} min`
}
