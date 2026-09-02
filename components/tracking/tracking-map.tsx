import Image from "next/image"
import { MapPin, Navigation } from "lucide-react"

export function TrackingMap() {
  return (
    <div className="relative h-56 w-full overflow-hidden rounded-2xl border border-gray-100 bg-gray-50 sm:h-64">
      <Image
        src="/images/map-route.png"
        alt="Mapa de seguimiento de la ruta de entrega"
        fill
        className="object-cover"
        priority
      />

      {/* Route line */}
      <svg
        className="absolute inset-0 h-full w-full"
        viewBox="0 0 400 240"
        fill="none"
        preserveAspectRatio="none"
        aria-hidden="true"
      >
        <path
          d="M70 190 C 140 150, 160 110, 250 90 S 330 60, 340 50"
          stroke="#10b981"
          strokeWidth="4"
          strokeLinecap="round"
          strokeDasharray="2 12"
        />
      </svg>

      {/* Store origin pin */}
      <div className="absolute left-[15%] top-[76%] -translate-x-1/2 -translate-y-1/2">
        <div className="flex h-7 w-7 items-center justify-center rounded-full border-2 border-white bg-gray-800 shadow-md">
          <span className="h-2 w-2 rounded-full bg-white" />
        </div>
      </div>

      {/* Driver / route pin */}
      <div className="absolute left-[62%] top-[36%] -translate-x-1/2 -translate-y-1/2">
        <span className="absolute inset-0 -m-2 animate-ping rounded-full bg-emerald-400/40" />
        <div className="relative flex h-9 w-9 items-center justify-center rounded-full border-2 border-white bg-emerald-500 shadow-lg">
          <Navigation className="h-4 w-4 fill-white text-white" />
        </div>
      </div>

      {/* Destination pin */}
      <div className="absolute left-[85%] top-[20%] -translate-x-1/2 -translate-y-full">
        <MapPin className="h-8 w-8 fill-gray-800 text-gray-800 drop-shadow-md" strokeWidth={1.5} />
      </div>

      {/* ETA chip */}
      <div className="absolute bottom-3 left-3 flex items-center gap-2 rounded-full bg-white/95 px-3 py-1.5 shadow-md backdrop-blur">
        <span className="flex h-2 w-2 rounded-full bg-emerald-500" />
        <p className="text-sm font-semibold text-gray-800">
          Llega en <span className="text-emerald-600">18 min</span>
        </p>
      </div>
    </div>
  )
}
