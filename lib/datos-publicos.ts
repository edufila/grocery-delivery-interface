import { unstable_cache } from "next/cache"

import type { Store } from "@/lib/admin"
import { fetchProducts } from "@/lib/products"
import { fetchSettings } from "@/lib/settings"
import { crearClientePublico } from "@/lib/supabase/publico"

/**
 * Lo que ve cualquiera, guardado un minuto.
 *
 * El catálogo de un abasto se armaba de cero en cada visita: tres consultas a
 * Supabase para datos que cambian unas pocas veces al día. Medido en
 * producción, respondía en ~1,1 s. Con esto la mayoría de las visitas no va a
 * Supabase.
 *
 * Un minuto de atraso es el costo: un precio o un "agotado" cambiado en el
 * panel tarda hasta un minuto en verse. No hay riesgo de cobrar mal por eso --
 * `place_order` calcula el total contra la base y rechaza lo agotado --, a lo
 * sumo el cliente ve el precio viejo un rato.
 *
 * Sin cookies ni sesión adentro: lo que se guarda aquí es igual para todos.
 */
const MINUTO = 60

export const tiendaPublica = unstable_cache(
  async (storeId: string) => {
    const { data } = await crearClientePublico()
      .from("stores")
      .select("id, name, tag, active, image, eta, delivery_fee")
      .eq("id", storeId)
      .maybeSingle<Pick<Store, "id" | "name" | "tag" | "active" | "image" | "eta" | "delivery_fee">>()
    return data
  },
  ["tienda-publica"],
  { revalidate: MINUTO },
)

export const productosPublicos = unstable_cache(
  async (storeId: string) => fetchProducts(crearClientePublico(), storeId),
  ["productos-publicos"],
  { revalidate: MINUTO },
)

export const ajustesPublicos = unstable_cache(
  async () => fetchSettings(crearClientePublico()),
  ["ajustes-publicos"],
  { revalidate: MINUTO },
)
