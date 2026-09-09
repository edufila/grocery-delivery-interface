import type { SupabaseClient } from "@supabase/supabase-js"

import type { Settings } from "@/lib/admin"

const COLUMNAS_BASE = "id, service_fee, rate_ves"
const COLUMNAS_TASA = "rate_ves_updated_at, rate_ves_source"

/**
 * Los ajustes globales, para cualquier pantalla que solo necesite leerlos
 * (catálogo, búsqueda, inicio). El panel de admin sigue con su propia
 * consulta porque además trae otras tablas en el mismo `Promise.all`.
 *
 * Reintenta sin las columnas de la tasa si la base todavía no las tiene: el
 * código se despliega solo y las migraciones se corren a mano, así que hay un
 * rato en el que no existen. Sin este cuidado toda la consulta fallaría y el
 * catálogo se quedaría sin ni siquiera la tarifa de servicio.
 */
export async function fetchSettings(supabase: SupabaseClient): Promise<Settings | null> {
  let { data, error } = await supabase
    .from("settings")
    .select(`${COLUMNAS_BASE}, ${COLUMNAS_TASA}`)
    .eq("id", "global")
    .maybeSingle()

  if (error) {
    ;({ data, error } = await supabase
      .from("settings")
      .select(COLUMNAS_BASE)
      .eq("id", "global")
      .maybeSingle())
  }

  if (error || !data) return null

  const fila = data as Record<string, unknown>
  return {
    id: fila.id as string,
    service_fee: Number(fila.service_fee ?? 0),
    rate_ves: fila.rate_ves != null ? Number(fila.rate_ves) : null,
    rate_ves_updated_at: (fila.rate_ves_updated_at as string) ?? null,
    rate_ves_source: (fila.rate_ves_source as "bcv" | "manual") ?? null,
  }
}
