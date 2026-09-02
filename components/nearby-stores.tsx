"use client"

import { Star, Clock, Bike, BadgePercent, Heart } from "lucide-react"

type Store = {
  name: string
  tag: string
  eta: string
  fee: string
  rating: string
  reviews: string
  image: string
}

const stores: Store[] = [
  {
    name: "Gran Abasto Girasol",
    tag: "Ahorro Mayorista",
    eta: "35-45 min",
    fee: "Bs. 15,00",
    rating: "4.8",
    reviews: "2.4k",
    image: "/images/store-girasol.png",
  },
  {
    name: "Mercado La Cosecha",
    tag: "Frescos del día",
    eta: "25-35 min",
    fee: "Bs. 12,00",
    rating: "4.6",
    reviews: "1.1k",
    image: "/images/store-cosecha.png",
  },
]

export function NearbyStores() {
  return (
    <section className="pt-2" aria-labelledby="stores-heading">
      <div className="mx-auto flex max-w-md items-center justify-between px-4">
        <h2 id="stores-heading" className="text-base font-semibold text-gray-900">
          Abastos cercanos
        </h2>
        <button type="button" className="text-sm font-medium text-emerald-600">
          Ver todos
        </button>
      </div>

      <div className="mx-auto max-w-md space-y-4 px-4 py-4">
        {stores.map((store, i) => (
          <article
            key={store.name}
            className="overflow-hidden rounded-3xl border border-gray-100 bg-white shadow-sm shadow-gray-100"
          >
            <div className="relative h-36 w-full">
              <img
                src={store.image || "/placeholder.svg"}
                alt={`Fachada de ${store.name}`}
                className="h-full w-full object-cover"
              />
              <span className="absolute left-3 top-3 inline-flex items-center gap-1 rounded-full bg-emerald-600 px-2.5 py-1 text-xs font-semibold text-white shadow-sm">
                <BadgePercent className="h-3.5 w-3.5" aria-hidden="true" />
                {store.tag}
              </span>
              <button
                type="button"
                className="absolute right-3 top-3 flex h-8 w-8 items-center justify-center rounded-full bg-white/90 text-gray-700 backdrop-blur transition hover:text-rose-500"
                aria-label={`Guardar ${store.name} en favoritos`}
              >
                <Heart className="h-4 w-4" aria-hidden="true" />
              </button>
            </div>

            <div className="p-4">
              <div className="flex items-start justify-between gap-2">
                <h3 className="text-base font-semibold text-gray-900">{store.name}</h3>
                <span className="flex shrink-0 items-center gap-1 rounded-lg bg-amber-50 px-2 py-1 text-xs font-semibold text-amber-700">
                  <Star className="h-3.5 w-3.5 fill-amber-500 text-amber-500" aria-hidden="true" />
                  {store.rating}
                  <span className="font-normal text-amber-600/70">({store.reviews})</span>
                </span>
              </div>

              <div className="mt-3 flex items-center gap-4 text-sm text-gray-600">
                <span className="flex items-center gap-1.5">
                  <Clock className="h-4 w-4 text-gray-400" aria-hidden="true" />
                  {store.eta}
                </span>
                <span className="h-1 w-1 rounded-full bg-gray-300" aria-hidden="true" />
                <span className="flex items-center gap-1.5">
                  <Bike className="h-4 w-4 text-gray-400" aria-hidden="true" />
                  Envío {store.fee}
                </span>
              </div>

              {i === 0 && (
                <button
                  type="button"
                  className="mt-4 w-full rounded-2xl bg-emerald-600 py-3 text-sm font-semibold text-white transition hover:bg-emerald-700 active:scale-[0.99]"
                >
                  Comprar ahora
                </button>
              )}
            </div>
          </article>
        ))}
      </div>
    </section>
  )
}
