import { ZONA_HORARIA } from "./orders"

/**
 * Horario del abasto (0049).
 *
 * La base guarda `abre` y `cierra` como `time` ("07:00:00"), en hora de
 * Venezuela. Vacíos = abierto siempre. Si cierra antes de abrir, cruza la
 * medianoche. Esta es la misma cuenta que hace `public.abasto_abierto`; la de
 * la base es la que manda, esta es para avisar antes de llegar al botón.
 */

export type EstadoHorario = {
  abierto: boolean
  /** Nulo cuando no hay horario cargado: no hay nada que decir. */
  texto: string | null
  /** Abierto, pero cierra en menos de media hora. */
  cierraPronto: boolean
}

const MEDIA_HORA = 30

/** "07:30:00" o "07:30" → 450. Nulo si no se entiende. */
export function minutosDe(hora: string | null | undefined): number | null {
  const partes = hora?.match(/^(\d{1,2}):(\d{2})/)
  if (!partes) return null
  const h = Number(partes[1])
  const m = Number(partes[2])
  if (h > 23 || m > 59) return null
  return h * 60 + m
}

/** Minutos desde la medianoche, en hora de Venezuela. */
export function minutosEnVenezuela(fecha: Date): number {
  const partes = new Intl.DateTimeFormat("en-US", {
    timeZone: ZONA_HORARIA,
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(fecha)
  const valor = (tipo: string) => Number(partes.find((p) => p.type === tipo)?.value ?? 0)
  return valor("hour") * 60 + valor("minute")
}

/** 450 → "7:30 a. m.", 1140 → "7 p. m.", 0 → "12 a. m.". */
export function horaLegible(minutos: number): string {
  const h24 = Math.floor(minutos / 60) % 24
  const m = minutos % 60
  const h12 = h24 % 12 === 0 ? 12 : h24 % 12
  const sufijo = h24 < 12 ? "a. m." : "p. m."
  return m === 0 ? `${h12} ${sufijo}` : `${h12}:${String(m).padStart(2, "0")} ${sufijo}`
}

/** "07:00:00" → "07:00", para un `<input type="time">`. */
export function horaParaCampo(hora: string | null | undefined): string {
  const minutos = minutosDe(hora)
  if (minutos === null) return ""
  return `${String(Math.floor(minutos / 60)).padStart(2, "0")}:${String(minutos % 60).padStart(2, "0")}`
}

/** Si a esa hora del día (minutos desde la medianoche) el abasto está abierto. */
export function abiertoA(abre: string | null | undefined, cierra: string | null | undefined, minutos: number): boolean {
  const desde = minutosDe(abre)
  const hasta = minutosDe(cierra)
  if (desde === null || hasta === null || desde === hasta) return true
  const m = ((minutos % 1440) + 1440) % 1440
  return desde < hasta ? m >= desde && m < hasta : m >= desde || m < hasta
}

// ------------------------------------------------------ entrega programada

export type Turno = {
  /** El momento exacto, para mandárselo a la base. */
  iso: string
  /** "Hoy", "Mañana", "Jueves 17". */
  dia: string
  /** "3 p. m." */
  hora: string
}

/** Sin horario cargado, se ofrece de 8 a. m. a 8 p. m.: nadie recibe a las 4 de la mañana. */
const SIN_HORARIO = { abre: "08:00", cierra: "20:00" }
/** Lo mínimo para comprar y llevarlo. place_order exige lo mismo (0051). */
const ANTICIPACION_MIN = 60
const DIAS = ["Domingo", "Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado"]

/** "2026-09-15" → la medianoche de ese día en Venezuela. */
function medianocheVenezuela(dia: string): Date {
  return new Date(`${dia}T00:00:00-04:00`)
}

function diaVenezuela(fecha: Date): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: ZONA_HORARIA }).format(fecha)
}

