import { notFound } from "next/navigation"

import { ProductCatalog } from "@/components/catalog/product-catalog"
import type { Store } from "@/lib/admin"
import { APP_NAME } from "@/lib/brand"
import { toCategory } from "@/lib/categories"
import { fetchProducts } from "@/lib/products"
import { isSupabaseConfigured } from "@/lib/supabase/config"
import { createClient } from "@/lib/supabase/server"

export default async function CatalogoPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; categoria?: string; mayorista?: string; tienda?: string }>
}) {
  const params = await searchParams

  if (!isSupabaseConfigured) {
    return (
      <ProductCatalog
        products={[]}
        storeName={APP_NAME}
        initialQuery=""
        initialCategory="Todos"
      />
    )
  }

  const supabase = await createClient()
  const storeId = params.tienda ?? "girasol"

  const { data: store } = await supabase
    .from("stores")
    .select("id, name, tag, active")
    .eq("id", storeId)
    .maybeSingle<Pick<Store, "id" | "name" | "tag" | "active">>()

  if (!store || !store.active) notFound()

  // Se cargan en el servidor para que la grilla llegue armada en el HTML.
  const products = await fetchProducts(supabase, store.id)

  return (
    <ProductCatalog
      products={products}
      storeName={store.name}
      storeTag={store.tag ?? undefined}
      initialQuery={params.q ?? ""}
      initialCategory={toCategory(params.categoria)}
      initialWholesaleOnly={params.mayorista === "1"}
    />
  )
}
