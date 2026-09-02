"use client"

import { Banknote, CreditCard, Smartphone, Wallet } from "lucide-react"

const METHODS = [
  { value: "pago-movil", label: "Pago Móvil", hint: "En Bs.", icon: Smartphone },
  { value: "zelle", label: "Zelle", hint: "En USD", icon: Wallet },
  { value: "efectivo", label: "Efectivo divisas", hint: "Contra entrega", icon: Banknote },
  { value: "tarjeta", label: "Tarjeta", hint: "Crédito / Débito", icon: CreditCard },
] as const

type Props = {
  value: string
  onChange: (value: string) => void
}

export function PaymentMethods({ value, onChange }: Props) {
  return (
    <section aria-labelledby="pay-heading" className="rounded-2xl border border-gray-100 bg-white p-4 shadow-sm">
      <h2 id="pay-heading" className="mb-4 text-base font-semibold text-gray-900">
        Método de pago
      </h2>

      <fieldset>
        <legend className="sr-only">Métodos de pago</legend>
        <div className="grid grid-cols-2 gap-2">
          {METHODS.map((m) => {
            const selected = value === m.value
            const Icon = m.icon
            return (
              <label
                key={m.value}
                className={`flex cursor-pointer flex-col gap-1.5 rounded-xl border p-3 transition-colors ${
                  selected ? "border-emerald-500 bg-emerald-50/60" : "border-gray-200 hover:border-gray-300"
                }`}
              >
                <input
                  type="radio"
                  name="payment"
                  value={m.value}
                  checked={selected}
                  onChange={() => onChange(m.value)}
                  className="sr-only"
                />
                <Icon className={`h-5 w-5 ${selected ? "text-emerald-600" : "text-gray-400"}`} />
                <span className="text-sm font-medium text-gray-900">{m.label}</span>
                <span className="text-xs text-gray-500">{m.hint}</span>
              </label>
            )
          })}
        </div>
      </fieldset>
    </section>
  )
}
