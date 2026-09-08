import { DeliveryTopBar } from "@/components/delivery-top-bar"
import { SearchBar } from "@/components/search-bar"
import { CategoryShortcuts } from "@/components/category-shortcuts"
import { NearbyStores } from "@/components/nearby-stores"
import { PedidoEnCurso } from "@/components/pedido-en-curso"
import { BottomNav } from "@/components/bottom-nav"
import type { Store } from "@/lib/admin"
import { isSupabaseConfigured } from "@/lib/supabase/config"
import { createClient } from "@/lib/supabase/server"

export default async function HomePage() {
  // Las tiendas salen de la base para poder editarlas sin desplegar.
  const stores = isSupabaseConfigured
    ? ((
        await (await createClient())
          .from("stores")
          .select("*")
          .eq("active", true)
          .order("sort_order")
          .returns<Store[]>()
      ).data ?? [])
    : []

  return (
    <main className="min-h-dvh bg-gray-50">
      <div className="sticky top-0 z-30">
        <DeliveryTopBar />
        <div className="bg-white/90 backdrop-blur-md">
          <SearchBar />
        </div>
      </div>

      {/* Estas son categorías de tipo de negocio (víveres, restaurante...),
          no de producto: esas siguen viviendo dentro del catálogo de cada
          abasto, y en Explorar para buscar en todos a la vez. */}
      <CategoryShortcuts />

      <div className="pb-28">
        {/* Quien espera un pedido abre la app justo por eso: va primero. */}
        <PedidoEnCurso />
        <NearbyStores stores={stores} />
      </div>

      <BottomNav />
    </main>
  )
}
