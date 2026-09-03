import { describe, expect, it } from "vitest"

import { nombreDesdeId, resumirCarrito } from "./carrito"
import type { Product } from "./products"

function producto(id: string, price: number, store_id = "girasol"): Product {
  return {
    id,
    name: id,
    unit: "1 kg",
    price,
    image: "",
    category: "Granos",
    store_id,
  }
}

const catalogo = new Map<string, Product>([
  ["arroz", producto("arroz", 1.85)],
  ["cafe", producto("cafe", 4.2)],
  ["tomate", producto("tomate", 0.99, "cosecha")],
])

describe("resumirCarrito", () => {
  it("suma lo que hay en el catálogo", () => {
    const r = resumirCarrito({ arroz: 2, cafe: 1 }, catalogo)
    expect(r.count).toBe(3)
    expect(r.subtotal).toBe(7.9)
    expect(r.lines).toHaveLength(2)
  })

  it("no deja colas de decimales en el subtotal", () => {
    // 0.99 * 3 en coma flotante da 2.9699999999999998, y eso llegaba a pantalla.
    const r = resumirCarrito({ tomate: 3 }, catalogo)
    expect(r.subtotal).toBe(2.97)
  })

  it("avisa de lo que ya no está en el catálogo en vez de perderlo callado", () => {
    const r = resumirCarrito({ arroz: 1, "producto-viejo": 2 }, catalogo)
    expect(r.perdidos).toEqual(["producto-viejo"])
    // Lo que se fue no suma ni al total ni a la cuenta.
    expect(r.count).toBe(1)
    expect(r.subtotal).toBe(1.85)
  })

  it("lista los abastos, que es lo que decide si el pedido es válido", () => {
    expect(resumirCarrito({ arroz: 1 }, catalogo).storeIds).toEqual(["girasol"])
    expect(resumirCarrito({ arroz: 1, tomate: 1 }, catalogo).storeIds).toHaveLength(2)
  })

  it("ignora cantidades imposibles guardadas en el teléfono", () => {
    const sucio = { arroz: 0, cafe: -3, tomate: Number.NaN } as Record<string, number>
    const r = resumirCarrito(sucio, catalogo)
    expect(r.count).toBe(0)
    expect(r.subtotal).toBe(0)
    expect(r.lines).toHaveLength(0)
    // Estos no se fueron del catálogo: están, solo que con cantidad inválida.
    expect(r.perdidos).toEqual([])
  })

  it("con el carrito vacío no inventa abastos", () => {
    const r = resumirCarrito({}, catalogo)
    expect(r.storeIds).toEqual([])
    expect(r.subtotal).toBe(0)
  })
})

describe("nombreDesdeId", () => {
  it("hace legible lo único que queda de un producto que se fue", () => {
    expect(nombreDesdeId("harina-pan")).toBe("Harina pan")
    expect(nombreDesdeId("leche_en_polvo")).toBe("Leche en polvo")
  })
})
