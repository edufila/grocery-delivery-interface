import { describe, expect, it } from "vitest"

import {
  bsEquivalent,
  formatBolivares,
  sePuedeOfrecer,
  ultimosDigitos,
  type MetodoPago,
} from "./pagos"

/**
 * Aquí no había ninguna prueba, y es donde un error cuesta dinero: si un método
 * se ofrece cuando no se puede cumplir, entra un pedido que nadie sabe cobrar;
 * si la referencia se recorta mal, el pago no se encuentra en el banco.
 */

const metodo = (extra: Partial<MetodoPago> = {}): MetodoPago => ({
  id: "pago-movil",
  label: "Pago Móvil",
  hint: null,
  instructions: "Banco X, 0412-1234567, C.I. 12345678",
  needs_reference: true,
  active: true,
  sort_order: 1,
  currency: "VES",
  ...extra,
})

describe("sePuedeOfrecer", () => {
  it("ofrece el pago móvil cuando hay datos y tasa", () => {
    expect(sePuedeOfrecer(metodo(), 820.1)).toBe(true)
  })

  it("no ofrece un método apagado aunque esté todo cargado", () => {
    expect(sePuedeOfrecer(metodo({ active: false }), 820.1)).toBe(false)
  })

  it("no ofrece cobrar en bolívares sin tasa del día", () => {
    // Sin tasa se le diría "paga $6.35" a alguien que va a transferir
    // bolívares, y cada quien convertiría con la tasa que se le ocurra.
    expect(sePuedeOfrecer(metodo(), null)).toBe(false)
    expect(sePuedeOfrecer(metodo(), 0)).toBe(false)
    // Una tasa negativa es un dato malo, no una tasa.
    expect(sePuedeOfrecer(metodo(), -5)).toBe(false)
  })

  it("no ofrece un método que pide referencia sin decir a dónde pagar", () => {
    // El cliente elegiría Pago Móvil y se quedaría esperando una instrucción
    // que no llega nunca.
    expect(sePuedeOfrecer(metodo({ instructions: null }), 820.1)).toBe(false)
    expect(sePuedeOfrecer(metodo({ instructions: "   " }), 820.1)).toBe(false)
  })

  it("ofrece el efectivo sin instrucciones y sin tasa", () => {
    // Se paga en la puerta: no hay a dónde transferir ni referencia que dar.
    const efectivo = metodo({
      id: "efectivo",
      needs_reference: false,
      instructions: null,
      currency: "USD",
    })
    expect(sePuedeOfrecer(efectivo, null)).toBe(true)
  })
})

describe("bsEquivalent", () => {
  it("convierte con la tasa", () => {
    expect(bsEquivalent(3.5, 820.1)).toBeCloseTo(2870.35, 2)
  })

  it("devuelve nulo sin tasa utilizable, en vez de cero", () => {
    // Cero sería un precio, y un precio de cero es peor que no mostrar nada.
    expect(bsEquivalent(3.5, null)).toBeNull()
    expect(bsEquivalent(3.5, 0)).toBeNull()
    expect(bsEquivalent(3.5, -1)).toBeNull()
  })
})

describe("formatBolivares", () => {
  it("usa punto para los miles y coma para los decimales", () => {
    // Al revés que en inglés. Es como se lee un monto aquí, y es el mismo
    // formato con el que hay que compararlo contra el banco.
    expect(formatBolivares(1234.56)).toBe("1.234,56")
  })

  it("siempre muestra los dos decimales", () => {
    // Los céntimos son los que identifican el pago: 847,00 y 847 no son lo
    // mismo a la hora de buscarlo.
    expect(formatBolivares(847)).toBe("847,00")
    expect(formatBolivares(847.9)).toBe("847,90")
  })
})

describe("ultimosDigitos", () => {
  it("se queda con los últimos cuatro", () => {
    expect(ultimosDigitos("012345678")).toBe("5678")
  })

  it("ignora todo lo que no sea número", () => {
    // Unos escriben "Ref. 001234", otros con espacios o guiones.
    expect(ultimosDigitos("Ref. 0012-3456")).toBe("3456")
    expect(ultimosDigitos("00 12 34 56")).toBe("3456")
  })

  it("devuelve lo que haya cuando son menos de cuatro", () => {
    expect(ultimosDigitos("12")).toBe("12")
  })

  it("no revienta sin referencia", () => {
    expect(ultimosDigitos(null)).toBe("")
    expect(ultimosDigitos("sin numeros")).toBe("")
  })
})
