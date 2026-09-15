import { decidirTasa, FUENTE_BCV, tocaRevisar, type EstadoTasa } from "@/lib/tasa-bcv"

/**
 * Trae la tasa del BCV y la guarda si corresponde. Solo en el servidor: usa la
 * llave de servicio, que nunca viaja al navegador.
 *
 * La llaman el cron diario (`/api/tasa-bcv`, con `forzar`) y las pantallas que
 * más se abren, dentro de `after()`: después de responder, así nadie espera. Sin
 * `forzar` no hace nada si se comprobó hace menos de una hora (lo dice la base)
 * o si esta misma instancia preguntó hace menos de diez minutos (por si la
 * decisión fue esperar y la base no cambió).
 */

export type Resultado =
  | { estado: "aplicada"; tasa: number; anterior: number | null; vigenteDesde: string | null }
  | { estado: "reciente" }
  | { estado: "esperar" | "rechazada"; motivo: string; recibida?: unknown; anterior?: number | null }
  | { estado: "sin-configurar" }
  | { estado: "error"; motivo: string }

const DIEZ_MINUTOS = 10 * 60 * 1000
let ultimaPregunta = 0

export async function refrescarTasa({ forzar = false }: { forzar?: boolean } = {}): Promise<Resultado> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const llave = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !llave) return { estado: "sin-configurar" }

  if (!forzar && Date.now() - ultimaPregunta < DIEZ_MINUTOS) return { estado: "reciente" }
  ultimaPregunta = Date.now()

  const cabeceras = { apikey: llave, Authorization: `Bearer ${llave}` }

  try {
    const actual = await fetch(
      `${url}/rest/v1/settings?id=eq.global&select=rate_ves,rate_ves_updated_at,rate_ves_source`,
      { headers: cabeceras, cache: "no-store", signal: AbortSignal.timeout(5000) },
    )
      .then((r) => (r.ok ? r.json() : null))
      .then((filas) => (filas?.[0] as EstadoTasa | undefined) ?? null)

    if (!forzar && !tocaRevisar(actual)) return { estado: "reciente" }

    const datos = await fetch(FUENTE_BCV, { cache: "no-store", signal: AbortSignal.timeout(5000) })
      .then((r) => (r.ok ? r.json() : null))
      .catch(() => null)

    const anterior = actual?.rate_ves != null ? Number(actual.rate_ves) : null
    const decision = decidirTasa({
      recibida: datos?.promedio,
      vigenteDesde: datos?.fechaActualizacion ?? null,
      actual,
    })

    if (decision.accion !== "aplicar") {
      return {
        estado: decision.accion === "esperar" ? "esperar" : "rechazada",
        motivo: decision.motivo,
        recibida: datos?.promedio,
        anterior,
      }
    }

    // Se escribe aunque sea el mismo número: la fecha dice que se comprobó, y
    // es la que usa el aviso de tasa vieja.
    const guardado = await fetch(`${url}/rest/v1/settings?id=eq.global`, {
      method: "PATCH",
      headers: { ...cabeceras, "Content-Type": "application/json", Prefer: "return=minimal" },
      body: JSON.stringify({
        rate_ves: decision.tasa,
        rate_ves_updated_at: new Date().toISOString(),
        rate_ves_source: "bcv",
      }),
      signal: AbortSignal.timeout(5000),
    })

    if (!guardado.ok) return { estado: "error", motivo: `No se pudo guardar (${guardado.status})` }
    return { estado: "aplicada", tasa: decision.tasa, anterior, vigenteDesde: datos?.fechaActualizacion ?? null }
  } catch (error) {
    return { estado: "error", motivo: error instanceof Error ? error.message : "Error desconocido" }
  }
}
