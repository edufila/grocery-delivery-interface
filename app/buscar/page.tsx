import type { Metadata } from "next"
import Link from "next/link"
import { PackageSearch, Star, Store } from "lucide-react"

import { BottomNav } from "@/components/bottom-nav"
import { Buscador } from "@/components/buscar/buscador"
import { CategoriaChips } from "@/components/buscar/categoria-chips"
import { pageTitle } from "@/lib/brand"
import { toCategory, type Category } from "@/lib/categories"
import { bsEquivalent, formatBolivares } from "@/lib/pagos"
import {
  ajustesPublicos,
  buscarProductosPublicos,
  categoriasVendidas,
  tiendasActivas,
} from "@/lib/datos-publicos"
import { isSupabaseConfigured } from "@/lib/supabase/config"
import { createClient } from "@/lib/supabase/server"
import { normalizarTexto } from "@/lib/texto"
import { fotoLigera } from "@/lib/fotos"

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
  let habituales: Fila[] = []
  let tasaVes: number | null = null
  let conProductos: Set<string> | undefined

  if (isSupabaseConfigured) {
    /**
     * Lo público, de caché; lo personal, con la sesión.
     *
     * Abastos, tasa, categorías y la lista para cada filtro son iguales para
     * todos: salen de lib/datos-publicos.ts, guardados un minuto. Solo "Lo que
     * compras siempre" necesita saber quién mira, y solo sin filtro, que es
     * cuando se muestra.
     */
    const marcados = hayFiltro
      ? Promise.resolve([] as string[])
      : createClient().then(async (supabase) => {
          // RLS limita a los propios, así que no hace falta filtrar por usuario.
          const { data } = await supabase
            .from("product_favorites")
            .select("product_id")
            .order("created_at", { ascending: false })
            .limit(30)
            .returns<{ product_id: string }[]>()
          return { supabase, ids: (data ?? []).map((f) => f.product_id) }
        })

    const [settings, abastos, productos, vendidas, favoritos] = await Promise.all([
      ajustesPublicos(),
      tiendasActivas(),
      buscarProductosPublicos(
        filtraTexto ? normalizarTexto(termino) : "",
        filtraTexto ? termino : "",
        categoria,
        soloMayorista,
      ),
      categoriasVendidas(),
      marcados,
    ])

    tasaVes = settings?.rate_ves ?? null
    tiendas = new Map(abastos.map((t) => [t.id, t.name]))
    conProductos = new Set(vendidas.filter((p) => tiendas.has(p.store_id)).map((p) => p.category))
    // Un producto de un abasto apagado no debe aparecer.
    resultados = productos.filter((p) => tiendas.has(p.store_id))

    if (!Array.isArray(favoritos) && favoritos.ids.length > 0) {
      const { data: suyos } = await favoritos.supabase
        .from("products")
        .select("id, name, unit, price, image, store_id")
        .in("id", favoritos.ids)
        .eq("active", true)
        .returns<Fila[]>()
      habituales = (suyos ?? []).filter((p) => tiendas.has(p.store_id))
    }
  }

  // Agrupados por abasto, porque el mismo producto cuesta distinto en cada uno.
  const porTienda = new Map<string, Fila[]>()
  for (const fila of resultados) {
    const lista = porTienda.get(fila.store_id) ?? []
    lista.push(fila)
    porTienda.set(fila.store_id, lista)
  }

  /**
   * El más barato de cada producto que está en más de un abasto.
   *
   * Es la razón de tener varios abastos en una misma app: el mismo arroz cuesta
   * distinto en cada uno, y esta es la única pantalla que los muestra juntos.
   * Se compara por nombre y presentación, sin acentos: dos abastos que cargaron
   * "Harina PAN" igual cuentan como el mismo producto. Si empatan, ninguno se
   * marca: no hay nada que elegir.
   */
  const masBarato = new Set<string>()
  const porProducto = new Map<string, Fila[]>()
  for (const fila of resultados) {
    const clave = normalizarTexto(`${fila.name} ${fila.unit}`)
    porProducto.set(clave, [...(porProducto.get(clave) ?? []), fila])
  }
  for (const filas of porProducto.values()) {
    const tiendasDistintas = new Set(filas.map((f) => f.store_id))
    if (tiendasDistintas.size < 2) continue
    const minimo = Math.min(...filas.map((f) => Number(f.price)))
    const ganadores = filas.filter((f) => Number(f.price) === minimo)
    if (ganadores.length === 1) masBarato.add(`${ganadores[0].store_id}-${ganadores[0].id}`)
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
        <CategoriaChips
          activa={categoria}
          termino={termino}
          mayorista={soloMayorista}
          conProductos={conProductos}
        />
      </header>

      <div className="mx-auto flex max-w-md flex-col gap-6 px-4 py-4">
        {!hayFiltro && habituales.length > 0 && (
          <section>
              <h2 className="mb-2 flex items-center gap-1.5 text-sm font-semibold text-gray-900">
                <Star className="h-4 w-4 fill-amber-400 text-amber-500" aria-hidden="true" />
                Lo que compras siempre
              </h2>
              <ul className="flex flex-col gap-2">
                {habituales.map((fila) => (
                  <li key={fila.id}>
                    <Link
                      href={`/catalogo?tienda=${fila.store_id}&q=${encodeURIComponent(fila.name)}`}
                      className="flex items-center gap-3 rounded-2xl border border-gray-100 bg-white p-3 active:bg-gray-50"
                    >
                      <img
                        src={fotoLigera(fila.image) || "/placeholder.svg"}
                        alt=""
                        className="h-14 w-14 shrink-0 rounded-xl bg-gray-50 object-cover"
                        loading="lazy"
                        decoding="async"
                      />
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm font-medium text-gray-900">
                          {fila.name}
                        </span>
                        <span className="block truncate text-sm text-gray-500">
                          {tiendas.get(fila.store_id)}
                        </span>
                      </span>
                      <span className="shrink-0 text-right">
                        <span className="block text-sm font-semibold tabular-nums text-gray-900">
                          ${Number(fila.price).toFixed(2)}
                        </span>
                        {bsEquivalent(Number(fila.price), tasaVes) != null && (
                          <span className="block text-xs tabular-nums text-gray-500">
                            Bs {formatBolivares(bsEquivalent(Number(fila.price), tasaVes)!)}
                          </span>
                        )}
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            </section>
        )}

        {resultados.length === 0 ? (
          <div className="py-16 text-center">
            <span className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-gray-100">
              <PackageSearch className="h-6 w-6 text-gray-400" aria-hidden="true" />
            </span>
            <p className="mt-4 text-sm leading-relaxed text-gray-500">
              {hayFiltro
                ? `No encontramos ${queSeBusco} en ningún abasto.`
                : "Todavía no hay productos cargados en ningún abasto."}
            </p>
          </div>
        ) : (
          <div className="flex flex-col gap-6">
            <p className="text-sm text-gray-500">
              {hayFiltro
                ? `${
                    resultados.length === 1
                      ? "1 producto encontrado"
                      : `${resultados.length} productos encontrados`
                  }${porTienda.size > 1 ? ` en ${porTienda.size} abastos` : ""}`
                : "Escribe arriba o toca una categoría para buscar en todos los abastos a la vez."}
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
                    className="-mr-2 flex min-h-11 shrink-0 items-center px-2 text-sm font-medium text-emerald-600"
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
                          src={fotoLigera(fila.image) || "/placeholder.svg"}
                          alt=""
                          className="h-14 w-14 shrink-0 rounded-xl bg-gray-50 object-cover"
                          loading="lazy"
                          decoding="async"
                        />
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-sm font-medium text-gray-900">
                            {fila.name}
                          </span>
                          <span className="block text-sm text-gray-500">{fila.unit}</span>
                          {masBarato.has(`${storeId}-${fila.id}`) && (
                            <span className="mt-1 inline-flex rounded-md bg-emerald-600 px-1.5 py-0.5 text-xs font-semibold text-white">
                              Más barato aquí
                            </span>
                          )}
                        </span>
                        <span className="shrink-0 text-right">
                          <span className="block text-sm font-semibold tabular-nums text-gray-900">
                            ${Number(fila.price).toFixed(2)}
                          </span>
                          {bsEquivalent(Number(fila.price), tasaVes) != null && (
                            <span className="block text-xs tabular-nums text-gray-500">
                              Bs {formatBolivares(bsEquivalent(Number(fila.price), tasaVes)!)}
                            </span>
                          )}
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
