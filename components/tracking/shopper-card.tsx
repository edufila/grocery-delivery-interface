import { User } from "lucide-react"

export type OrderShopper = {
  full_name: string | null
  avatar_url: string | null
  handle: string | null
}

/**
 * Quién le va a tocar la puerta. Nombre y foto los pone la empresa: el shopper
 * no puede cambiarlos, para que lo que ve el cliente sea confiable.
 */
export function ShopperCard({ shopper }: { shopper: OrderShopper }) {
  const nombre = shopper.full_name || (shopper.handle ? `@${shopper.handle}` : "Tu shopper")

  return (
    <section className="flex items-center gap-3 rounded-2xl border border-gray-100 bg-white p-4 shadow-sm">
      {shopper.avatar_url ? (
        <img
          src={shopper.avatar_url}
          alt=""
          className="h-12 w-12 shrink-0 rounded-full bg-gray-100 object-cover"
        />
      ) : (
        <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-emerald-50">
          <User className="h-6 w-6 text-emerald-600" aria-hidden="true" />
        </span>
      )}

      <div className="min-w-0 flex-1">
        <p className="text-[11px] font-medium uppercase tracking-wide text-gray-400">
          Tu shopper
        </p>
        <p className="truncate text-sm font-semibold text-gray-900">{nombre}</p>
        {shopper.handle && shopper.full_name && (
          <p className="truncate text-sm text-gray-500">@{shopper.handle}</p>
        )}
      </div>
    </section>
  )
}
