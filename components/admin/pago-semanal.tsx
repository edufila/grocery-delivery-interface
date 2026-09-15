import { formatMoney } from "@/lib/orders"
import type { ResumenShopper } from "@/lib/semana"

/**
 * Cuánto entregó cada shopper desde el lunes.
 *
 * Lo que se le paga depende de un acuerdo que la app no conoce, así que no
 * calcula un "a pagar": pone las entregas, los envíos cobrados y lo vendido,
 * que son los números con los que se hace esa cuenta.
 */
export function PagoSemanal({
  filas,
  nombres,
}: {
  filas: ResumenShopper[]
  nombres: Record<string, string>
}) {
  if (filas.length === 0) {
    return (
      <p className="rounded-2xl border border-dashed border-gray-200 bg-white p-4 text-sm text-gray-500">
        Nadie ha entregado pedidos desde el lunes.
      </p>
    )
  }

  const total = filas.reduce(
    (s, f) => ({ entregas: s.entregas + f.entregas, envios: s.envios + f.envios, vendido: s.vendido + f.vendido }),
    { entregas: 0, envios: 0, vendido: 0 },
  )

  return (
    <div className="overflow-x-auto rounded-2xl border border-gray-200 bg-white">
      <table className="w-full min-w-[20rem] text-sm">
        <thead>
          <tr className="border-b border-gray-100 text-left text-xs uppercase tracking-wide text-gray-500">
            <th scope="col" className="px-4 py-3 font-medium">
              Shopper
            </th>
            <th scope="col" className="px-2 py-3 text-right font-medium">
              Entregas
            </th>
            <th scope="col" className="px-2 py-3 text-right font-medium">
              Envíos
            </th>
            <th scope="col" className="px-4 py-3 text-right font-medium">
              Vendido
            </th>
          </tr>
        </thead>
        <tbody>
          {filas.map((f) => (
            <tr key={f.shopperId} className="border-b border-gray-50 last:border-0">
              <th scope="row" className="max-w-[10rem] truncate px-4 py-3 text-left font-medium text-gray-900">
                {nombres[f.shopperId] ?? "Sin nombre"}
              </th>
              <td className="px-2 py-3 text-right tabular-nums text-gray-900">{f.entregas}</td>
              <td className="px-2 py-3 text-right tabular-nums text-gray-900">{formatMoney(f.envios)}</td>
              <td className="px-4 py-3 text-right tabular-nums text-gray-600">{formatMoney(f.vendido)}</td>
            </tr>
          ))}
        </tbody>
        {filas.length > 1 && (
          <tfoot>
            <tr className="border-t border-gray-200 font-semibold">
              <th scope="row" className="px-4 py-3 text-left text-gray-900">
                Total
              </th>
              <td className="px-2 py-3 text-right tabular-nums text-gray-900">{total.entregas}</td>
              <td className="px-2 py-3 text-right tabular-nums text-gray-900">{formatMoney(total.envios)}</td>
              <td className="px-4 py-3 text-right tabular-nums text-gray-600">{formatMoney(total.vendido)}</td>
            </tr>
          </tfoot>
        )}
      </table>
    </div>
  )
}
