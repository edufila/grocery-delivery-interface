import { ProductCatalog } from "@/components/catalog/product-catalog"
import { toCategory } from "@/lib/categories"
import { fetchProducts } from "@/lib/products"
import { isSupabaseConfigured } from "@/lib/supabase/config"
import { createClient } from "@/lib/supabase/server"

export default async function CatalogoPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; categoria?: string; mayorista?: string }>
}) {
  const params = await searchParams

  // Se cargan en el servidor para que la grilla llegue armada en el HTML.
  const products = isSupabaseConfigured ? await fetchProducts(await createClient()) : []

  return (
    <ProductCatalog
      products={products}
      initialQuery={params.q ?? ""}
      initialCategory={toCategory(params.categoria)}
      initialWholesaleOnly={params.mayorista === "1"}
    />
  )
}
