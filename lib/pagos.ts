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
