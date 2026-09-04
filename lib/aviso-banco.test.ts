import { describe, expect, it } from "vitest"

import { leerAvisoBanco, leerMonto } from "./aviso-banco"

describe("leerMonto", () => {
  it("lee el formato de aquí: punto de miles, coma decimal", () => {
    expect(leerMonto("1.234,56")).toBe(1234.56)
    expect(leerMonto("847,91")).toBe(847.91)
    expect(leerMonto("12.500,00")).toBe(12500)
  })

  it("lee también el formato con punto decimal, que algunos avisos usan", () => {
    expect(leerMonto("1234.56")).toBe(1234.56)
    expect(leerMonto("847.91")).toBe(847.91)
  })

  it("distingue miles de decimales por la cantidad de dígitos detrás", () => {
    // Tres dígitos detrás del separador son miles, no céntimos.
    expect(leerMonto("1.234")).toBe(1234)
    expect(leerMonto("1,234")).toBe(1234)
    // Dos son céntimos.
    expect(leerMonto("1.23")).toBe(1.23)
  })

  it("varios puntos son siempre separadores de miles", () => {
    expect(leerMonto("1.234.567")).toBe(1234567)
  })

  it("rechaza lo que no es un monto en vez de inventar uno", () => {
    expect(leerMonto("")).toBe(null)
    expect(leerMonto("abc")).toBe(null)
    expect(leerMonto("0")).toBe(null)
    expect(leerMonto("Bs")).toBe(null)
  })
})

describe("leerAvisoBanco", () => {
  it("saca monto y referencia de un aviso con la palabra Ref", () => {
    const r = leerAvisoBanco(
      "Banesco: Recibiste un Pago Movil por Bs. 847,91 de 0414*****67 Ref. 012345678 el 03/09/2026",
    )
    expect(r.monto).toBe(847.91)
    expect(r.referencia).toBe("012345678")
  })

  it("aguanta que el monto venga antes de Bs", () => {
    const r = leerAvisoBanco("Abono recibido 1.234,56 Bs referencia 998877665")
    expect(r.monto).toBe(1234.56)
    expect(r.referencia).toBe("998877665")
  })

  it("entiende otras formas de nombrar la referencia", () => {
    expect(leerAvisoBanco("Pago Movil Bs 500,00 Nro 12345678").referencia).toBe("12345678")
    expect(leerAvisoBanco("Bs 500,00 operacion: 87654321").referencia).toBe("87654321")
    expect(leerAvisoBanco("Bs 500,00 comprobante 55554444").referencia).toBe("55554444")
  })

  it("no confunde el teléfono enmascarado con la referencia", () => {
    const r = leerAvisoBanco("Recibido Bs. 100,00 de 04141234567*** sin mas datos")
    expect(r.referencia).not.toBe("04141234567")
  })

  it("no inventa un monto cuando no hay bolívares por ningún lado", () => {
    const r = leerAvisoBanco("Su clave temporal es 123456, no la comparta")
    expect(r.monto).toBe(null)
  })

  it("con texto vacío devuelve las dos cosas en nulo", () => {
    expect(leerAvisoBanco("")).toEqual({ referencia: null, monto: null })
    expect(leerAvisoBanco("   ")).toEqual({ referencia: null, monto: null })
  })

  it("aguanta saltos de línea, que es como llegan las notificaciones", () => {
    const r = leerAvisoBanco("Pago Movil\nrecibido\nBs. 2.000,50\nRef: 44556677")
    expect(r.monto).toBe(2000.5)
    expect(r.referencia).toBe("44556677")
  })
})
