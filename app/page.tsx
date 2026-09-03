import { DeliveryTopBar } from "@/components/delivery-top-bar"
import { SearchBar } from "@/components/search-bar"
import { CategoryCarousel } from "@/components/category-carousel"
import { NearbyStores } from "@/components/nearby-stores"
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

      <div className="pb-28">
        <CategoryCarousel />
        <NearbyStores stores={stores} />
      </div>

      <BottomNav />
    </main>
  )
}
