"use client"

import Link from "next/link"
import { useEffect, useState } from "react"
import { Star, Clock, Bike, BadgePercent, Heart } from "lucide-react"

import type { Store } from "@/lib/admin"

const FAVORITES_KEY = "abastos-favoritos"

export function NearbyStores({ stores }: { stores: Store[] }) {
  const [favorites, setFavorites] = useState<string[]>([])

  // Los favoritos viven en el navegador: no hay backend todavía.
  useEffect(() => {
    try {
      const stored = localStorage.getItem(FAVORITES_KEY)
      if (stored) setFavorites(JSON.parse(stored) as string[])
    } catch {
      // Modo privado o storage bloqueado: seguimos sin favoritos guardados.
    }
  }, [])

  const toggleFavorite = (id: string) => {
    setFavorites((prev) => {
      const next = prev.includes(id) ? prev.filter((n) => n !== id) : [...prev, id]
      try {
        localStorage.setItem(FAVORITES_KEY, JSON.stringify(next))
      } catch {
        // Si no se puede guardar, al menos queda marcado en esta sesión.
      }
      return next
    })
  }

  if (stores.length === 0) return null

  return (
    <section className="pt-2" aria-labelledby="stores-heading">
      <div className="mx-auto flex max-w-md items-center justify-between px-4">
        <h2 id="stores-heading" className="text-base font-semibold text-gray-900">
          Abastos cercanos
        </h2>
        <Link
          href="/catalogo"
          className="-mr-2 flex min-h-11 items-center px-2 text-sm font-medium text-emerald-600"
        >
          Ver todos
        </Link>
      </div>

      <div className="mx-auto max-w-md space-y-4 px-4 py-4">
        {stores.map((store) => {
          // Solo Girasol tiene catálogo: mandar a otra tienda al de Girasol
          // sería mentir sobre lo que se está comprando.
          const href = store.id === "girasol" ? "/catalogo" : null
          const isFavorite = favorites.includes(store.id)

          return (
            <article
              key={store.id}
              className="relative overflow-hidden rounded-3xl border border-gray-100 bg-white shadow-sm shadow-gray-100 transition active:scale-[0.995]"
            >
              <div className="relative h-36 w-full">
                <img
                  src={store.image || "/placeholder.svg"}
                  alt={`Fachada de ${store.name}`}
                  className="h-full w-full object-cover"
                />
                {store.tag && (
                  <span className="absolute left-3 top-3 inline-flex items-center gap-1 rounded-full bg-emerald-600 px-2.5 py-1 text-xs font-semibold text-white shadow-sm">
                    <BadgePercent className="h-3.5 w-3.5" aria-hidden="true" />
                    {store.tag}
                  </span>
                )}
                <button
                  type="button"
                  onClick={() => toggleFavorite(store.id)}
                  aria-pressed={isFavorite}
                  className="absolute right-3 top-3 z-20 flex h-11 w-11 items-center justify-center rounded-full bg-white/90 text-gray-700 backdrop-blur transition active:scale-95"
                  aria-label={
                    isFavorite
                      ? `Quitar ${store.name} de favoritos`
                      : `Guardar ${store.name} en favoritos`
                  }
                >
                  <Heart
                    className={`h-5 w-5 transition ${isFavorite ? "fill-rose-500 text-rose-500" : ""}`}
                    aria-hidden="true"
                  />
                </button>
              </div>

              <div className="p-4">
                <div className="flex items-start justify-between gap-2">
                  {/* Enlace estirado: cubre toda la tarjeta sin anidar botones
                      dentro de un <a>, así el corazón sigue siendo clicable. */}
                  <h3 className="text-base font-semibold text-gray-900">
                    {href ? (
                      <Link href={href} className="after:absolute after:inset-0 after:content-['']">
                        {store.name}
                      </Link>
                    ) : (
                      store.name
                    )}
                  </h3>
                  {store.rating && (
                    <span className="flex shrink-0 items-center gap-1 rounded-lg bg-amber-50 px-2 py-1 text-xs font-semibold text-amber-700">
                      <Star
                        className="h-3.5 w-3.5 fill-amber-500 text-amber-500"
                        aria-hidden="true"
                      />
                      {store.rating}
                      {store.reviews && (
                        <span className="font-normal text-amber-600/70">({store.reviews})</span>
                      )}
                    </span>
                  )}
                </div>

                <div className="mt-3 flex items-center gap-4 text-sm text-gray-600">
                  {store.eta && (
                    <>
                      <span className="flex items-center gap-1.5">
                        <Clock className="h-4 w-4 text-gray-400" aria-hidden="true" />
                        {store.eta}
                      </span>
                      <span className="h-1 w-1 rounded-full bg-gray-300" aria-hidden="true" />
                    </>
                  )}
                  <span className="flex items-center gap-1.5">
                    <Bike className="h-4 w-4 text-gray-400" aria-hidden="true" />
                    Envío ${Number(store.delivery_fee).toFixed(2)}
                  </span>
                </div>

                {href ? (
                  <Link
                    href={href}
                    className="relative z-20 mt-4 flex h-12 w-full items-center justify-center rounded-2xl bg-emerald-600 text-sm font-semibold text-white transition active:scale-[0.99]"
                  >
                    Comprar ahora
                  </Link>
                ) : (
                  <p className="mt-4 flex h-12 w-full items-center justify-center rounded-2xl bg-gray-100 text-sm font-semibold text-gray-500">
                    Próximamente
                  </p>
                )}
              </div>
            </article>
          )
        })}
      </div>
    </section>
  )
}
