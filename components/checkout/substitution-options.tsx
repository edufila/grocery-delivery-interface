"use client"

import { Check, MessageCircle, Shuffle, XCircle } from "lucide-react"

const OPTIONS = [
  {
    value: "shopper",
    label: "Permitir que el shopper elija un reemplazo similar",
    description: "Escogeremos el producto más parecido disponible.",
    icon: Shuffle,
  },
  {
    value: "chat",
    label: "Contactarme por chat",
    description: "Te escribiremos antes de reemplazar cualquier artículo.",
    icon: MessageCircle,
  },
  {
    value: "none",
    label: "No reemplazar (dejar fuera)",
    description: "Si falta, simplemente no lo incluimos en tu pedido.",
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
        Opciones de sustitución si falta un producto
      </h2>
      <p className="mb-4 text-xs text-gray-500">Elige qué hacer si algo no está disponible.</p>

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
                    ? "border-emerald-500 bg-emerald-50/60"
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
                    selected ? "border-emerald-500 bg-emerald-500" : "border-gray-300 bg-white"
                  }`}
                  aria-hidden="true"
                >
                  {selected && <Check className="h-3 w-3 text-white" strokeWidth={3} />}
                </span>

                <span className="min-w-0 flex-1">
                  <span className="flex items-center gap-1.5 text-sm font-medium text-gray-900">
                    <Icon className={`h-4 w-4 ${selected ? "text-emerald-600" : "text-gray-400"}`} />
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
