import Link from "next/link"
import { ArrowLeft } from "lucide-react"
import { TrackingMap } from "@/components/tracking/tracking-map"
import { StatusTimeline } from "@/components/tracking/status-timeline"
import { OrderRecap } from "@/components/tracking/order-recap"

export default function TrackingPage() {
  return (
    <main className="min-h-dvh bg-gray-50">
      <div className="mx-auto max-w-lg px-4 pb-10">
        {/* Header */}
        <header className="sticky top-0 z-10 -mx-4 flex items-center gap-3 border-b border-gray-100 bg-gray-50/90 px-4 py-4 backdrop-blur">
          <Link
            href="/catalogo"
            aria-label="Volver"
            className="flex h-9 w-9 items-center justify-center rounded-full border border-gray-200 bg-white text-gray-700 transition-colors hover:bg-gray-100"
          >
            <ArrowLeft className="h-5 w-5" />
          </Link>
          <div>
            <h1 className="text-lg font-bold leading-tight text-gray-900">Seguimiento del pedido</h1>
            <p className="text-sm text-gray-500">Pedido #GA-4821 · Gran Abasto Girasol</p>
          </div>
        </header>

        <div className="mt-4 space-y-4">
          <TrackingMap />
          <StatusTimeline />
          <OrderRecap />
        </div>
      </div>
    </main>
  )
}
