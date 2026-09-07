"use client"

import { useEffect, useRef } from "react"
import { useRouter } from "next/navigation"

import { InterruptorAviso } from "@/components/interruptor-aviso"
import { createClient } from "@/lib/supabase/client"
import { isSupabaseConfigured } from "@/lib/supabase/config"
import { useAviso } from "@/lib/usar-aviso"

type FilaPedido = {
  code: string
  shopper_id: string | null
  status: string | null
  /** Falta hasta que se corra la 0037; entonces se asume que sí espera pago. */
  payment_required?: boolean | null
  payment_verified_at?: string | null
}

/**
 * Avisa al shopper cuando hay un pedido listo para tomar.
 *
 * La lista se actualizaba sola pero en silencio: había que estar mirando la
 * pantalla, y con el teléfono en el bolsillo el pedido se enfriaba.
 *
 * El momento en que hay que avisar dejó de ser el de la compra. Ahora un pedido
 * entra, espera a que el abasto confirme el pago, y recién ahí sale a buscar
 * shopper: avisar al entrar sería mandar a alguien por un pedido que todavía no
 * puede tomar. Por eso se escuchan también las modificaciones, que es donde
 * llega el momento real -- el de la confirmación.
 */
export function AvisoPedidos({ userId }: { userId: string }) {
  const router = useRouter()
  const { encendido, alternar, avisar, bloqueado } = useAviso("abasto:avisos-shopper")
  /** Qué pedidos ya se avisaron: un pedido cambia varias veces de fila. */
  const avisados = useRef<Set<string>>(new Set())

  useEffect(() => {
    if (!encendido || !isSupabaseConfigured) return

    const supabase = createClient()
    const canal = supabase
      .channel("aviso-pedidos")
      .on("postgres_changes", { event: "*", schema: "public", table: "orders" }, (payload) => {
        const fila = payload.new as FilaPedido
        if (!fila?.code) return

        // Los propios ya se saben, y los tomados por otro no son noticia.
        if (fila.shopper_id) return
        if (fila.status && fila.status !== "confirmado") return

        /**
         * Las políticas ya impiden que llegue un pedido sin pagar, pero se
         * comprueba igual: si esa condición se aflojara alguna vez, el error
         * sería mandar a un shopper a comprar mercancía que nadie pagó.
         */
        const esperaPago = fila.payment_required !== false
        if (esperaPago && !fila.payment_verified_at) return

        if (avisados.current.has(fila.code)) return
        avisados.current.add(fila.code)

        avisar(
          "Pedido listo",
          `El ${fila.code} está pagado y esperando shopper.`,
          `pedido-${fila.code}`,
        )
        router.refresh()
      })
      .subscribe()

    return () => {
      void supabase.removeChannel(canal)
    }
  }, [encendido, avisar, router, userId])

  return (
    <InterruptorAviso
      titulo="Avisarme de pedidos nuevos"
      encendido={encendido}
      textoEncendido="Suena y vibra cuando uno queda listo para tomar."
      textoApagado="Ahora mismo tienes que estar mirando la pantalla."
      bloqueado={bloqueado}
      onAlternar={() => void alternar()}
    />
  )
}
