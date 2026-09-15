import { ZONA_HORARIA } from "./orders"

/**
 * Pedidos a una hoja de cálculo, para llevar las cuentas.
 *
 * Con punto y coma y coma decimal: es lo que Excel en español espera al abrir
 * un CSV con doble toque. Con comas y puntos, cada pedido quedaba entero en la
 * columna A y los montos como texto.
 */

export type PedidoExportable = {
  code: string
  created_at: string
  status: string
  store_id?: string | null
  payment_method: string
  payment_reference?: string | null
  total: number | string | null
  final_total?: number | string | null
  delivery_fee?: number | string | null
  service_fee?: number | string | null
  amount_ves?: number | string | null
  rate_ves?: number | string | null
  payment_verified_at?: string | null
  payment_refunded_at?: string | null
}

const COLUMNAS = [
  "Código",
  "Fecha",
  "Abasto",
  "Estado",
  "Método",
  "Referencia",
  "Total $",
  "Cobrado $",
  "Envío $",
  "Servicio $",
  "Bolívares",
  "Tasa",
  "Pago verificado",
  "Devuelto",
]

/** "2026-09-15 13:57", en hora de Venezuela. Ordena bien como texto. */
export function fechaParaHoja(iso: string | null | undefined): string {
  if (!iso) return ""
  const partes = new Intl.DateTimeFormat("en-CA", {
    timeZone: ZONA_HORARIA,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(new Date(iso))
  const v = (t: string) => partes.find((p) => p.type === t)?.value ?? ""
  return `${v("year")}-${v("month")}-${v("day")} ${v("hour")}:${v("minute")}`
}

/** 1234.5 → "1234,50". Vacío si no hay número. */
export function numeroParaHoja(valor: number | string | null | undefined): string {
  if (valor === null || valor === undefined || valor === "") return ""
  const n = Number(valor)
  return Number.isFinite(n) ? n.toFixed(2).replace(".", ",") : ""
}

/** Una celda: entre comillas si trae separador, comillas o saltos de línea. */
function celda(texto: string): string {
  return /[;"\n\r]/.test(texto) ? `"${texto.replace(/"/g, '""')}"` : texto
}

export function pedidosACsv(pedidos: PedidoExportable[], nombresAbasto: Record<string, string> = {}): string {
  const filas = pedidos.map((p) =>
    [
      p.code,
      fechaParaHoja(p.created_at),
      p.store_id ? (nombresAbasto[p.store_id] ?? p.store_id) : "",
      p.status,
      p.payment_method,
      p.payment_reference ?? "",
      numeroParaHoja(p.total),
      numeroParaHoja(p.final_total ?? p.total),
      numeroParaHoja(p.delivery_fee),
      numeroParaHoja(p.service_fee),
      numeroParaHoja(p.amount_ves),
      numeroParaHoja(p.rate_ves),
      fechaParaHoja(p.payment_verified_at),
      fechaParaHoja(p.payment_refunded_at),
    ]
      .map(celda)
      .join(";"),
  )
  return [COLUMNAS.join(";"), ...filas].join("\r\n")
}
