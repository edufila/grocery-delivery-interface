"use client"

import { useCallback, useEffect, useState } from "react"

import { createClient } from "@/lib/supabase/client"
import { isSupabaseConfigured } from "@/lib/supabase/config"

/**
 * Los productos que alguien marcó como habituales.
 *
 * Viven en la cuenta y no en el teléfono: la lista de lo que uno compra siempre
 * tiene que seguir a la persona cuando cambia de equipo.
 *
 * Sin sesión el corazón no se muestra: guardar favoritos de un anónimo en el
 * navegador es prometer algo que se pierde al primer cambio de teléfono.
 */
export function useFavoritos() {
  const [ids, setIds] = useState<Set<string>>(new Set())
  const [haySesion, setHaySesion] = useState(false)

  useEffect(() => {
    if (!isSupabaseConfigured) return
    let cancelado = false

    void (async () => {
      const supabase = createClient()
      const {
        data: { user },
      } = await supabase.auth.getUser()
      if (!user || cancelado) return

      const { data } = await supabase
        .from("product_favorites")
        .select("product_id")
        .returns<{ product_id: string }[]>()

      if (cancelado) return
      setHaySesion(true)
      setIds(new Set((data ?? []).map((f) => f.product_id)))
    })()

    return () => {
      cancelado = true
    }
  }, [])

  const alternar = useCallback(
    (productId: string) => {
      const eraFavorito = ids.has(productId)
      const siguiente = new Set(ids)
      if (eraFavorito) siguiente.delete(productId)
      else siguiente.add(productId)

      // Se pinta primero: tocar un corazón tiene que responder al instante.
      setIds(siguiente)

      void (async () => {
        const supabase = createClient()
        const {
          data: { user },
        } = await supabase.auth.getUser()
        if (!user) return

        const { error } = eraFavorito
          ? await supabase
              .from("product_favorites")
              .delete()
              .eq("user_id", user.id)
              .eq("product_id", productId)
          : await supabase
              .from("product_favorites")
              .insert({ user_id: user.id, product_id: productId })

        // Si falló, se vuelve a como estaba en vez de mentir.
        if (error) setIds(ids)
      })()
    },
    [ids],
  )

  return { ids, alternar, haySesion }
}
