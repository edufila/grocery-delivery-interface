"use client"

import { useEffect, useMemo, useState } from "react"
import { CalendarClock, Zap } from "lucide-react"

import { turnosDeEntrega, type Turno } from "@/lib/horario"

/**
 * Lo antes posible, o para una hora (0051).
 *
 * Con el abasto cerrado, "lo antes posible" no se puede: la tarjeta abre
 * directo en programar, así la persona que arma el mercado de noche lo deja
 * listo para la mañana en vez de irse.
 *
 * Los turnos se calculan en el teléfono al montar -- dependen de la hora --, y
 * la base vuelve a validar el elegido al pedir.
 */
export function CuandoEntregar({
  abre,
  cierra,
  cerrado,
  eta,
  value,
  onChange,
  onProgramar,
}: {
  abre?: string | null
  cierra?: string | null
  cerrado: boolean
  /** "30-40 min", para decir cuánto es "lo antes posible". */
  eta?: string | null
  value: string | null
  onChange: (iso: string | null) => void
  /** Si está en "Programar": sin hora elegida, el pedido no debe salir como lo antes posible. */
  onProgramar: (programar: boolean) => void
}) {
  const [turnos, setTurnos] = useState<Turno[]>([])
  const [programar, setProgramarLocal] = useState(cerrado)
  const [dia, setDia] = useState<string | null>(null)

  const setProgramar = (valor: boolean) => {
    setProgramarLocal(valor)
    onProgramar(valor)
  }

  useEffect(() => {
    setTurnos(turnosDeEntrega(abre, cierra))
  }, [abre, cierra, programar])

  // Cerrado (al entrar, o porque cerró con la pantalla abierta): a programar.
  useEffect(() => {
    if (cerrado) {
      setProgramarLocal(true)
      onProgramar(true)
    }
  }, [cerrado, onProgramar])

  const dias = useMemo(() => [...new Set(turnos.map((t) => t.dia))], [turnos])
  const diaVisible = dia && dias.includes(dia) ? dia : (dias[0] ?? null)
  const deEseDia = turnos.filter((t) => t.dia === diaVisible)

  return (
    <section
      className="rounded-2xl border border-gray-100 bg-white p-4 shadow-sm"
      aria-labelledby="cuando-titulo"
    >
      <h2 id="cuando-titulo" className="text-base font-semibold text-gray-900">
        ¿Cuándo te lo llevamos?
      </h2>

      <div className="mt-3 grid grid-cols-2 gap-2" role="radiogroup" aria-labelledby="cuando-titulo">
        <button
          type="button"
          role="radio"
          aria-checked={!programar}
          disabled={cerrado}
          onClick={() => {
            setProgramar(false)
            onChange(null)
          }}
          className={`flex min-h-16 flex-col items-start justify-center rounded-xl border px-3 py-2 text-left transition disabled:border-gray-100 disabled:bg-gray-50 ${
            !programar ? "border-emerald-600 bg-emerald-50" : "border-gray-200 bg-white"
          }`}
        >
          <span className="flex items-center gap-1.5 text-sm font-semibold text-gray-900">
            <Zap className="h-4 w-4 text-emerald-600" aria-hidden="true" />
            Lo antes posible
          </span>
          <span className="text-xs text-gray-500">
            {cerrado ? "Cerrado ahora" : eta ? `Unos ${eta}` : "Hoy"}
          </span>
        </button>

        <button
          type="button"
          role="radio"
          aria-checked={programar}
          onClick={() => setProgramar(true)}
          className={`flex min-h-16 flex-col items-start justify-center rounded-xl border px-3 py-2 text-left transition ${
            programar ? "border-emerald-600 bg-emerald-50" : "border-gray-200 bg-white"
          }`}
        >
          <span className="flex items-center gap-1.5 text-sm font-semibold text-gray-900">
            <CalendarClock className="h-4 w-4 text-emerald-600" aria-hidden="true" />
            Programar
          </span>
          <span className="text-xs text-gray-500">Hoy o los próximos días</span>
        </button>
      </div>

      {programar &&
        (turnos.length === 0 ? (
          <p className="mt-3 text-sm text-gray-500">No hay horas disponibles en los próximos días.</p>
        ) : (
          <div className="mt-4">
            <div className="flex gap-2 overflow-x-auto pb-1 [scrollbar-width:none]">
              {dias.map((d) => (
                <button
                  key={d}
                  type="button"
                  onClick={() => setDia(d)}
                  aria-pressed={d === diaVisible}
                  className={`min-h-11 shrink-0 rounded-full px-4 text-sm font-medium transition ${
                    d === diaVisible
                      ? "bg-gray-900 text-white"
                      : "border border-gray-200 bg-white text-gray-700"
                  }`}
                >
                  {d}
                </button>
              ))}
            </div>

            <p className="mt-3 text-xs text-gray-500">Llega a partir de:</p>
            <div className="mt-1.5 grid grid-cols-3 gap-2">
              {deEseDia.map((t) => {
                const elegido = value === t.iso
                return (
                  <button
                    key={t.iso}
                    type="button"
                    onClick={() => onChange(t.iso)}
                    aria-pressed={elegido}
                    aria-label={`${t.dia}, ${t.hora}`}
                    className={`min-h-11 rounded-xl text-sm font-medium tabular-nums transition active:scale-95 ${
                      elegido
                        ? "bg-emerald-600 text-white"
                        : "border border-gray-200 bg-white text-gray-700"
                    }`}
                  >
                    {t.hora}
                  </button>
                )
              })}
            </div>
          </div>
        ))}
    </section>
  )
}
