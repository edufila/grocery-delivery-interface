import { describe, expect, it } from "vitest"

import { distanciaKm, estimarEntrega, textoEstimado } from "./entrega"

// Dos puntos de Acarigua a unos 3 km.
const plaza = { lat: 9.5545, lng: -69.1956 }
const avenida = { lat: 9.58, lng: -69.21 }

describe("distanciaKm", () => {
  it("cero entre el mismo punto", () => {
    expect(distanciaKm(plaza, plaza)).toBe(0)
  })

  it("mide unos kilómetros entre dos puntos de la ciudad", () => {
    const km = distanciaKm(plaza, avenida)
    expect(km).toBeGreaterThan(2.5)
    expect(km).toBeLessThan(3.5)
  })
})

describe("estimarEntrega", () => {
  it("null si falta un punto", () => {
    expect(estimarEntrega(plaza, null)).toBeNull()
    expect(estimarEntrega({ lat: null, lng: 1 }, plaza)).toBeNull()
  })

  it("al lado del abasto no baja de 25 minutos: comprar también tarda", () => {
    expect(estimarEntrega(plaza, plaza)).toMatchObject({ desde: 25, hasta: 35 })
  })

  it("más lejos, más tiempo, redondeado de 5 en 5", () => {
    const cerca = estimarEntrega(plaza, avenida)!
    const lejos = estimarEntrega(plaza, { lat: 9.65, lng: -69.3 })!
    expect(cerca.desde % 5).toBe(0)
    expect(lejos.desde).toBeGreaterThan(cerca.desde)
    expect(lejos.km).toBeGreaterThan(cerca.km)
  })

  it("se escribe como rango", () => {
    expect(textoEstimado({ desde: 30, hasta: 40, km: 3 })).toBe("30-40 min")
  })
})
