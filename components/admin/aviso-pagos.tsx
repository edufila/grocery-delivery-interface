"use client"

import { useEffect, useRef } from "react"
import { useRouter } from "next/navigation"

import { InterruptorAviso } from "@/components/interruptor-aviso"
import { createClient } from "@/lib/supabase/client"
import { isSupabaseConfigured } from "@/lib/supabase/config"
import { useAviso } from "@/lib/usar-aviso"

/**
 * Avisa al abasto cuando un cliente reporta que pagó.
 *
 * Es el momento en que hay algo que hacer: ir al banco, buscar el monto y
 * confirmarlo. Sin aviso había que acordarse de entrar al panel a ver si
 * alguien había reportado, y mientras tanto el pedido esperaba.
 *
 * Cuando el pago se concilia solo -- porque el monto ya estaba registrado --
 * esto no suena, y está bien: no hay nada que revisar.
 */
export function AvisoPagos() {
  const router = useRouter()
  const { encendido, alternar, avisar, bloqueado } = useAviso("abasto:avisos-pagos")
  const refrescar = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    if (!encendido || !isSupabaseConfigured) return

    const supabase = createClient()
    const canal = supabase
      .channel("aviso-pagos")
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "orders" },
        (payload) => {
          const antes = payload.old as { payment_reference?: string | null }
          const ahora = payload.new as {
            code: string
            payment_reference: string | null
            payment_verified_at: string | null
          }

          // Solo cuando aparece o cambia una referencia sin verificar. El resto
          // de los cambios de un pedido -- estado, ubicación del shopper --
          // pasan por aquí todo el tiempo y no tienen nada que ver.
          const reportoAhora =
            ahora.payment_reference != null &&
            ahora.payment_reference !== antes?.payment_reference

          if (!reportoAhora || ahora.payment_verified_at != null) return

          avisar(
            "Pago reportado",
            `El pedido ${ahora.code} dice haber pagado. Ref. ${ahora.payment_reference}`,
            `pago-${ahora.code}`,
          )

          // Varios seguidos rearman la lista una sola vez.
          if (refrescar.current) clearTimeout(refrescar.current)
          refrescar.current = setTimeout(() => router.refresh(), 1200)
        },
      )
      .subscribe()

    return () => {
      if (refrescar.current) clearTimeout(refrescar.current)
      void supabase.removeChannel(canal)
    }
  }, [encendido, avisar, router])

  return (
    <InterruptorAviso
      titulo="Avisarme cuando reporten un pago"
      encendido={encendido}
      textoEncendido="Suena y vibra en cuanto alguien dice que pagó. Deja esta pantalla abierta."
      textoApagado="Ahora mismo hay que entrar a mirar si alguien reportó."
      bloqueado={bloqueado}
      onAlternar={() => void alternar()}
    />
  )
}
