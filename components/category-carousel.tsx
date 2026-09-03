import Link from "next/link"
import { Droplet, Wheat, SprayCan, Beef, CupSoda, Milk } from "lucide-react"
import type { LucideIcon } from "lucide-react"

type Category = {
  label: string
  Icon: LucideIcon
  color: string
  bg: string
}

const categories: Category[] = [
  { label: "Aceites", Icon: Droplet, color: "text-amber-600", bg: "bg-amber-50" },
  { label: "Granos", Icon: Wheat, color: "text-yellow-700", bg: "bg-yellow-50" },
  { label: "Limpieza", Icon: SprayCan, color: "text-sky-600", bg: "bg-sky-50" },
  { label: "Proteínas", Icon: Beef, color: "text-rose-600", bg: "bg-rose-50" },
  { label: "Bebidas", Icon: CupSoda, color: "text-emerald-600", bg: "bg-emerald-50" },
  { label: "Lácteos", Icon: Milk, color: "text-indigo-600", bg: "bg-indigo-50" },
]

export function CategoryCarousel() {
  return (
    <section className="pt-4" aria-labelledby="categories-heading">
      <div className="mx-auto flex max-w-md items-center justify-between px-4">
        <h2 id="categories-heading" className="text-base font-semibold text-gray-900">
          Categorías
        </h2>
        <Link
          href="/catalogo"
          className="-mr-2 flex min-h-11 items-center px-2 text-sm font-medium text-emerald-600"
        >
          Ver todas
        </Link>
      </div>
      <div className="mx-auto max-w-md">
        <ul className="flex snap-x gap-4 overflow-x-auto px-4 py-4 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {categories.map(({ label, Icon, color, bg }) => (
            <li key={label} className="snap-start">
              <Link
                href={`/catalogo?categoria=${encodeURIComponent(label)}`}
                className="flex w-16 flex-col items-center gap-2"
              >
                <span
                  className={`flex h-16 w-16 items-center justify-center rounded-full ${bg} ring-1 ring-black/[0.03] transition active:scale-95`}
                >
                  <Icon className={`h-7 w-7 ${color}`} aria-hidden="true" />
                </span>
                <span className="text-center text-xs font-medium leading-tight text-gray-700">
                  {label}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      </div>
    </section>
  )
}