/** "Hoy", "Mañana" o "Jueves 17", comparando días de Venezuela. */
export function nombreDelDia(fecha: Date, ahora: Date = new Date()): string {
  const hoy = medianocheVenezuela(diaVenezuela(ahora)).getTime()
  const diferencia = Math.round((medianocheVenezuela(diaVenezuela(fecha)).getTime() - hoy) / 86_400_000)
  if (diferencia === 0) return "Hoy"
  if (diferencia === 1) return "Mañana"
  const local = new Date(fecha.getTime() - 4 * 3600_000)
  return `${DIAS[local.getUTCDay()]} ${local.getUTCDate()}`
}

/**
 * Las horas en las que se puede pedir que llegue, cada hora en punto, de hoy y
 * los dos días siguientes.
 *
 * Un turno vale si el abasto está abierto la hora anterior (cuando el shopper
 * compra) y hasta el turno mismo, y si falta al menos una hora.
 */
export function turnosDeEntrega(
  abre: string | null | undefined,
  cierra: string | null | undefined,
  ahora: Date = new Date(),
  dias = 3,
): Turno[] {
  const conHorario =
    minutosDe(abre) !== null && minutosDe(cierra) !== null && minutosDe(abre) !== minutosDe(cierra)
  const a = conHorario ? abre : SIN_HORARIO.abre
  const c = conHorario ? cierra : SIN_HORARIO.cierra
  const minimo = ahora.getTime() + ANTICIPACION_MIN * 60_000

  const turnos: Turno[] = []
  const hoy = medianocheVenezuela(diaVenezuela(ahora))

  for (let d = 0; d < dias; d++) {
    for (let h = 0; h < 24; h++) {
      const momento = new Date(hoy.getTime() + (d * 24 + h) * 3600_000)
      if (momento.getTime() < minimo) continue
      const minutos = h * 60
      // Abierto mientras se compra (la hora anterior) y hasta cinco minutos antes del turno.
      if (!abiertoA(a, c, minutos - ANTICIPACION_MIN) || !abiertoA(a, c, minutos - 5)) continue
      turnos.push({ iso: momento.toISOString(), dia: nombreDelDia(momento, ahora), hora: horaLegible(minutos) })
    }
  }
  return turnos
}

/** "hoy a las 3 p. m.", "mañana a la 1 p. m.", "el jueves 17 a las 9 a. m.". */
export function cuandoLlega(iso: string, ahora: Date = new Date()): string {
  const fecha = new Date(iso)
  const dia = nombreDelDia(fecha, ahora)
  const hora = horaLegible(minutosEnVenezuela(fecha))
  const articulo = hora.startsWith("1 ") || hora.startsWith("1:") ? "a la" : "a las"
  if (dia === "Hoy" || dia === "Mañana") return `${dia.toLowerCase()} ${articulo} ${hora}`
  return `el ${dia.toLowerCase()} ${articulo} ${hora}`
}

export function estadoHorario(
  abre: string | null | undefined,
  cierra: string | null | undefined,
  ahora: Date = new Date(),
): EstadoHorario {
  const desde = minutosDe(abre)
  const hasta = minutosDe(cierra)
  if (desde === null || hasta === null || desde === hasta) {
    return { abierto: true, texto: null, cierraPronto: false }
  }

  const hoy = minutosEnVenezuela(ahora)
  const abierto = desde < hasta ? hoy >= desde && hoy < hasta : hoy >= desde || hoy < hasta

  if (!abierto) {
    return { abierto: false, texto: `Cerrado · abre a las ${horaLegible(desde)}`, cierraPronto: false }
  }

  // Cuánto falta para cerrar, contando el cruce de medianoche.
  const faltan = (hasta - hoy + 24 * 60) % (24 * 60)
  const cierraPronto = faltan <= MEDIA_HORA
  return {
    abierto: true,
    texto: cierraPronto
      ? `Cierra pronto · a las ${horaLegible(hasta)}`
      : `Abierto hasta las ${horaLegible(hasta)}`,
    cierraPronto,
  }
}
