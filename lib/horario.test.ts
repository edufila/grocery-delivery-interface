import { describe, expect, it } from "vitest"

import {
  abiertoA,
  cuandoLlega,
  estadoHorario,
  horaLegible,
  horaParaCampo,
  minutosDe,
  minutosEnVenezuela,
  nombreDelDia,
  turnosDeEntrega,
} from "./horario"

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

describe("abiertoA", () => {
  it("sin horario siempre", () => {
    expect(abiertoA(null, null, 180)).toBe(true)
  })

  it("respeta el cruce de medianoche y los minutos negativos", () => {
    expect(abiertoA("18:00", "02:00", 60)).toBe(true)
    expect(abiertoA("07:00", "20:00", -30)).toBe(false)
  })
})

describe("nombreDelDia", () => {
  const ahora = aLas("22:00") // lunes 14 de septiembre, 10 p. m.

  it("hoy y mañana en días de Venezuela, aunque en UTC ya sea otro día", () => {
    expect(nombreDelDia(aLas("23:30"), ahora)).toBe("Hoy")
    expect(nombreDelDia(new Date("2026-09-15T09:00:00-04:00"), ahora)).toBe("Mañana")
  })

  it("después, el nombre y el número", () => {
    expect(nombreDelDia(new Date("2026-09-17T09:00:00-04:00"), ahora)).toBe("Jueves 17")
  })
})

describe("turnosDeEntrega", () => {
  it("con al menos una hora de margen y dentro del horario", () => {
    const turnos = turnosDeEntrega("07:00:00", "20:00:00", aLas("10:20"), 1)
    // A las 10:20 el primero posible es 12 p. m. (11:20 no es en punto).
    expect(turnos[0]).toMatchObject({ dia: "Hoy", hora: "12 p. m." })
    // El último es a las 8 p. m.: se compra de 7 a 8, con el abasto abierto.
    expect(turnos.at(-1)?.hora).toBe("8 p. m.")
    // El primero de un día nunca antes de las 8 a. m. si abre a las 7.
    expect(turnosDeEntrega("07:00:00", "20:00:00", aLas("21:00"), 2)[0]).toMatchObject({
      dia: "Mañana",
      hora: "8 a. m.",
    })
  })

  it("con el abasto cerrado hoy, ofrece mañana", () => {
    const turnos = turnosDeEntrega("07:00:00", "20:00:00", aLas("23:00"), 3)
    expect(turnos[0].dia).toBe("Mañana")
    expect(new Set(turnos.map((t) => t.dia)).size).toBe(2)
  })

  it("sin horario ofrece de 9 a. m. a 8 p. m.", () => {
    const turnos = turnosDeEntrega(null, null, aLas("05:00"), 1)
    expect(turnos[0].hora).toBe("9 a. m.")
    expect(turnos.at(-1)?.hora).toBe("8 p. m.")
  })

  it("el iso es la hora exacta de Venezuela", () => {
    const [primero] = turnosDeEntrega("07:00:00", "20:00:00", aLas("10:20"), 1)
    expect(primero.iso).toBe("2026-09-14T16:00:00.000Z")
  })
})

describe("cuandoLlega", () => {
  const ahora = aLas("10:00")

  it("dice el día y la hora como se habla", () => {
    expect(cuandoLlega("2026-09-14T19:00:00Z", ahora)).toBe("hoy a las 3 p. m.")
    expect(cuandoLlega("2026-09-15T17:00:00Z", ahora)).toBe("mañana a la 1 p. m.")
    expect(cuandoLlega("2026-09-17T13:00:00Z", ahora)).toBe("el jueves 17 a las 9 a. m.")
  })
})
