import { describe, expect, it } from "vitest"

import { contieneTexto, normalizarTexto } from "./texto"

describe("normalizarTexto", () => {
  it("quita acentos y mayúsculas", () => {
    expect(normalizarTexto("Café Molido")).toBe("cafe molido")
    expect(normalizarTexto("AZÚCAR")).toBe("azucar")
  })

  it("conserva la ñ", () => {
    expect(normalizarTexto("Piña")).toBe("piña")
    expect(normalizarTexto("PIÑA")).toBe("piña")
  })

  it("junta los espacios de más", () => {
    expect(normalizarTexto("  harina   pan ")).toBe("harina pan")
  })
})

describe("contieneTexto", () => {
  it("encuentra sin acentos lo que tiene acentos, y al revés", () => {
    expect(contieneTexto("Café Molido Premium", "cafe")).toBe(true)
    expect(contieneTexto("Azucar Refinada", "azúcar")).toBe(true)
  })

  it("no confunde la ñ con la n", () => {
    expect(contieneTexto("Piña en almíbar", "pina")).toBe(false)
  })
})
