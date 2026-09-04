"use client"

import { Banknote, CreditCard, Smartphone, Wallet } from "lucide-react"
import type { LucideIcon } from "lucide-react"

import type { MetodoPago } from "@/lib/pagos"

/** El ícono es lo único que sigue en el código: el resto sale de la base. */
const ICONOS: Record<string, LucideIcon> = {
  "pago-movil": Smartphone,
  zelle: Wallet,
  efectivo: Banknote,
  tarjeta: CreditCard,
}

type Props = {
  value: string
  onChange: (value: string) => void
  metodos: MetodoPago[]
  /** Sin cuenta no se cargan: los datos de pago son solo para quien entró. */
  sinSesion: boolean
}

export function PaymentMethods({ value, onChange, metodos, sinSesion }: Props) {
  return (
    <section
      aria-labelledby="pay-heading"
      className="rounded-2xl border border-gray-100 bg-white p-4 shadow-sm"
    >
      <h2 id="pay-heading" className="mb-4 text-base font-semibold text-gray-900">
        Método de pago
      </h2>

      {metodos.length === 0 ? (
        <p className="rounded-xl bg-amber-50 px-3 py-2.5 text-sm leading-relaxed text-amber-800">
          {sinSesion
            ? "Entra a tu cuenta para ver cómo pagar."
            : "No hay métodos de pago habilitados. Se cargan desde el panel de administración."}
        </p>
      ) : (
        <fieldset>
          <legend className="sr-only">Métodos de pago</legend>
          <div className="grid grid-cols-2 gap-2">
            {metodos.map((m) => {
              const selected = value === m.id
              const Icon = ICONOS[m.id] ?? Banknote
              return (
                <label
                  key={m.id}
                  className={`flex cursor-pointer flex-col gap-1.5 rounded-xl border p-3 transition-colors ${
                    selected
                      ? "border-emerald-500 bg-emerald-50/60"
                      : "border-gray-200 hover:border-gray-300"
                  }`}
                >
                  <input
                    type="radio"
                    name="payment"
                    value={m.id}
                    checked={selected}
                    onChange={() => onChange(m.id)}
                    className="sr-only"
                  />
                  <Icon className={`h-5 w-5 ${selected ? "text-emerald-600" : "text-gray-400"}`} />
                  <span className="text-sm font-medium text-gray-900">{m.label}</span>
                  {m.hint && <span className="text-xs text-gray-500">{m.hint}</span>}
                </label>
              )
            })}
          </div>
        </fieldset>
      )}

      {/* Se muestra desde ya: quien va a pagar por transferencia quiere saber a
          dónde antes de confirmar, no después. */}
      {metodos.find((m) => m.id === value)?.instructions && (
        <div className="mt-3 rounded-xl bg-gray-50 px-3 py-2.5">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-gray-400">
            A dónde pagar
          </p>
          <p className="mt-1 whitespace-pre-line text-sm leading-relaxed text-gray-700">
            {metodos.find((m) => m.id === value)?.instructions}
          </p>
        </div>
      )}
    </section>
  )
}
