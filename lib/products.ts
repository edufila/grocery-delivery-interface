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
  /**
   * Falso cuando se agotó. Distinto de desactivarlo: el abasto lo vende, hoy
   * no le queda. Sigue en el catálogo, apagado, para que el cliente sepa que
   * existe y vuelva.
   */
  in_stock: boolean
}

/**
 * El catálogo vive en la tabla `products`. Antes era un array en este archivo,
 * lo que obligaba a desplegar para cambiar un precio.
 */
const COLUMNAS = "id, name, unit, price, image, category, wholesale, store_id"

export async function fetchProducts(
  supabase: SupabaseClient,
  storeId?: string,
): Promise<Product[]> {
  const traer = async (columnas: string) => {
    let query = supabase.from("products").select(columnas).eq("active", true)
    if (storeId) query = query.eq("store_id", storeId)
    return query.order("name")
  }

  /**
   * Si la migración de agotados todavía no corrió en la base, pedir la columna
   * hace fallar la consulta ENTERA y el catálogo queda vacío para todos. El
   * código se despliega solo y las migraciones se corren a mano, así que entre
   * una cosa y la otra hay un rato en el que la columna no existe: se reintenta
   * sin ella y la app sigue andando como antes.
   */
  let { data, error } = await traer(`${COLUMNAS}, in_stock`)
  if (error) ({ data, error } = await traer(COLUMNAS))

  if (error || !data) return []

  return (data as unknown as Record<string, unknown>[]).map((row) => ({
    id: row.id as string,
    name: row.name as string,
    unit: row.unit as string,
    // numeric de Postgres llega como string por el driver.
    price: Number(row.price),
    image: row.image as string,
    wholesale: Boolean(row.wholesale),
    category: row.category as Exclude<Category, "Todos">,
    store_id: (row.store_id as string) ?? "girasol",
    // Sin la columna, todo se considera disponible: como funcionaba antes.
    in_stock: row.in_stock !== false,
  }))
}
