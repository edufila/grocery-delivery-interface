import Link from "next/link"
import { Apple, Pill, Sandwich, Wrench } from "lucide-react"
import type { LucideIcon } from "lucide-react"

type CategoriaNegocio = {
  id: string
  label: string
  Icon: LucideIcon
  gradient: string
  href: string | null
}

/**
 * Atajos de tipo de negocio (víveres, restaurantes, farmacia, ferretería),
 * no de producto: esos ya existen dentro de cada catálogo y en Explorar.
 * Hoy todos los abastos son de víveres, así que es lo único que lleva a algo
 * real; el resto queda marcado "Pronto" en vez de simular un local que no
 * existe.
 *
 * EL COLOR DICE SI SE PUEDE ENTRAR, y por eso solo lo tiene el que se puede.
 * Antes los cuatro venían con su degradado a todo brillo, así que las tres
 * cosas más llamativas del inicio eran justo las tres que no llevan a ningún
 * lado: uno entraba, le saltaban a la vista, tocaba, y no pasaba nada. Las que
 * todavía no existen quedan en gris -- se siguen viendo y siguen contando lo
 * que viene, pero no le ganan el ojo a lo único que hoy se puede comprar.
 */
const categorias: CategoriaNegocio[] = [
  {
    id: "viveres",
    label: "Víveres",
    Icon: Apple,
    gradient: "from-emerald-400 to-emerald-600",
    href: "/buscar",
  },
  {
    id: "restaurantes",
    label: "Restaurantes",
    Icon: Sandwich,
    gradient: "from-orange-400 to-rose-500",
    href: null,
  },
  {
    id: "farmacia",
    label: "Farmacia",
    Icon: Pill,
    gradient: "from-sky-400 to-blue-600",
    href: null,
  },
  {
    id: "ferreteria",
    label: "Ferretería",
    Icon: Wrench,
    gradient: "from-amber-400 to-amber-600",
    href: null,
  },
]

export function CategoryShortcuts() {
  return (
    <section aria-labelledby="categorias-heading" className="pt-3">
      <h2 id="categorias-heading" className="sr-only">
        Categorías
      </h2>
      {/* `pr-6` y no `pr-4`: la insignia de "Pronto" sobresale del recuadro, y
          con el mismo margen de los lados quedaba cortada contra el borde. */}
      <div className="mx-auto flex max-w-md gap-4 overflow-x-auto px-4 pb-1 pr-6 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {categorias.map((categoria, index) => {
          const disponible = categoria.href !== null

          const contenido = (
            <>
              <span
                className={`flex h-16 w-16 items-center justify-center rounded-3xl animate-[cat-pop_0.5s_ease-out_backwards] ${
                  disponible
                    ? `bg-gradient-to-br ${categoria.gradient} shadow-md shadow-black/10`
                    : "bg-gray-100 ring-1 ring-gray-200/70"
                }`}
                style={{ animationDelay: `${index * 80}ms` }}
              >
                <categoria.Icon
                  className={`h-8 w-8 ${disponible ? "text-white" : "text-gray-400"}`}
                  strokeWidth={2.2}
                  aria-hidden="true"
                />
              </span>
              <span
                className={`text-xs font-semibold ${disponible ? "text-gray-700" : "text-gray-400"}`}
              >
                {categoria.label}
              </span>
              {!disponible && (
                <span className="absolute -right-1 -top-1 rounded-full bg-white px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wide text-gray-500 shadow-sm ring-1 ring-gray-200">
                  Pronto
                </span>
              )}
            </>
          )

          if (!disponible) {
            /* Sin `aria-label`: el "Pronto" está a la vista y se lee solo. Un
               aria-label encima lo repetiría, y en un div sin rol hay lectores
               que directamente lo ignoran. */
            return (
              <div
                key={categoria.id}
                className="relative flex w-20 shrink-0 flex-col items-center gap-1.5 text-center"
              >
                {contenido}
              </div>
            )
          }

          return (
            <Link
              key={categoria.id}
              href={categoria.href!}
              className="relative flex w-20 shrink-0 flex-col items-center gap-1.5 text-center transition active:scale-95"
            >
              {contenido}
            </Link>
          )
        })}
      </div>
    </section>
  )
}
