"use client"

import { useEffect } from "react"
import { useRouter } from "next/navigation"

import { InterruptorAviso } from "@/components/interruptor-aviso"
import { createClient } from "@/lib/supabase/client"
import { isSupabaseConfigured } from "@/lib/supabase/config"
import { useAviso } from "@/lib/usar-aviso"

/**
 * Avisa al shopper cuando entra un pedido sin dueño.
 *
 * La lista se actualizaba sola pero en silencio: había que estar mirando la
 * pantalla, y con el teléfono en el bolsillo el pedido se enfriaba.
 */
export function AvisoPedidos({ userId }: { userId: string }) {
  const router = useRouter()
  const { encendido, alternar, avisar, bloqueado } = useAviso("abasto:avisos-shopper")

  useEffect(() => {
    if (!encendido || !isSupabaseConfigured) return

    const supabase = createClient()
    const canal = supabase
      .channel("aviso-pedidos")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "orders" },
        (payload) => {
          const fila = payload.new as { shopper_id: string | null; code: string }
          // Solo los que están esperando a alguien. Los propios ya se saben.
          if (fila.shopper_id) return

          avisar("Pedido nuevo", `El ${fila.code} está esperando shopper.`, `pedido-${fila.code}`)
          router.refresh()
        },
      )
      .subscribe()

    return () => {
      void supabase.removeChannel(canal)
    }
  }, [encendido, avisar, router, userId])

  return (
    <InterruptorAviso
      titulo="Avisarme de pedidos nuevos"
      encendido={encendido}
      textoEncendido="Suena y vibra cuando entra uno. Deja esta pantalla abierta."
      textoApagado="Ahora mismo tienes que estar mirando la pantalla."
      bloqueado={bloqueado}
      onAlternar={() => void alternar()}
    />
  )
}
