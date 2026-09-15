import { unstable_cache } from "next/cache"

import type { Store } from "@/lib/admin"
import { fetchProducts } from "@/lib/products"
import { fetchSettings } from "@/lib/settings"
import { crearClientePublico } from "@/lib/supabase/publico"

/**
 * Lo que ve cualquiera, guardado un minuto.
 *
 * El catálogo de un abasto se armaba de cero en cada visita: tres consultas a
 * Supabase para datos que cambian unas pocas veces al día. Medido en
 * producción, respondía en ~1,1 s. Con esto la mayoría de las visitas no va a
 * Supabase.
 *
 * Un minuto de atraso es el costo: un precio o un "agotado" cambiado en el
 * panel tarda hasta un minuto en verse. No hay riesgo de cobrar mal por eso --
 * `place_order` calcula el total contra la base y rechaza lo agotado --, a lo
 * sumo el cliente ve el precio viejo un rato.
 *
 * Sin cookies ni sesión adentro: lo que se guarda aquí es igual para todos.
 */
const MINUTO = 60

export const tiendaPublica = unstable_cache(
  async (storeId: string) => {
    const { data } = await crearClientePublico()
      .from("stores")
      .select("id, name, tag, active, image, eta, delivery_fee")
      .eq("id", storeId)
      .maybeSingle<Pick<Store, "id" | "name" | "tag" | "active" | "image" | "eta" | "delivery_fee">>()
    return data
  },
  ["tienda-publica"],
  { revalidate: MINUTO },
)

export const productosPublicos = unstable_cache(
  async (storeId: string) => fetchProducts(crearClientePublico(), storeId),
  ["productos-publicos"],
  { revalidate: MINUTO },
)

export const ajustesPublicos = unstable_cache(
  async () => fetchSettings(crearClientePublico()),
  ["ajustes-publicos"],
  { revalidate: MINUTO },
)

export const tiendasActivas = unstable_cache(
  async () => {
    const { data } = await crearClientePublico()
      .from("stores")
      .select("id, name")
      .eq("active", true)
      .returns<{ id: string; name: string }[]>()
    return data ?? []
  },
  ["tiendas-activas"],
  { revalidate: MINUTO },
)

/** Solo categoría y abasto de cada producto: alcanza para saber qué categorías tienen algo. */
export const categoriasVendidas = unstable_cache(
  async () => {
    const { data } = await crearClientePublico()
      .from("products")
      .select("category, store_id")
      .eq("active", true)
      .limit(5000)
      .returns<{ category: string; store_id: string }[]>()
    return data ?? []
  },
  ["categorias-vendidas"],
  { revalidate: MINUTO },
)

export type FilaBusqueda = {
  id: string
  name: string
  unit: string
  price: number
  image: string | null
  store_id: string
}

/**
 * La lista de Explorar para un filtro. Guardada por filtro: "arroz" que busca
 * uno lo reaprovecha el siguiente.
 *
 * El texto va contra `nombre_busqueda` (0046, sin acentos) y, si esa columna
 * no existe, contra `name` como antes.
 */
export const buscarProductosPublicos = unstable_cache(
  async (textoNormalizado: string, textoOriginal: string, categoria: string, soloMayorista: boolean) => {
    const supabase = crearClientePublico()
    const hayFiltro = textoOriginal.length >= 2 || categoria !== "Todos" || soloMayorista

    const pedir = (columna: "nombre_busqueda" | "name") => {
      let consulta = supabase
        .from("products")
        .select("id, name, unit, price, image, store_id")
        .eq("active", true)
      if (textoOriginal.length >= 2) {
        // El % a los dos lados: la gente escribe "pan" buscando "Harina PAN".
        const buscado = columna === "nombre_busqueda" ? textoNormalizado : textoOriginal
        consulta = consulta.ilike(columna, `%${buscado}%`)
      }
      if (categoria !== "Todos") consulta = consulta.eq("category", categoria)
      if (soloMayorista) consulta = consulta.eq("wholesale", true)
      return consulta
        .order("name")
        .limit(hayFiltro ? 90 : 30)
        .returns<FilaBusqueda[]>()
    }

    if (textoOriginal.length < 2) return (await pedir("name")).data ?? []
    const sinAcentos = await pedir("nombre_busqueda")
    return (sinAcentos.error ? (await pedir("name")).data : sinAcentos.data) ?? []
  },
  ["buscar-productos-publicos"],
  { revalidate: MINUTO },
)
