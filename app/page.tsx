import { DeliveryTopBar } from "@/components/delivery-top-bar"
import { SearchBar } from "@/components/search-bar"
import { CategoryShortcuts } from "@/components/category-shortcuts"
import { TasaBcvBadge } from "@/components/tasa-bcv-badge"
import { NearbyStores } from "@/components/nearby-stores"
import { PedidoEnCurso } from "@/components/pedido-en-curso"
import { BottomNav } from "@/components/bottom-nav"
import type { Store } from "@/lib/admin"
import { fetchSettings } from "@/lib/settings"
import { isSupabaseConfigured } from "@/lib/supabase/config"
import { createClient } from "@/lib/supabase/server"

export default async function HomePage() {
  const supabase = isSupabaseConfigured ? await createClient() : null

  // Las tiendas salen de la base para poder editarlas sin desplegar.
  const stores = supabase
    ? ((
        await supabase
          .from("stores")
          .select("*")
          .eq("active", true)
          .order("sort_order")
          .returns<Store[]>()
      ).data ?? [])
    : []

  const settings = supabase ? await fetchSettings(supabase) : null

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

      <TasaBcvBadge tasaVes={settings?.rate_ves ?? null} actualizada={settings?.rate_ves_updated_at ?? null} />

      <div className="pb-28">
        {/* Quien espera un pedido abre la app justo por eso: va primero. */}
        <PedidoEnCurso />
        <NearbyStores stores={stores} tasaVes={settings?.rate_ves ?? null} />
      </div>

      <BottomNav />
    </main>
  )
}
