import { formatOrderDate } from "@/lib/orders"
import { formatBolivares } from "@/lib/pagos"

function esHoy(iso: string) {
  const fecha = new Date(iso)
  const ahora = new Date()
  return (
    fecha.getFullYear() === ahora.getFullYear() &&
    fecha.getMonth() === ahora.getMonth() &&
    fecha.getDate() === ahora.getDate()
  )
}

/**
 * El espacio donde el cliente ve la tasa del día sin tener que llegar al
 * pago. Si la corrida automática falló y lo que hay es la última tasa que sí
 * se pudo traer, lo dice con la fecha en vez de llamarla "de hoy" sin serlo.
 */
export function TasaBcvBadge({
  tasaVes,
  actualizada,
}: {
  tasaVes: number | null
  actualizada: string | null
}) {
  if (!tasaVes) return null

  const vigente = actualizada != null && esHoy(actualizada)

  return (
    <div className="mx-auto max-w-md px-4 pb-1 pt-2">
      <div className="flex items-center justify-between gap-3 rounded-2xl bg-emerald-50 px-4 py-2.5">
        <span className="text-sm font-medium text-emerald-900">
          Tasa BCV{vigente ? " de hoy" : ""}
        </span>
        <span className="text-sm font-bold tabular-nums text-emerald-900">
          Bs {formatBolivares(tasaVes)}
        </span>
      </div>
      {actualizada && !vigente && (
        <p className="mt-1 px-1 text-[11px] leading-relaxed text-gray-500">
          Es la última que se pudo traer, del {formatOrderDate(actualizada)}.
        </p>
      )}
    </div>
  )
}
