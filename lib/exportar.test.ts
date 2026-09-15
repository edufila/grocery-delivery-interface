import { describe, expect, it } from "vitest"

import { fechaParaHoja, numeroParaHoja, pedidosACsv } from "./exportar"

describe("fechaParaHoja", () => {
  it("usa la hora de Venezuela", () => {
    expect(fechaParaHoja("2026-09-15T17:57:00Z")).toBe("2026-09-15 13:57")
  })

  it("vacío sin fecha", () => {
    expect(fechaParaHoja(null)).toBe("")
  })
})

describe("numeroParaHoja", () => {
  it("coma decimal y dos decimales", () => {
    expect(numeroParaHoja(1234.5)).toBe("1234,50")
    expect(numeroParaHoja("3.5")).toBe("3,50")
  })

  it("vacío si no hay número", () => {
    expect(numeroParaHoja(null)).toBe("")
    expect(numeroParaHoja("abc")).toBe("")
  })
})

describe("pedidosACsv", () => {
  it("una fila por pedido, separada por punto y coma, con el nombre del abasto", () => {
    const csv = pedidosACsv(
      [
        {
          code: "ABS-4471",
          created_at: "2026-09-15T17:57:00Z",
          status: "entregado",
          store_id: "girasol",
          payment_method: "pago_movil",
          payment_reference: "004471",
          total: 22.99,
          final_total: 20.5,
          delivery_fee: 3.5,
          service_fee: 1.99,
          amount_ves: 19138.63,
          rate_ves: 832.49,
          payment_verified_at: "2026-09-15T18:05:00Z",
        },
      ],
      { girasol: "Gran Abasto Girasol" },
    )
    const [cabecera, fila] = csv.split("\r\n")
    expect(cabecera.startsWith("Código;Fecha;Abasto")).toBe(true)
    expect(fila).toBe(
      "ABS-4471;2026-09-15 13:57;Gran Abasto Girasol;entregado;pago_movil;004471;22,99;20,50;3,50;1,99;19138,63;832,49;2026-09-15 14:05;",
    )
  })

  it("una referencia con punto y coma o comillas no rompe las columnas", () => {
    const csv = pedidosACsv([
      {
        code: "ABS-1",
        created_at: "2026-09-15T17:57:00Z",
        status: "confirmado",
        payment_method: "pago_movil",
        payment_reference: 'ref;"rara"',
        total: 1,
      },
    ])
    expect(csv.split("\r\n")[1]).toContain('"ref;""rara"""')
  })
})
