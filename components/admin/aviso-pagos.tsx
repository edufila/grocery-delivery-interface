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
  /** Qué pagos ya se avisaron, para no repetir en cada cambio del pedido. */
  const avisados = useRef<Set<string>>(new Set())

  useEffect(() => {
    if (!encendido || !isSupabaseConfigured) return

    const supabase = createClient()
    const canal = supabase
      .channel("aviso-pagos")
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "orders" },
        (payload) => {
          const ahora = payload.new as {
            id: string
            code: string
            payment_reference: string | null
            payment_verified_at: string | null
          }

          if (ahora.payment_reference == null || ahora.payment_verified_at != null) return

          /**
           * No se compara contra la fila anterior aunque sea lo natural:
           * Postgres solo la manda si la tabla tiene REPLICA IDENTITY FULL, y
           * por defecto llega vacía. La comparación daba siempre "cambió", así
           * que cada vez que el shopper enviaba su ubicación -- cada quince
           * segundos -- volvía a sonar por un pago ya avisado.
           *
           * Se recuerda qué se avisó en esta pantalla y no se repite.
           */
          const marca = `${ahora.id}:${ahora.payment_reference}`
          if (avisados.current.has(marca)) return
          avisados.current.add(marca)

          avisar(
            "Pago por verificar",
            `El ${ahora.code} está detenido hasta que confirmes. Ref. ${ahora.payment_reference}`,
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
      textoEncendido="Suena y vibra en cuanto alguien dice que pagó. Su pedido queda detenido hasta que lo confirmes."
      textoApagado="Ahora mismo hay que entrar a mirar si alguien reportó, y mientras tanto su pedido no sale."
      bloqueado={bloqueado}
      onAlternar={() => void alternar()}
    />
  )
}
