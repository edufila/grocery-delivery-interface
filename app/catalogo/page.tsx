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

  /**
   * Las tres a la vez. Los productos se piden con el id de la dirección, sin
   * esperar a confirmar que el abasto existe: si no existe o está apagado, se
   * tiran y sale 404 igual. Esperar primero costaba un viaje entero a Supabase
   * en cada entrada a un catálogo, para el caso raro de un enlace viejo.
   */
  const [{ data: store }, products, settings] = await Promise.all([
    supabase
      .from("stores")
      .select("id, name, tag, active, image, eta, delivery_fee")
      .eq("id", storeId)
      .maybeSingle<
        Pick<Store, "id" | "name" | "tag" | "active" | "image" | "eta" | "delivery_fee">
      >(),
    fetchProducts(supabase, storeId),
    fetchSettings(supabase),
  ])

  if (!store || !store.active) notFound()

  return (
    <ProductCatalog
      products={products}
      storeId={store.id}
      storeName={store.name}
      storeTag={store.tag ?? undefined}
      storeImage={store.image}
      storeEta={store.eta}
      deliveryFee={store.delivery_fee}
      initialQuery={params.q ?? ""}
      initialCategory={toCategory(params.categoria)}
      initialWholesaleOnly={params.mayorista === "1"}
      tasaVes={settings?.rate_ves ?? null}
    />
  )
}
