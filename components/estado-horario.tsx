"use client"

import { useEffect, useState } from "react"
import { Clock } from "lucide-react"

import { estadoHorario, type EstadoHorario } from "@/lib/horario"

/**
 * Abierto o cerrado, calculado en el teléfono.
 *
 * No en el servidor: el inicio sale de caché, y un "Abierto" calculado ahí
 * podía seguir diciéndose un rato después de cerrar. Antes de montar no dice
 * nada, y se recalcula cada minuto con la pantalla abierta.
 */
export function useHorario(abre?: string | null, cierra?: string | null): EstadoHorario | null {
  const [estado, setEstado] = useState<EstadoHorario | null>(null)

  useEffect(() => {
    const calcular = () => setEstado(estadoHorario(abre, cierra))
    calcular()
    const id = window.setInterval(calcular, 60_000)
    return () => window.clearInterval(id)
  }, [abre, cierra])

  return estado
}

/** La pastilla sobre la foto del abasto. Sin horario cargado no aparece. */
export function PastillaHorario({ abre, cierra }: { abre?: string | null; cierra?: string | null }) {
  const estado = useHorario(abre, cierra)
  if (!estado?.texto) return null

  const color = !estado.abierto
    ? "bg-gray-900/85 text-white"
    : estado.cierraPronto
      ? "bg-amber-700 text-white"
      : "bg-white/90 text-gray-900"

  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-semibold shadow-sm backdrop-blur ${color}`}
    >
      <Clock className="h-3.5 w-3.5" aria-hidden="true" />
      {estado.texto}
    </span>
  )
}
