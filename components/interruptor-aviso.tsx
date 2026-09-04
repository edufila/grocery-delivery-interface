"use client"

import { Bell, BellOff } from "lucide-react"

/**
 * El interruptor de "avísame". Lo comparten el panel del shopper y el de
 * administración: el aparato de sonido y notificación vive en `useAviso`, y
 * esto es solo cómo se ve y por dónde se enciende.
 */
export function InterruptorAviso({
  titulo,
  encendido,
  textoEncendido,
  textoApagado,
  bloqueado,
  onAlternar,
}: {
  titulo: string
  encendido: boolean
  textoEncendido: string
  /** Aquí conviene decir qué se pierde estando apagado, no repetir el título. */
  textoApagado: string
  bloqueado: boolean
  onAlternar: () => void
}) {
  return (
    <section className="rounded-2xl border border-gray-100 bg-white p-4">
      <div className="flex items-center gap-3">
        <span
          className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full ${
            encendido ? "bg-emerald-50" : "bg-gray-100"
          }`}
        >
          {encendido ? (
            <Bell className="h-5 w-5 text-emerald-600" aria-hidden="true" />
          ) : (
            <BellOff className="h-5 w-5 text-gray-400" aria-hidden="true" />
          )}
        </span>

        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold text-gray-900">{titulo}</p>
          <p className="text-sm leading-relaxed text-gray-500">
            {encendido ? textoEncendido : textoApagado}
          </p>
        </div>

        <button
          type="button"
          onClick={onAlternar}
          role="switch"
          aria-checked={encendido}
          aria-label={titulo}
          className={`relative h-7 w-12 shrink-0 rounded-full transition ${
            encendido ? "bg-emerald-600" : "bg-gray-200"
          }`}
        >
          <span
            className={`absolute top-1 h-5 w-5 rounded-full bg-white transition-all ${
              encendido ? "left-6" : "left-1"
            }`}
          />
        </button>
      </div>

      {encendido && bloqueado && (
        <p className="mt-3 rounded-xl bg-amber-50 px-3 py-2.5 text-sm leading-relaxed text-amber-800">
          Bloqueaste las notificaciones para este sitio, así que solo va a sonar y vibrar. Para
          verlas en pantalla hay que habilitarlas en los ajustes del navegador.
        </p>
      )}
    </section>
  )
}
