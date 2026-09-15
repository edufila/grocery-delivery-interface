import { describe, expect, it } from "vitest"

import { lunesEnVenezuela, resumenPorShopper, type PedidoDeSemana } from "./semana"

describe("lunesEnVenezuela", () => {
  it("un miércoles vuelve al lunes a medianoche de Venezuela", () => {
    const lunes = lunesEnVenezuela(new Date("2026-09-16T10:00:00-04:00"))
    expect(lunes.toISOString()).toBe("2026-09-14T04:00:00.000Z")
  })

  it("el domingo a las 9 p. m. todavía es de la semana que empezó el lunes anterior", () => {
    // En UTC ya es lunes a la 1 a. m.: contado allá, la semana habría cambiado.
    const lunes = lunesEnVenezuela(new Date("2026-09-20T21:00:00-04:00"))
    expect(lunes.toISOString()).toBe("2026-09-14T04:00:00.000Z")
  })

  it("el lunes a las 12:30 a. m. ya es semana nueva", () => {
    const lunes = lunesEnVenezuela(new Date("2026-09-21T00:30:00-04:00"))
    expect(lunes.toISOString()).toBe("2026-09-21T04:00:00.000Z")
  })
})

describe("resumenPorShopper", () => {
  const desde = new Date("2026-09-14T04:00:00Z")
  const pedido = (p: Partial<PedidoDeSemana>): PedidoDeSemana => ({
    shopper_id: "ana",
    status: "entregado",
    created_at: "2026-09-15T15:00:00Z",
    total: 20,
    delivery_fee: 3.5,
    ...p,
  })

  it("suma entregas, envíos y lo cobrado por shopper", () => {
    const r = resumenPorShopper(
      [pedido({}), pedido({ total: 10, final_total: 8.4 }), pedido({ shopper_id: "luis" })],
      desde,
    )
    expect(r).toEqual([
      { shopperId: "ana", entregas: 2, envios: 7, vendido: 28.4 },
      { shopperId: "luis", entregas: 1, envios: 3.5, vendido: 20 },
    ])
  })

  it("deja fuera lo no entregado, lo sin shopper y lo de la semana pasada", () => {
    const r = resumenPorShopper(
      [
        pedido({ status: "en_camino" }),
        pedido({ status: "cancelado" }),
        pedido({ shopper_id: null }),
        pedido({ created_at: "2026-09-13T20:00:00Z" }),
      ],
      desde,
    )
    expect(r).toEqual([])
  })

  it("suma montos que llegan como texto desde la base", () => {
    const r = resumenPorShopper([pedido({ total: "12.10", delivery_fee: "3.50" })], desde)
    expect(r[0]).toMatchObject({ envios: 3.5, vendido: 12.1 })
  })
})
