import type { Metadata } from "next"
import Link from "next/link"
import { PackageSearch, Store } from "lucide-react"

import { BottomNav } from "@/components/bottom-nav"
import { Buscador } from "@/components/buscar/buscador"
import { pageTitle } from "@/lib/brand"
import { isSupabaseConfigured } from "@/lib/supabase/config"
import { createClient } from "@/lib/supabase/server"

export const metadata: Metadata = {
  title: pageTitle("Buscar"),
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
 * Busca en todos los abastos a la vez.
 *
 * El buscador del inicio mandaba al catálogo de Girasol, así que buscar "leche"
 * solo miraba ahí: si La Cosecha la tenía, el cliente no se enteraba. Y el
 * problema crecía con cada abasto que se sumara.
 *
 * Los resultados no se agregan al carrito desde aquí, llevan al catálogo de su
 * abasto. Un pedido es de un solo local: dejar mezclar desde una lista de
 * varios sería armar el problema en vez de resolverlo.
 */
export default async function BuscarPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>
}) {
  const { q } = await searchParams
  const termino = (q ?? "").trim()

  let resultados: Fila[] = []
  let tiendas = new Map<string, string>()

  if (isSupabaseConfigured && termino.length >= 2) {
    const supabase = await createClient()

    const [{ data: productos }, { data: locales }] = await Promise.all([
      supabase
        .from("products")
        .select("id, name, unit, price, image, store_id")
        .eq("active", true)
        // El % a los dos lados: la gente escribe "pan" buscando "Harina PAN".
        .ilike("name", `%${termino}%`)
        .order("name")
        .limit(60)
        .returns<Fila[]>(),
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

  // Agrupados por abasto, porque el precio del mismo producto cambia en cada uno.
  const porTienda = new Map<string, Fila[]>()
  for (const fila of resultados) {
    const lista = porTienda.get(fila.store_id) ?? []
    lista.push(fila)
    porTienda.set(fila.store_id, lista)
  }

  return (
    <main className="min-h-dvh bg-gray-50 pb-24">
      <header className="pt-barra-estado sticky top-0 z-30 border-b border-gray-100 bg-white">
        <div className="mx-auto max-w-md px-4 py-3">
          <Buscador valorInicial={termino} />
        </div>
      </header>

      <div className="mx-auto max-w-md px-4 py-4">
        {termino.length < 2 ? (
          <p className="py-16 text-center text-sm leading-relaxed text-gray-500">
            Escribe al menos dos letras para buscar en todos los abastos.
          </p>
        ) : resultados.length === 0 ? (
          <div className="py-16 text-center">
            <span className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-gray-100">
              <PackageSearch className="h-6 w-6 text-gray-400" aria-hidden="true" />
            </span>
            <p className="mt-4 text-sm leading-relaxed text-gray-500">
              No encontramos nada con &ldquo;{termino}&rdquo; en ningún abasto.
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
                    href={`/catalogo?tienda=${storeId}&q=${encodeURIComponent(termino)}`}
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
