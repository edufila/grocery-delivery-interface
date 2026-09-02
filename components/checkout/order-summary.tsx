type Props = {
  subtotal: number
  serviceFee: number
  deliveryFee: number
}

function Row({ label, value, muted }: { label: string; value: string; muted?: boolean }) {
  return (
    <div className="flex items-center justify-between text-sm">
      <span className={muted ? "text-gray-500" : "text-gray-700"}>{label}</span>
      <span className={`tabular-nums ${muted ? "text-gray-500" : "font-medium text-gray-900"}`}>{value}</span>
    </div>
  )
}

export function OrderSummary({ subtotal, serviceFee, deliveryFee }: Props) {
  const total = subtotal + serviceFee + deliveryFee

  return (
    <section aria-labelledby="summary-heading" className="rounded-2xl border border-gray-100 bg-white p-4 shadow-sm">
      <h2 id="summary-heading" className="mb-4 text-base font-semibold text-gray-900">
        Resumen de pago
      </h2>

      <div className="space-y-2.5">
        <Row label="Subtotal" value={`$${subtotal.toFixed(2)}`} />
        <Row label="Tarifa de servicio" value={`$${serviceFee.toFixed(2)}`} muted />
        <Row label="Costo de delivery" value={`$${deliveryFee.toFixed(2)}`} muted />

        <div className="my-2 border-t border-dashed border-gray-200" />

        <div className="flex items-center justify-between">
          <span className="text-base font-semibold text-gray-900">Total a pagar</span>
          <span className="text-xl font-bold tabular-nums text-emerald-600">${total.toFixed(2)}</span>
        </div>
      </div>
    </section>
  )
}
