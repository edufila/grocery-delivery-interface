import { DeliveryTopBar } from "@/components/delivery-top-bar"
import { SearchBar } from "@/components/search-bar"
import { CategoryCarousel } from "@/components/category-carousel"
import { NearbyStores } from "@/components/nearby-stores"
import { BottomNav } from "@/components/bottom-nav"

export default function HomePage() {
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
        <NearbyStores />
      </div>

      <BottomNav />
    </main>
  )
}
