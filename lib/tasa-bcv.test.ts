import { describe, expect, it } from "vitest"

import { decidirTasa, tocaRevisar, type EstadoTasa } from "./tasa-bcv"

const ahora = new Date("2026-09-15T11:00:00-04:00")
const ayer: EstadoTasa = {
  rate_ves: 832.49,
  rate_ves_updated_at: "2026-09-14T13:57:00-04:00",
  rate_ves_source: "bcv",
}

describe("decidirTasa", () => {
  it("aplica la tasa de hoy sobre la de ayer", () => {
    expect(
      decidirTasa({ recibida: 842.2067, vigenteDesde: "2026-09-15T00:00:00-04:00", actual: ayer, ahora }),
    ).toEqual({ accion: "aplicar", tasa: 842.2067 })
  })

  it("espera una tasa que rige desde mañana", () => {
    expect(
      decidirTasa({ recibida: 850, vigenteDesde: "2026-09-16T00:00:00-04:00", actual: ayer, ahora }).accion,
    ).toBe("esperar")
  })

  it("rechaza lo que no es un número, vacío o cero", () => {
    expect(decidirTasa({ recibida: "abc", actual: ayer, ahora }).accion).toBe("rechazar")
    expect(decidirTasa({ recibida: null, actual: ayer, ahora }).accion).toBe("rechazar")
    expect(decidirTasa({ recibida: 0, actual: ayer, ahora }).accion).toBe("rechazar")
  })

  it("rechaza un punto decimal corrido", () => {
    expect(decidirTasa({ recibida: 8.42, actual: ayer, ahora }).accion).toBe("rechazar")
    expect(decidirTasa({ recibida: 8420, actual: ayer, ahora }).accion).toBe("rechazar")
  })

  it("respeta una tasa escrita a mano hace menos de 12 horas", () => {
    const manual: EstadoTasa = {
      ...ayer,
      rate_ves_source: "manual",
      rate_ves_updated_at: "2026-09-15T08:00:00-04:00",
    }
    expect(decidirTasa({ recibida: 842, actual: manual, ahora }).accion).toBe("esperar")
  })

  it("una manual vieja sí se pisa", () => {
    const manual: EstadoTasa = { ...ayer, rate_ves_source: "manual" }
    expect(decidirTasa({ recibida: 842, actual: manual, ahora }).accion).toBe("aplicar")
  })

  it("sin tasa anterior aplica cualquier número positivo", () => {
    expect(decidirTasa({ recibida: 842, actual: null, ahora }).accion).toBe("aplicar")
  })
})

describe("tocaRevisar", () => {
  it("sí si la última es de hace más de una hora o no hay", () => {
    expect(tocaRevisar(ayer, ahora)).toBe(true)
    expect(tocaRevisar(null, ahora)).toBe(true)
  })

  it("no si se comprobó hace menos de una hora", () => {
    expect(tocaRevisar({ ...ayer, rate_ves_updated_at: "2026-09-15T10:30:00-04:00" }, ahora)).toBe(false)
  })
})
