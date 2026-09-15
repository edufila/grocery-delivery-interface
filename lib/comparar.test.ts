import { describe, expect, it } from "vitest"

import { masBaratos } from "./comparar"

const fila = (id: string, store_id: string, price: number, name = "Arroz Blanco", unit = "1 kg") => ({
  id,
  store_id,
  price,
  name,
  unit,
})

describe("masBaratos", () => {
  it("marca el más barato de un producto que está en dos abastos", () => {
    const r = masBaratos([fila("a1", "girasol", 1.85), fila("b1", "cosecha", 1.7)])
    expect([...r]).toEqual(["cosecha-b1"])
  })

  it("compara sin acentos ni mayúsculas", () => {
    const r = masBaratos([
      fila("a1", "girasol", 9, "Café Molido", "500 g"),
      fila("b1", "cosecha", 8.5, "cafe molido", "500 G"),
    ])
    expect([...r]).toEqual(["cosecha-b1"])
  })

  it("con empate no marca ninguno", () => {
    expect(masBaratos([fila("a1", "girasol", 2), fila("b1", "cosecha", 2)]).size).toBe(0)
  })

  it("en un solo abasto no hay con qué comparar", () => {
    expect(masBaratos([fila("a1", "girasol", 2), fila("a2", "girasol", 1)]).size).toBe(0)
  })

  it("distinta presentación es otro producto", () => {
    expect(masBaratos([fila("a1", "girasol", 2, "Arroz", "1 kg"), fila("b1", "cosecha", 1, "Arroz", "500 g")]).size).toBe(0)
  })
})
