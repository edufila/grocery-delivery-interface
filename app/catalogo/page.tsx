import type { Metadata } from "next"
import { notFound } from "next/navigation"
import { cache } from "react"

import { ProductCatalog } from "@/components/catalog/product-catalog"
import type { Store } from "@/lib/admin"
import { APP_NAME, pageTitle } from "@/lib/brand"
import { toCategory } from "@/lib/categories"
import { fetchProducts } from "@/lib/products"
import { fetchSettings } from "@/lib/settings"
import { isSupabaseConfigured } from "@/lib/supabase/config"
import { createClient } from "@/lib/supabase/server"

type TiendaDelCatalogo = Pick<
  Store,
  "id" | "name" | "tag" | "active" | "image" | "eta" | "delivery_fee"
>

/**
 * El abasto, una sola vez por visita.
 *
 * Lo piden dos: la página y los metadatos de la vista previa. Sin `cache`
 * serían dos viajes a Supabase para la misma fila.
 */
const buscarTienda = cache(async (storeId: string) => {
  const supabase = await createClient()
  const { data } = await supabase
    .from("stores")
    .select("id, name, tag, active, image, eta, delivery_fee")
    .eq("id", storeId)
    .maybeSingle<TiendaDelCatalogo>()
  return data
})

/**
 * La vista previa al compartir el enlace de un abasto.
 *
 * Es como más se va a mover esta app al principio: alguien le pasa a otro por
 * WhatsApp el link de su abasto. Antes la tarjeta decía lo mismo para todos --
 * "Abasto · Delivery de supermercado" con la cesta --, y el que la recibía no
 * sabía de qué local le hablaban hasta abrirla. Ahora lleva el nombre, el
 * tiempo y la foto de ese abasto.
 */
export async function generateMetadata({
  searchParams,
}: {
  searchParams: Promise<{ tienda?: string }>
}): Promise<Metadata> {
  if (!isSupabaseConfigured) return {}

  const { tienda } = await searchParams
  const store = await buscarTienda(tienda ?? "girasol")
  if (!store || !store.active) return {}

  const descripcion = [
    `Haz tu mercado en ${store.name} y te lo llevamos a la puerta.`,
    store.eta ? `Llega en ${store.eta}.` : "",
  ]
    .filter(Boolean)
    .join(" ")

  return {
    title: pageTitle(store.name),
    description: descripcion,
    // Next reemplaza el openGraph del layout entero, no lo mezcla: lo que se
    // quiera conservar de allá hay que repetirlo aquí.
    openGraph: {
      type: "website",
      siteName: APP_NAME,
      locale: "es_VE",
      title: `${store.name} · ${APP_NAME}`,
      description: descripcion,
      ...(store.image ? { images: [{ url: store.image, alt: `Fachada de ${store.name}` }] } : {}),
    },
    twitter: {
      title: `${store.name} · ${APP_NAME}`,
      description: descripcion,
      ...(store.image ? { images: [store.image] } : {}),
    },
  }
}

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
  const [store, products, settings] = await Promise.all([
    buscarTienda(storeId),
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
