import type { Category } from "@/lib/categories"

export type Product = {
  id: string
  name: string
  unit: string
  price: number
  image: string
  wholesale?: boolean
  category: Exclude<Category, "Todos">
}

/**
 * Catálogo único. Vive acá y no dentro de una pantalla porque el checkout
 * también necesita resolver un producto a partir del id guardado en el carrito.
 */
export const products: Product[] = [
  { id: "harina-pan", name: "Harina de Maíz PAN", unit: "Bulto de 12 · 1 kg c/u", price: 24.5, image: "/products/harina-pan.png", wholesale: true, category: "Harinas" },
  { id: "aceite", name: "Aceite Comestible Vegetal", unit: "Caja de 12 · 1 L c/u", price: 32.9, image: "/products/aceite.png", wholesale: true, category: "Aceites" },
  { id: "arroz", name: "Arroz Blanco Superior", unit: "Unidad · 1 kg", price: 1.85, image: "/products/arroz.png", category: "Granos" },
  { id: "cafe", name: "Café Molido Premium", unit: "Unidad · 500 g", price: 6.75, image: "/products/cafe.png", category: "Bebidas" },
  { id: "azucar", name: "Azúcar Refinada", unit: "Unidad · 1 kg", price: 1.45, image: "/products/azucar.png", category: "Granos" },
  { id: "pasta", name: "Pasta Larga Spaghetti", unit: "Bulto de 20 · 1 kg c/u", price: 18.0, image: "/products/pasta.png", wholesale: true, category: "Harinas" },
  { id: "harina-trigo", name: "Harina de Trigo Leudante", unit: "Unidad · 1 kg", price: 1.2, image: "/products/harina-trigo.png", category: "Harinas" },
  { id: "leche", name: "Leche en Polvo Completa", unit: "Unidad · 900 g", price: 8.9, image: "/products/leche.png", category: "Lácteos" },
]

const byId = new Map(products.map((product) => [product.id, product]))

export function findProduct(id: string) {
  return byId.get(id)
}
