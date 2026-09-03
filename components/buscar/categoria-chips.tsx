import Link from "next/link"

import { categories, type Category } from "@/lib/categories"

/**
 * Las categorías de la pantalla general. Filtran en todos los abastos a la
 * vez: las que están dentro del catálogo de un local filtran solo ese local,
 * que es lo que corresponde ahí.
 *
 * Son enlaces y no botones a propósito: el filtro queda en la dirección, así
 * el resultado se puede compartir y el botón de atrás del teléfono deshace el
 * último filtro en vez de salirse de la pantalla.
 */
export function CategoriaChips({
  activa,
  termino,
  mayorista,
}: {
  activa: Category
  termino: string
  mayorista: boolean
}) {
  const enlace = (categoria: Category) => {
    const partes: string[] = []
    if (termino) partes.push(`q=${encodeURIComponent(termino)}`)
    if (categoria !== "Todos") partes.push(`categoria=${encodeURIComponent(categoria)}`)
    if (mayorista) partes.push("mayorista=1")
    return partes.length ? `/buscar?${partes.join("&")}` : "/buscar"
  }

  return (
    <nav aria-label="Categorías" className="mx-auto max-w-md">
      <ul className="flex gap-2 overflow-x-auto px-4 pb-3 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {categories.map((categoria) => {
          const esActiva = categoria === activa
          return (
            <li key={categoria} className="shrink-0">
              <Link
                href={enlace(categoria)}
                aria-current={esActiva ? "true" : undefined}
                className={`flex min-h-9 items-center rounded-full px-3.5 text-sm font-medium transition ${
                  esActiva
                    ? "bg-emerald-600 text-white"
                    : "border border-gray-200 bg-white text-gray-600 active:bg-gray-50"
                }`}
              >
                {categoria}
              </Link>
            </li>
          )
        })}
      </ul>
    </nav>
  )
}
