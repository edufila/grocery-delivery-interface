import { BadgePercent, Bike, Clock } from "lucide-react"

import { bsEquivalent, formatBolivares } from "@/lib/pagos"

type Props = {
  name: string
  image?: string | null
  tag?: string | null
  eta?: string | null
  deliveryFee?: number | null
  tasaVes?: number | null
}

/**
 * La portada de un abasto, arriba del catálogo.
 *
 * Antes el catálogo abría con una franja verde que decía "Ahorra hasta 30%
 * comprando al mayor": un número que venía con la plantilla y que nadie midió,
 * igual que las reseñas que ya se quitaron. En su lugar, lo que sí es cierto y
 * sí sirve para decidir: la foto del local, cuánto tarda y cuánto cuesta el
 * envío -- lo mismo que la tarjeta del inicio, para que se reconozca al entrar.
 *
 * No es fija: al bajar se va, y queda arriba solo la barra con el buscador y las
 * categorías, que es lo que se usa mientras se compra.
 */
export function StoreHero({ name, image, tag, eta, deliveryFee, tasaVes }: Props) {
  const bs = deliveryFee != null ? bsEquivalent(Number(deliveryFee), tasaVes ?? null) : null

  return (
    <div className="pt-barra-estado bg-white">
      <div className="mx-auto max-w-3xl px-4 pt-3">
        <div className="relative h-40 animate-[entra_0.35s_ease-out] overflow-hidden rounded-3xl bg-gradient-to-br from-emerald-600 to-emerald-800 shadow-md shadow-gray-900/10">
          {image && (
            <img
              src={image}
              alt=""
              className="absolute inset-0 h-full w-full object-cover"
              decoding="async"
              // Es lo primero que se ve al entrar: se pide ya.
              fetchPriority="high"
            />
          )}
          {/* Oscurece desde abajo, donde va el texto: sin esto, el blanco
              sobre una fachada clara no se leía. */}
          <div
            className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/35 to-black/0"
            aria-hidden="true"
          />

          <div className="absolute inset-x-0 bottom-0 p-4 text-white">
            {tag && (
              <span className="mb-1.5 inline-flex items-center gap-1 rounded-full bg-emerald-600 px-2.5 py-0.5 text-xs font-semibold">
                <BadgePercent className="h-3.5 w-3.5" aria-hidden="true" />
                {tag}
              </span>
            )}
            <h1 className="truncate text-2xl font-bold leading-tight tracking-tight">{name}</h1>
            {(eta || deliveryFee != null) && (
              <p className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-sm font-medium">
                {eta && (
                  <span className="inline-flex items-center gap-1.5">
                    <Clock className="h-4 w-4" aria-hidden="true" />
                    {eta}
                  </span>
                )}
                {deliveryFee != null && (
                  <span className="inline-flex items-center gap-1.5">
                    <Bike className="h-4 w-4" aria-hidden="true" />
                    Envío ${Number(deliveryFee).toFixed(2)}
                    {bs != null && <span>· Bs {formatBolivares(bs)}</span>}
                  </span>
                )}
              </p>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
