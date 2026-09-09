import { notFound } from "next/navigation"

import { ProductCatalog } from "@/components/catalog/product-catalog"
import type { Store } from "@/lib/admin"
import { APP_NAME } from "@/lib/brand"
import { toCategory } from "@/lib/categories"
import { fetchProducts } from "@/lib/products"
import { fetchSettings } from "@/lib/settings"
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
        storeId="girasol"
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
  const [products, settings] = await Promise.all([
    fetchProducts(supabase, store.id),
    fetchSettings(supabase),
  ])

  return (
    <ProductCatalog
      products={products}
      storeId={store.id}
      storeName={store.name}
      storeTag={store.tag ?? undefined}
      initialQuery={params.q ?? ""}
      initialCategory={toCategory(params.categoria)}
      initialWholesaleOnly={params.mayorista === "1"}
      tasaVes={settings?.rate_ves ?? null}
    />
  )
}
