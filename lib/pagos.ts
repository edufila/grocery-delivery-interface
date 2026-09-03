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
}

/**
 * Un método se puede ofrecer si está encendido y, cuando hace falta pagar por
 * adelantado, si tiene cargado a dónde.
 *
 * Antes los cuatro métodos estaban escritos en el código y se ofrecían siempre,
 * aunque no hubiera a dónde mandar el dinero: el cliente elegía Pago Móvil y se
 * quedaba esperando una instrucción que no llegaba nunca.
 */
export function sePuedeOfrecer(metodo: MetodoPago) {
  if (!metodo.active) return false
  if (!metodo.needs_reference) return true
  return (metodo.instructions ?? "").trim().length > 0
}

/**
 * Los métodos que el cliente puede elegir hoy. Devuelve lista vacía si la tabla
 * todavía no existe, y quien llama decide qué hacer con eso.
 */
export async function fetchMetodosPago(supabase: SupabaseClient): Promise<MetodoPago[]> {
  const { data, error } = await supabase
    .from("payment_methods")
    .select("id, label, hint, instructions, needs_reference, active, sort_order")
    .order("sort_order")
    .returns<MetodoPago[]>()

  if (error || !data) return []
  return data
}
