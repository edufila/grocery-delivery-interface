import { describe, expect, it } from "vitest"

import { estadoHorario, horaLegible, horaParaCampo, minutosDe, minutosEnVenezuela } from "./horario"

// Venezuela es UTC-4 todo el año.
const aLas = (hora: string) => new Date(`2026-09-14T${hora}:00-04:00`)

describe("minutosDe", () => {
  it("lee el formato de la base y el del campo", () => {
    expect(minutosDe("07:30:00")).toBe(450)
    expect(minutosDe("19:00")).toBe(1140)
  })

  it("nulo si no hay hora o no se entiende", () => {
    expect(minutosDe(null)).toBeNull()
    expect(minutosDe("")).toBeNull()
    expect(minutosDe("25:00")).toBeNull()
  })
})

describe("minutosEnVenezuela", () => {
  it("usa la hora de Venezuela y no la del servidor", () => {
    expect(minutosEnVenezuela(new Date("2026-09-14T12:00:00Z"))).toBe(8 * 60)
  })
})

describe("horaLegible", () => {
  it("escribe la hora como se dice", () => {
    expect(horaLegible(450)).toBe("7:30 a. m.")
    expect(horaLegible(1140)).toBe("7 p. m.")
    expect(horaLegible(0)).toBe("12 a. m.")
    expect(horaLegible(720)).toBe("12 p. m.")
  })
})

describe("horaParaCampo", () => {
  it("deja la hora como la pide el campo", () => {
    expect(horaParaCampo("07:00:00")).toBe("07:00")
    expect(horaParaCampo(null)).toBe("")
  })
})

describe("estadoHorario", () => {
  it("sin horario está abierto y no dice nada", () => {
    expect(estadoHorario(null, null, aLas("03:00"))).toEqual({ abierto: true, texto: null, cierraPronto: false })
  })

  it("abierto dentro del horario", () => {
    const r = estadoHorario("07:00:00", "20:00:00", aLas("10:00"))
    expect(r.abierto).toBe(true)
    expect(r.texto).toBe("Abierto hasta las 8 p. m.")
  })

  it("cerrado antes de abrir y a la hora exacta de cerrar", () => {
    expect(estadoHorario("07:00:00", "20:00:00", aLas("06:59")).texto).toBe("Cerrado · abre a las 7 a. m.")
    expect(estadoHorario("07:00:00", "20:00:00", aLas("20:00")).abierto).toBe(false)
  })

  it("avisa cuando cierra en menos de media hora", () => {
    const r = estadoHorario("07:00:00", "20:00:00", aLas("19:40"))
    expect(r.cierraPronto).toBe(true)
    expect(r.texto).toBe("Cierra pronto · a las 8 p. m.")
  })

  it("un horario que cruza la medianoche", () => {
    expect(estadoHorario("18:00:00", "02:00:00", aLas("23:00")).abierto).toBe(true)
    expect(estadoHorario("18:00:00", "02:00:00", aLas("01:45")).cierraPronto).toBe(true)
    expect(estadoHorario("18:00:00", "02:00:00", aLas("10:00")).abierto).toBe(false)
  })
})
