import type { Metadata } from "next"
import Link from "next/link"
import { PackageSearch, Store } from "lucide-react"

import { BottomNav } from "@/components/bottom-nav"
import { Buscador } from "@/components/buscar/buscador"
import { CategoriaChips } from "@/components/buscar/categoria-chips"
import { pageTitle } from "@/lib/brand"
import { toCategory, type Category } from "@/lib/categories"
import { isSupabaseConfigured } from "@/lib/supabase/config"
import { createClient } from "@/lib/supabase/server"

export const metadata: Metadata = {
  title: pageTitle("Explorar"),
}

type Fila = {
  id: string
  name: string
  unit: string
  price: number
  image: string | null
  store_id: string
}

/**
 * La pantalla general: busca y filtra en TODOS los abastos.
 *
 * Antes, tanto el buscador del inicio como las categorías y el "Explorar" de
 * la barra caían en el catálogo de Girasol. Buscar "leche" o tocar "Lácteos"
 * solo miraba ahí, y lo de los demás locales no aparecía nunca.
 *
 * La regla que sigue la app: lo de afuera es general, lo de adentro de un
 * abasto es de ese abasto. Las categorías del catálogo de una tienda siguen
 * filtrando solo su catálogo, que es lo correcto ahí.
 *
 * Los resultados llevan al catálogo de su abasto en vez de agregarse al
 * carrito: un pedido es de un solo local, y dejar mezclar desde una lista de
 * varios sería armar el problema en vez de resolverlo.
 */
export default async function BuscarPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; categoria?: string; mayorista?: string }>
}) {
  const params = await searchParams
  const termino = (params.q ?? "").trim()
  const categoria: Category = toCategory(params.categoria)
  const soloMayorista = params.mayorista === "1"

  const filtraCategoria = categoria !== "Todos"
  const filtraTexto = termino.length >= 2
  const hayFiltro = filtraTexto || filtraCategoria || soloMayorista

  let resultados: Fila[] = []
  let tiendas = new Map<string, string>()

  if (isSupabaseConfigured && hayFiltro) {
    const supabase = await createClient()

    let consulta = supabase
      .from("products")
      .select("id, name, unit, price, image, store_id")
      .eq("active", true)

    // El % a los dos lados: la gente escribe "pan" buscando "Harina PAN".
    if (filtraTexto) consulta = consulta.ilike("name", `%${termino}%`)
    if (filtraCategoria) consulta = consulta.eq("category", categoria)
    if (soloMayorista) consulta = consulta.eq("wholesale", true)

    const [{ data: productos }, { data: locales }] = await Promise.all([
      consulta.order("name").limit(90).returns<Fila[]>(),
      supabase
        .from("stores")
        .select("id, name")
        .eq("active", true)
        .returns<{ id: string; name: string }[]>(),
    ])

    tiendas = new Map((locales ?? []).map((t) => [t.id, t.name]))
    // Un producto de un abasto apagado no debe aparecer.
    resultados = (productos ?? []).filter((p) => tiendas.has(p.store_id))
  }

  // Agrupados por abasto, porque el mismo producto cuesta distinto en cada uno.
  const porTienda = new Map<string, Fila[]>()
  for (const fila of resultados) {
    const lista = porTienda.get(fila.store_id) ?? []
    lista.push(fila)
    porTienda.set(fila.store_id, lista)
  }

  const queSeBusco = filtraTexto
    ? `"${termino}"`
    : filtraCategoria
      ? categoria
      : "productos al mayor"

  return (
    <main className="min-h-dvh bg-gray-50 pb-24">
      <header className="pt-barra-estado sticky top-0 z-30 border-b border-gray-100 bg-white">
        <div className="mx-auto max-w-md px-4 py-3">
          <Buscador valorInicial={termino} categoria={categoria} mayorista={soloMayorista} />
        </div>
        <CategoriaChips activa={categoria} termino={termino} mayorista={soloMayorista} />
      </header>

      <div className="mx-auto max-w-md px-4 py-4">
        {!hayFiltro ? (
          <p className="py-16 text-center text-sm leading-relaxed text-gray-500">
            Elige una categoría o escribe qué buscas. Miramos en todos los abastos a la vez.
          </p>
        ) : resultados.length === 0 ? (
          <div className="py-16 text-center">
            <span className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-gray-100">
              <PackageSearch className="h-6 w-6 text-gray-400" aria-hidden="true" />
            </span>
            <p className="mt-4 text-sm leading-relaxed text-gray-500">
              No encontramos {queSeBusco} en ningún abasto.
            </p>
          </div>
        ) : (
          <div className="flex flex-col gap-6">
            <p className="text-sm text-gray-500">
              {resultados.length === 1
                ? "1 producto encontrado"
                : `${resultados.length} productos encontrados`}
              {porTienda.size > 1 && ` en ${porTienda.size} abastos`}
            </p>

            {[...porTienda.entries()].map(([storeId, filas]) => (
              <section key={storeId}>
                <div className="mb-2 flex items-center justify-between gap-2">
                  <h2 className="flex min-w-0 items-center gap-1.5 text-sm font-semibold text-gray-900">
                    <Store className="h-4 w-4 shrink-0 text-gray-400" aria-hidden="true" />
                    <span className="truncate">{tiendas.get(storeId)}</span>
                  </h2>
                  <Link
                    href={enlaceATienda(storeId, { termino, categoria, soloMayorista })}
                    className="shrink-0 text-sm font-medium text-emerald-600"
                  >
                    Ver ahí
                  </Link>
                </div>

                <ul className="flex flex-col gap-2">
                  {filas.map((fila) => (
                    <li key={`${storeId}-${fila.id}`}>
                      <Link
                        href={`/catalogo?tienda=${storeId}&q=${encodeURIComponent(fila.name)}`}
                        className="flex items-center gap-3 rounded-2xl border border-gray-100 bg-white p-3 active:bg-gray-50"
                      >
                        <img
                          src={fila.image || "/placeholder.svg"}
                          alt=""
                          className="h-14 w-14 shrink-0 rounded-xl bg-gray-50 object-cover"
                        />
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-sm font-medium text-gray-900">
                            {fila.name}
                          </span>
                          <span className="block text-sm text-gray-500">{fila.unit}</span>
                        </span>
                        <span className="shrink-0 text-sm font-semibold tabular-nums text-gray-900">
                          ${Number(fila.price).toFixed(2)}
                        </span>
                      </Link>
                    </li>
                  ))}
                </ul>
              </section>
            ))}
          </div>
        )}
      </div>

      <BottomNav />
    </main>
  )
}

/** "Ver ahí" abre el catálogo de ese abasto con el mismo filtro puesto. */
function enlaceATienda(
  storeId: string,
  filtro: { termino: string; categoria: Category; soloMayorista: boolean },
) {
  const partes = [`tienda=${storeId}`]
  if (filtro.termino) partes.push(`q=${encodeURIComponent(filtro.termino)}`)
  if (filtro.categoria !== "Todos") partes.push(`categoria=${encodeURIComponent(filtro.categoria)}`)
  if (filtro.soloMayorista) partes.push("mayorista=1")
  return `/catalogo?${partes.join("&")}`
}
