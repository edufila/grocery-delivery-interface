import type { SupabaseClient } from "@supabase/supabase-js"

export type MetodoPago = {
  id: string
  label: string
  hint: string | null
  /** A dónde pagar: banco, teléfono, a nombre de quién. Lo carga el panel. */
  instructions: string | null
  /** El efectivo se paga en la puerta: no hay referencia que reportar. */
  needs_reference: boolean
  active: boolean
  sort_order: number
  /** En qué moneda cobra. 'VES' necesita tasa del día para poder cotizar. */
  currency: string
}

/**
 * Un método se puede ofrecer si está encendido, si tiene cargado a dónde pagar
 * cuando hace falta, y si se le puede decir al cliente cuánto.
 *
 * Antes los cuatro estaban escritos en el código y se ofrecían siempre, aunque
 * no hubiera a dónde mandar el dinero: el cliente elegía Pago Móvil y se
 * quedaba esperando una instrucción que no llegaba nunca.
 *
 * Lo de la moneda es el mismo problema por otro lado: sin tasa cargada se le
 * diría "paga $6.35" a alguien que va a transferir bolívares, y cada quien
 * convertiría con la tasa que se le ocurra.
 */
export function sePuedeOfrecer(metodo: MetodoPago, tasaVes: number | null) {
  if (!metodo.active) return false
  if (metodo.currency === "VES" && !(tasaVes && tasaVes > 0)) return false
  if (!metodo.needs_reference) return true
  return (metodo.instructions ?? "").trim().length > 0
}

const COLUMNAS = "id, label, hint, instructions, needs_reference, active, sort_order"

/**
 * Los métodos que el cliente puede elegir hoy. Devuelve lista vacía si la tabla
 * todavía no existe, y quien llama decide qué hacer con eso.
 *
 * Reintenta sin `currency` si la base todavía no la tiene: el código se
 * despliega solo y las migraciones se corren a mano, así que entre una cosa y
 * la otra hay un rato en el que la columna no existe. Sin este cuidado la
 * consulta falla entera y el checkout se queda sin ningún método de pago, que
 * es peor que quedarse sin la columna.
 */
export async function fetchMetodosPago(supabase: SupabaseClient): Promise<MetodoPago[]> {
  const traer = (columnas: string) =>
    supabase.from("payment_methods").select(columnas).order("sort_order")

  let { data, error } = await traer(`${COLUMNAS}, currency`)
  if (error) ({ data, error } = await traer(COLUMNAS))

  if (error || !data) return []

  return (data as unknown as Record<string, unknown>[]).map((fila) => ({
    id: fila.id as string,
    label: fila.label as string,
    hint: (fila.hint as string) ?? null,
    instructions: (fila.instructions as string) ?? null,
    needs_reference: fila.needs_reference !== false,
    active: fila.active !== false,
    sort_order: Number(fila.sort_order ?? 0),
    // Sin la columna todo se trata como dólares, que es como funcionaba antes.
    currency: (fila.currency as string) ?? "USD",
  }))
}

/**
 * "1234.56" -> "1.234,56", que es como se lee un monto aquí.
 *
 * Vive junto a lo demás de pagos porque lo usan las dos puntas de la misma
 * conversación: la pantalla donde el cliente ve cuánto pagar y la del abasto
 * donde alguien compara ese número contra el banco. Si se formatearan distinto
 * -- uno con coma decimal y otro con punto -- comparar dejaría de ser obvio,
 * que es justo lo único que esa pantalla tiene que lograr.
 */
export function formatBolivares(monto: number) {
  return monto.toLocaleString("es-VE", { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

/**
 * El equivalente en bolívares de un precio en dólares, o null sin tasa
 * cargada. Los precios de catálogo siguen en dólares -- esto es solo la
 * referencia que se muestra al lado, no cambia cómo se cobra.
 */
export function bsEquivalent(usd: number, tasaVes: number | null) {
  if (!tasaVes || tasaVes <= 0) return null
  return usd * tasaVes
}

/**
 * Los últimos dígitos de una referencia, que es lo que el cliente escribe y lo
 * que se busca en el banco.
 *
 * Se queda solo con números: unos escriben "0001234", otros "Ref. 001234" y
 * otros con espacios, y todos quieren decir lo mismo.
 */
export function ultimosDigitos(referencia: string | null, cuantos = 4) {
  const digitos = (referencia ?? "").replace(/\D/g, "")
  return digitos.slice(-cuantos)
}
