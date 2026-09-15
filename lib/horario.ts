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
