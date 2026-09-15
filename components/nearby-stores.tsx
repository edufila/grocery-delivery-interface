"use client"

import Link from "next/link"
import { useEffect, useState } from "react"
import { ArrowRight, Clock, Bike, BadgePercent, Star } from "lucide-react"

import type { Store } from "@/lib/admin"
import { bsEquivalent, formatBolivares } from "@/lib/pagos"
import { usuarioEnTelefono } from "@/lib/sesion"
import { createClient } from "@/lib/supabase/client"
import { isSupabaseConfigured } from "@/lib/supabase/config"
import { fotoLigera } from "@/lib/fotos"
import { PastillaHorario } from "@/components/estado-horario"

const FAVORITES_KEY = "abastos-favoritos"

export function NearbyStores({ stores, tasaVes }: { stores: Store[]; tasaVes?: number | null }) {
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
      const user = await usuarioEnTelefono(supabase)

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
        {stores.map((store, indice) => {
          // Cada tienda va a su propio catálogo.
          const href = `/catalogo?tienda=${store.id}`
          const isFavorite = favorites.includes(store.id)

          return (
            <article
              key={store.id}
              className="relative overflow-hidden rounded-3xl border border-gray-100 bg-white shadow-sm shadow-gray-900/[0.06] transition active:scale-[0.995]"
            >
              {/**
               * Toda la tarjeta lleva al catálogo, sin anidar la estrella dentro
               * de un <a>. Es una capa aparte debajo de la estrella y del botón.
               *
               * Fuera del orden de tabulación y del lector: el botón "Comprar en"
               * ya es el mismo enlace con nombre, y anunciarlo dos veces por
               * tarjeta sería ruido.
               */}
              <Link
                href={href}
                tabIndex={-1}
                aria-hidden="true"
                className="absolute inset-0 z-10"
              />
              <div className="relative h-40 w-full">
                {/**
                 * Etiqueta suelta y no `next/image`, a propósito.
                 *
                 * Se probó: con `next/image` la foto sale en blanco, también en
                 * un build de producción. El endpoint que redimensiona sí
                 * responde -- devuelve la foto a 255 KB en vez de 2,6 MB -- así
                 * que lo que falla es el componente, no la optimización. Muy
                 * probablemente sea que `sharp` no está instalado y en este
                 * proyecto `npm install` está roto.
                 *
                 * Cuando eso se arregle, esto vale la pena revisarlo: es la
                 * diferencia entre 2,6 MB y 255 KB en la primera pantalla que
                 * carga cualquiera con datos móviles. Mientras tanto, el peso se
                 * bajó achicando el archivo mismo.
                 */}
                {/* La primera entra en pantalla al abrir; de la segunda en
                    adelante hay que bajar para verlas, así que se bajan cuando
                    toque. Eran 360 KB que el teléfono descargaba para algo que
                    todavía no estaba mirando. */}
                <img
                  src={fotoLigera(store.image) || "/placeholder.svg"}
                  alt={`Fachada de ${store.name}`}
                  className="h-full w-full object-cover"
                  loading={indice === 0 ? "eager" : "lazy"}
                  // La del primero es lo más grande que se ve al abrir: medido,
                  // tardaba medio segundo en empezar a bajar detrás del resto.
                  fetchPriority={indice === 0 ? "high" : "auto"}
                  decoding="async"
                />
                {/* Oscurece desde abajo para que el nombre se lea encima de la
                    foto, igual que en la portada del catálogo: se reconoce el
                    mismo abasto al entrar. */}
                <div
                  className="absolute inset-0 bg-gradient-to-t from-black/75 via-black/20 to-black/0"
                  aria-hidden="true"
                />
                <div className="absolute left-3 right-16 top-3 flex flex-col items-start gap-1.5">
                  {store.tag && (
                    <span className="inline-flex items-center gap-1 rounded-full bg-emerald-600 px-2.5 py-1 text-xs font-semibold text-white shadow-sm">
                      <BadgePercent className="h-3.5 w-3.5" aria-hidden="true" />
                      {store.tag}
                    </span>
                  )}
                  <PastillaHorario abre={store.abre} cierra={store.cierra} />
                </div>
                <h3 className="absolute inset-x-0 bottom-0 truncate px-4 pb-3 text-xl font-bold tracking-tight text-white">
                  {store.name}
                </h3>
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
                  <Star
                    className={`h-5 w-5 transition ${
                      isFavorite ? "fill-amber-400 text-amber-500" : ""
                    }`}
                    aria-hidden="true"
                  />
                </button>
              </div>

              <div className="p-4">
                <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-gray-600">
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
                    {(() => {
                      const bs = bsEquivalent(Number(store.delivery_fee), tasaVes ?? null)
                      return bs != null ? (
                        <span className="text-gray-500"> · Bs {formatBolivares(bs)}</span>
                      ) : null
                    })()}
                  </span>
                </div>

                <Link
                  href={href}
                  aria-label={`Comprar ahora en ${store.name}`}
                  className="group relative z-20 mt-4 flex h-12 w-full items-center justify-center gap-2 rounded-2xl bg-emerald-600 text-sm font-semibold text-white shadow-md shadow-emerald-900/15 transition active:scale-[0.99]"
                >
                  Comprar ahora
                  <ArrowRight className="h-4 w-4 transition group-active:translate-x-0.5" aria-hidden="true" />
                </Link>
              </div>
            </article>
          )
        })}
      </div>
    </section>
  )
}
