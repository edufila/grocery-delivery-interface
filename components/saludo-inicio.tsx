import { Bike } from "lucide-react"

import { NombreSaludo } from "@/components/nombre-saludo"
import { formatOrderDate } from "@/lib/orders"
import { formatBolivares } from "@/lib/pagos"

/**
 * La hora se calcula en Venezuela y no en el servidor.
 *
 * Vercel corre en UTC: a las 8 de la noche de Acarigua ya es medianoche allá, y
 * un "Buenos días" a esa hora se ve como lo que es, un error. Por eso la zona va
 * explícita y no se confía en la del equipo que renderiza.
 */
const ZONA = "America/Caracas"

function horaEnVenezuela(ahora: Date) {
  return Number(
    new Intl.DateTimeFormat("en-US", { hour: "numeric", hourCycle: "h23", timeZone: ZONA }).format(
      ahora,
    ),
  )
}

function fechaEnVenezuela(fecha: Date) {
  return new Intl.DateTimeFormat("en-CA", { timeZone: ZONA }).format(fecha)
}

function saludo(hora: number) {
  if (hora < 5) return "Buenas noches"
  if (hora < 12) return "Buenos días"
  if (hora < 19) return "Buenas tardes"
  return "Buenas noches"
}

/**
 * La cabecera del inicio: saluda, dice qué hace la app, y lleva la tasa del día.
 *
 * La tasa antes vivía sola en una franja verde clara debajo de las categorías.
 * Aquí gana dos cosas: se ve sin bajar, y deja de ser un renglón suelto que
 * parecía un aviso. Si no es de hoy, dice de cuándo es en vez de llamarla
 * "de hoy" sin serlo.
 */
export function SaludoInicio({
  tasaVes,
  actualizada,
}: {
  tasaVes: number | null
  actualizada: string | null
}) {
  const ahora = new Date()
  const vigente =
    actualizada != null && fechaEnVenezuela(new Date(actualizada)) === fechaEnVenezuela(ahora)

  return (
    <section className="mx-auto max-w-md px-4 pt-3">
      <div className="relative animate-[entra_0.4s_ease-out] overflow-hidden rounded-3xl bg-gradient-to-br from-emerald-600 via-emerald-700 to-emerald-800 text-white shadow-lg shadow-emerald-900/20 p-4.5">
        {/* Dos manchas de luz, solo decoración: le dan profundidad a un bloque
            que en plano se veía como un botón gigante. */}
        <span
          className="pointer-events-none absolute -right-10 -top-12 h-40 w-40 rounded-full bg-white/10"
          aria-hidden="true"
        />
        <span
          className="pointer-events-none absolute -bottom-16 right-16 h-32 w-32 rounded-full bg-amber-300/20 blur-xl"
          aria-hidden="true"
        />

        <div className="relative">
          <p className="text-sm font-medium text-white">
            {saludo(horaEnVenezuela(ahora))}
            <NombreSaludo />
          </p>
          <h1 className="mt-0.5 text-2xl font-bold leading-tight tracking-tight text-balance">
            ¿Qué te llevamos hoy?
          </h1>
          <p className="mt-1.5 flex items-center gap-1.5 text-sm text-white">
            <Bike className="h-4 w-4 shrink-0" aria-hidden="true" />
            Del abasto a tu puerta, en Acarigua y Araure
          </p>

          {tasaVes ? (
            <div className="mt-3 inline-flex items-center gap-2 rounded-full bg-white/15 py-1 pl-3 pr-1 text-sm ring-1 ring-white/20">
              <span className="font-medium text-white">Tasa BCV{vigente ? " de hoy" : ""}</span>
              <span className="rounded-full bg-white px-2.5 py-0.5 font-bold tabular-nums text-emerald-800">
                Bs {formatBolivares(tasaVes)}
              </span>
            </div>
          ) : null}

          {tasaVes && actualizada && !vigente ? (
            <p className="mt-2 text-xs leading-relaxed text-white">
              {/* "Actualizada" y no "la última que se pudo traer": el BCV no
                  publica los fines de semana ni los feriados, así que un domingo
                  la del viernes es la vigente, no una falla. La alerta de tasa
                  vieja (0041) es la que avisa cuando de verdad algo no corrió.
                  Sin punto final: la fecha ya termina en "p. m." y quedaba doble. */}
              Actualizada el {formatOrderDate(actualizada)}
            </p>
          ) : null}
        </div>
      </div>
    </section>
  )
}
