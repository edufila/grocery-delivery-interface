import { ProductCatalog } from "@/components/catalog/product-catalog"
import { toCategory } from "@/lib/categories"

export default async function CatalogoPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; categoria?: string; mayorista?: string }>
}) {
  const params = await searchParams

  return (
    <ProductCatalog
      initialQuery={params.q ?? ""}
      initialCategory={toCategory(params.categoria)}
      initialWholesaleOnly={params.mayorista === "1"}
    />
  )
}
