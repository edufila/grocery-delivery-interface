/**
 * La tasa oficial del BCV, al día sin que nadie la escriba.
 *
 * Antes solo la traía Vercel Cron a la 1 p. m. (vercel.json). En el plan de
 * Vercel que usamos un cron no puede correr más de una vez al día, y el BCV no
 * publica a hora fija: la tasa nueva podía pasar medio día sin entrar. Medido el
 * 15 de septiembre a las 11 a. m.: el BCV ya decía 842,21 y la app cobraba con
 * 832,49, la del día anterior.
 *
 * Ahora, además del cron, la revisa la app misma cuando alguien la usa (inicio,
 * panel), como mucho una vez por hora, después de responder: nadie espera por
 * esto. La decisión de si se aplica es `decidirTasa`, pura y con tests.
 */

export const FUENTE_BCV = "https://ve.dolarapi.com/v1/dolares/oficial"

/** Cada cuánto se vuelve a preguntar, como mínimo. */
export const REVISAR_CADA_MS = 60 * 60 * 1000
/** Una tasa escrita a mano manda este rato antes de que la automática la pise. */
export const MANUAL_MANDA_MS = 12 * 60 * 60 * 1000

export type EstadoTasa = {
  rate_ves: number | null
  rate_ves_updated_at: string | null
  rate_ves_source: "bcv" | "manual" | null
}

export type Decision =
  | { accion: "aplicar"; tasa: number }
  | { accion: "esperar"; motivo: string }
  | { accion: "rechazar"; motivo: string }

export function decidirTasa({
  recibida,
  vigenteDesde,
  actual,
  ahora = new Date(),
}: {
  recibida: unknown
  /** `fechaActualizacion` de la fuente: desde cuándo rige. */
  vigenteDesde?: string | null
  actual: EstadoTasa | null
  ahora?: Date
}): Decision {
  const tasa = Number(recibida)
  if (recibida === null || recibida === undefined || recibida === "" || !Number.isFinite(tasa) || tasa <= 0) {
    return { accion: "rechazar", motivo: "La fuente no respondió con una tasa usable" }
  }

  /**
   * El BCV publica por la tarde la tasa que rige al día hábil siguiente. Una
   * tasa con fecha de mañana todavía no vale hoy: aplicarla antes cobraría con
   * un número que todavía no es el oficial.
   */
  if (vigenteDesde) {
    const desde = new Date(vigenteDesde)
    if (Number.isFinite(desde.getTime()) && desde.getTime() > ahora.getTime()) {
      return { accion: "esperar", motivo: "La tasa nueva rige desde más tarde" }
    }
  }

  /**
   * Que no entre una tasa de otro orden de magnitud: un punto corrido haría
   * vender a una centésima del precio, solo y sin que nadie mire. Un factor de
   * dos, no un porcentaje: aquí la tasa a veces salta fuerte de verdad.
   */
  const anterior = Number(actual?.rate_ves)
  if (Number.isFinite(anterior) && anterior > 0 && (tasa > anterior * 2 || tasa < anterior / 2)) {
    return { accion: "rechazar", motivo: "La tasa nueva es de otro orden que la anterior" }
  }

  // Alguien la escribió a mano hace poco: por algo fue. Manda un rato.
  if (actual?.rate_ves_source === "manual" && actual.rate_ves_updated_at) {
    const hace = ahora.getTime() - new Date(actual.rate_ves_updated_at).getTime()
    if (hace < MANUAL_MANDA_MS) {
      return { accion: "esperar", motivo: "Hay una tasa cargada a mano hace poco" }
    }
  }

  return { accion: "aplicar", tasa }
}

/** Si toca volver a preguntar: la última comprobación fue hace más de una hora. */
export function tocaRevisar(actual: EstadoTasa | null, ahora: Date = new Date()): boolean {
  if (!actual?.rate_ves || !actual.rate_ves_updated_at) return true
  return ahora.getTime() - new Date(actual.rate_ves_updated_at).getTime() >= REVISAR_CADA_MS
}
