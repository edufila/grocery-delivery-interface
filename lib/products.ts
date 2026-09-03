import type { SupabaseClient } from "@supabase/supabase-js"

import type { Category } from "@/lib/categories"

export type Product = {
  id: string
  name: string
  unit: string
  price: number
  image: string
  wholesale?: boolean
  category: Exclude<Category, "Todos">
  store_id: string
}

/**
 * El catálogo vive en la tabla `products`. Antes era un array en este archivo,
 * lo que obligaba a desplegar para cambiar un precio.
 */
export async function fetchProducts(
  supabase: SupabaseClient,
  storeId?: string,
): Promise<Product[]> {
  let query = supabase
    .from("products")
    .select("id, name, unit, price, image, category, wholesale, store_id")
    .eq("active", true)

  if (storeId) query = query.eq("store_id", storeId)

  const { data, error } = await query.order("name")

  if (error || !data) return []

  return data.map((row) => ({
    id: row.id as string,
    name: row.name as string,
    unit: row.unit as string,
    // numeric de Postgres llega como string por el driver.
    price: Number(row.price),
    image: row.image as string,
    wholesale: Boolean(row.wholesale),
    category: row.category as Exclude<Category, "Todos">,
    store_id: (row.store_id as string) ?? "girasol",
  }))
}
