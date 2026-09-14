"use client"

import { Check, MessageCircle, Shuffle, XCircle } from "lucide-react"

const OPTIONS = [
  {
    value: "shopper",
    label: "Que el shopper elija uno parecido",
    description: "Lo mismo, de otra marca o presentación.",
    icon: Shuffle,
  },
  {
    value: "chat",
    label: "Escríbeme antes por el chat",
    description: "Tu shopper te pregunta antes de cambiar nada.",
    icon: MessageCircle,
  },
  {
    value: "none",
    label: "Déjalo fuera",
    description: "Si no hay, no se lleva y no se te cobra.",
    icon: XCircle,
  },
] as const

type Props = {
  value: string
  onChange: (value: string) => void
}

export function SubstitutionOptions({ value, onChange }: Props) {
  return (
    <section
      aria-labelledby="sub-heading"
      className="rounded-2xl border border-gray-100 bg-white p-4 shadow-sm"
    >
      <h2 id="sub-heading" className="mb-1 text-base font-semibold text-gray-900">
        Si falta un producto
      </h2>
      <p className="mb-4 text-xs text-gray-500">Pasa a veces: el abasto se queda sin algo.</p>

      <fieldset>
        <legend className="sr-only">Opciones de sustitución</legend>
        <div className="space-y-2">
          {OPTIONS.map((opt) => {
            const selected = value === opt.value
            const Icon = opt.icon
            return (
              <label
                key={opt.value}
                className={`flex cursor-pointer items-start gap-3 rounded-xl border p-3 transition-colors ${
                  selected
                    ? "border-emerald-600 bg-emerald-50/60 ring-1 ring-emerald-600"
                    : "border-gray-200 hover:border-gray-300"
                }`}
              >
                <input
                  type="radio"
                  name="substitution"
                  value={opt.value}
                  checked={selected}
                  onChange={() => onChange(opt.value)}
                  className="sr-only"
                />
                <span
                  className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full border-2 transition-colors ${
                    selected ? "border-emerald-600 bg-emerald-600" : "border-gray-400 bg-white"
                  }`}
                  aria-hidden="true"
                >
                  {selected && <Check className="h-3 w-3 text-white" strokeWidth={3} />}
                </span>

                <span className="min-w-0 flex-1">
                  <span className="flex items-center gap-1.5 text-sm font-medium text-gray-900">
                    <Icon className={`h-4 w-4 shrink-0 ${selected ? "text-emerald-600" : "text-gray-500"}`} aria-hidden="true" />
                    {opt.label}
                  </span>
                  <span className="mt-0.5 block text-xs text-gray-500">{opt.description}</span>
                </span>
              </label>
            )
          })}
        </div>
      </fieldset>
    </section>
  )
}
