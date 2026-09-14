"use client"

import { InterruptorAviso } from "@/components/interruptor-aviso"
import { useAviso } from "@/lib/usar-aviso"

/**
 * "Avisarme cuando avance", en el seguimiento.
 *
 * Encenderlo registra este teléfono para recibir notificaciones con la app
 * cerrada: pago confirmado, comprando, en camino, entregado. Qué dice cada una
 * lo decide la base (avisos_pendientes, 0047) y quién la dispara, el shopper o
 * el abasto al avanzar el pedido.
 *
 * Es el mismo interruptor que usan el shopper y el panel: una sola forma de
 * pedir avisos en toda la app. Con la pantalla abierta no hace falta -- el
 * seguimiento ya se actualiza solo --, así que aquí lo que importa es lo de
 * la app cerrada.
 */
export function AvisamePedido() {
  const { encendido, alternar, cerrado, bloqueado } = useAviso("abasto:avisos-cliente")

  return (
    <InterruptorAviso
      titulo="Avisarme cuando avance"
      encendido={encendido}
      textoEncendido="Te llega cuando confirmemos el pago, empiecen a comprar y salga en camino."
      textoApagado="Si cierras la app, no te enteras hasta volver a abrirla."
      bloqueado={bloqueado}
      cerrado={cerrado}
      onAlternar={() => void alternar()}
    />
  )
}
