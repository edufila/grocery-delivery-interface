import type { Product } from "@/lib/products"

export type CartLine = { product: Product; qty: number }

export type ResumenCarrito = {
  lines: CartLine[]
  count: number
  subtotal: number
  /** Los abastos que hay en el carrito. Un pedido es de uno solo. */
  storeIds: string[]
  /**
   * Lo que estaba guardado en el teléfono pero ya no está en el catálogo: se
   * agotó, lo desactivaron o cambió de identificador. Antes desaparecía en
   * silencio y el cliente llegaba al final con menos cosas de las que puso.
   */
  perdidos: string[]
}

/**
 * Cruza lo que el teléfono tiene guardado contra el catálogo de verdad.
 *
 * Está aparte del contexto de React a propósito: es la cuenta del carrito, o
 * sea plata, y así se puede probar sin montar la aplicación.
 */
export function resumirCarrito(
  quantities: Record<string, number>,
  catalogo: Map<string, Product>,
): ResumenCarrito {
  const lines: CartLine[] = []
  const tiendas = new Set<string>()
  const perdidos: string[] = []
  let count = 0
  let subtotal = 0

  for (const [id, qty] of Object.entries(quantities)) {
    if (!Number.isFinite(qty) || qty <= 0) continue

    const product = catalogo.get(id)
    if (!product) {
      perdidos.push(id)
      continue
    }

    lines.push({ product, qty })
    tiendas.add(product.store_id)
    count += qty
    subtotal += product.price * qty
  }

  return {
    lines,
    count,
    // Los centavos se redondean aquí y no al mostrar: sumar flotantes deja
    // colas como 6.350000000000001, y eso termina en pantalla.
    subtotal: Math.round(subtotal * 100) / 100,
    storeIds: [...tiendas],
    perdidos,
  }
}

/** "harina-pan" -> "Harina pan". Lo único que queda de un producto que se fue. */
export function nombreDesdeId(id: string) {
  const texto = id.replace(/[-_]+/g, " ").trim()
  return texto.charAt(0).toUpperCase() + texto.slice(1)
}
