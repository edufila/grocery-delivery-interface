"use client"

import Link from "next/link"
import { useEffect, useState } from "react"
import { Clock, Bike, BadgePercent, Heart } from "lucide-react"

import type { Store } from "@/lib/admin"
import { createClient } from "@/lib/supabase/client"
import { isSupabaseConfigured } from "@/lib/supabase/config"

const FAVORITES_KEY = "abastos-favoritos"

export function NearbyStores({ stores }: { stores: Store[] }) {
  const [favorites, setFavorites] = useState<string[]>([])
  const [userId, setUserId] = useState<string | null>(null)

  /**
   * Con sesión los favoritos van a la cuenta, así siguen al cambiar de
   * teléfono. Sin sesión quedan en el navegador, para no perder el gesto de
   * alguien que todavía no se registró.
   */
  useEffect(() => {
    let cancelled = false

    void (async () => {
      if (!isSupabaseConfigured) return

      const supabase = createClient()
      const {
        data: { user },
      } = await supabase.auth.getUser()

      if (cancelled) return

      if (!user) {
        try {
          const stored = localStorage.getItem(FAVORITES_KEY)
          if (stored) setFavorites(JSON.parse(stored) as string[])
        } catch {
          // Modo privado o storage bloqueado.
        }
        return
      }

      setUserId(user.id)

      const { data } = await supabase
        .from("favorites")
        .select("store_id")
        .eq("user_id", user.id)
        .returns<{ store_id: string }[]>()

      if (!cancelled) setFavorites((data ?? []).map((row) => row.store_id))
    })()

    return () => {
      cancelled = true
    }
  }, [])

  const toggleFavorite = (id: string) => {
    const wasFavorite = favorites.includes(id)
    const next = wasFavorite ? favorites.filter((n) => n !== id) : [...favorites, id]

    // Se pinta primero y se guarda después: tocar un corazón tiene que
    // responder al instante.
    setFavorites(next)

    if (!userId) {
      try {
        localStorage.setItem(FAVORITES_KEY, JSON.stringify(next))
      } catch {
        // Queda marcado solo en esta sesión.
      }
      return
    }

    const supabase = createClient()
    void (async () => {
      const { error } = wasFavorite
        ? await supabase.from("favorites").delete().eq("user_id", userId).eq("store_id", id)
        : await supabase.from("favorites").insert({ user_id: userId, store_id: id })

      // Si falló, volvemos a como estaba en vez de mentir.
      if (error) setFavorites(favorites)
    })()
  }

  if (stores.length === 0) return null

  return (
    <section className="pt-2" aria-labelledby="stores-heading">
      {/* Sin "Ver todos": esta lista ya son todos los abastos activos. El
          enlace llevaba al catálogo del primero, que no era ver todos nada. */}
      <div className="mx-auto max-w-md px-4">
        <h2 id="stores-heading" className="text-base font-semibold text-gray-900">
          Abastos cercanos
        </h2>
      </div>

      <div className="mx-auto max-w-md space-y-4 px-4 py-4">
        {stores.map((store) => {
          // Cada tienda va a su propio catálogo.
          const href = `/catalogo?tienda=${store.id}`
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
                {/* Enlace estirado: cubre toda la tarjeta sin anidar botones
                    dentro de un <a>, así el corazón sigue siendo clicable. */}
                <h3 className="text-base font-semibold text-gray-900">
                  <Link href={href} className="after:absolute after:inset-0 after:content-['']">
                    {store.name}
                  </Link>
                </h3>

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

                <Link
                  href={href}
                  className="relative z-20 mt-4 flex h-12 w-full items-center justify-center rounded-2xl bg-emerald-600 text-sm font-semibold text-white transition active:scale-[0.99]"
                >
                  Comprar ahora
                </Link>
              </div>
            </article>
          )
        })}
      </div>
    </section>
  )
}
