export type Store = {
  id: string
  name: string
  lat: number | null
  lng: number | null
  image: string | null
  tag: string | null
  eta: string | null
  delivery_fee: number
  active: boolean
  sort_order: number
}

export type AdminProduct = {
  id: string
  store_id: string
  name: string
  unit: string
  price: number
  image: string
  category: string
  wholesale: boolean
  /** Si el abasto lo vende. En falso desaparece del catálogo. */
  active: boolean
  /** Si hoy le queda. En falso sigue a la vista, apagado y sin poder pedirse. */
  in_stock: boolean
}

export type Settings = {
  id: string
  service_fee: number
  /** Bolívares por dólar. Nula mientras no se cargue. */
  rate_ves: number | null
}

/** Los campos del catálogo del inicio que se editan como texto libre. */
export const STORE_TEXT_FIELDS = [
  { key: "name", label: "Nombre" },
  { key: "tag", label: "Etiqueta", hint: "Ahorro Mayorista" },
  { key: "eta", label: "Tiempo de entrega", hint: "35-45 min" },
  { key: "image", label: "Foto", hint: "/images/store-girasol.png" },
] as const
