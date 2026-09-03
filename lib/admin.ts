export type Store = {
  id: string
  name: string
  lat: number | null
  lng: number | null
  image: string | null
  tag: string | null
  eta: string | null
  rating: string | null
  reviews: string | null
  delivery_fee: number
  active: boolean
  sort_order: number
}

export type AdminProduct = {
  id: string
  name: string
  unit: string
  price: number
  image: string
  category: string
  wholesale: boolean
  active: boolean
}

export type Settings = {
  id: string
  service_fee: number
}

/** Los campos del catálogo del inicio que se editan como texto libre. */
export const STORE_TEXT_FIELDS = [
  { key: "name", label: "Nombre" },
  { key: "tag", label: "Etiqueta", hint: "Ahorro Mayorista" },
  { key: "eta", label: "Tiempo de entrega", hint: "35-45 min" },
  { key: "image", label: "Foto", hint: "/images/store-girasol.png" },
  { key: "rating", label: "Calificación", hint: "4.8" },
  { key: "reviews", label: "Reseñas", hint: "2.4k" },
] as const
