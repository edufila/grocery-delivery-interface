import { describe, expect, it } from "vitest"

import { precioPorUnidad, unidadesPorPresentacion } from "./unidades"

describe("unidadesPorPresentacion", () => {
  it("lee cuántas trae un bulto, una caja o un paquete", () => {
    expect(unidadesPorPresentacion("Bulto de 12 · 1 kg c/u")).toBe(12)
    expect(unidadesPorPresentacion("Caja de 24")).toBe(24)
    expect(unidadesPorPresentacion("Paquete 6 unidades")).toBe(6)
    expect(unidadesPorPresentacion("Docena")).toBe(12)
  })

  it("lo que no es al mayor da null", () => {
    expect(unidadesPorPresentacion("Unidad · 1 kg")).toBeNull()
    expect(unidadesPorPresentacion("500 g")).toBeNull()
    expect(unidadesPorPresentacion(null)).toBeNull()
    expect(unidadesPorPresentacion("Caja de 1")).toBeNull()
  })
})

describe("precioPorUnidad", () => {
  it("divide y redondea a céntimos", () => {
    expect(precioPorUnidad(24.5, "Bulto de 12 · 1 kg c/u")).toBe(2.04)
    expect(precioPorUnidad(32.9, "Caja de 12 · 1 L c/u")).toBe(2.74)
  })

  it("sin presentación al mayor no inventa nada", () => {
    expect(precioPorUnidad(1.85, "Unidad · 1 kg")).toBeNull()
  })
})
