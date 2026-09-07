"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { BadgeCheck, Clock, Loader2, Search } from "lucide-react"

import { AvisoPagos } from "@/components/admin/aviso-pagos"
import { formatMoney, formatOrderDate, type Order } from "@/lib/orders"
import { formatBolivares, ultimosDigitos } from "@/lib/pagos"
import { createClient } from "@/lib/supabase/client"

export type PedidoPorCobrar = Pick<
  Order,
  | "id"
  | "code"
  | "total"
  | "final_total"
  | "amount_ves"
  | "payment_method"
  | "payment_reference"
  | "payment_reported_at"
>

/**
 * Los pedidos esperando que alguien confirme que el dinero llegó, y la forma
 * de meter un pago que se vio en el banco.
 *
 * Esta pantalla traba a propósito el resto de la operación: mientras un pago
 * está aquí sin confirmar, su pedido no le aparece a ningún shopper. Antes
 * salía igual, y si el dinero nunca llegaba la mercancía ya estaba comprada.
 * Así que lo que se hace acá no es papeleo: es lo que destraba el pedido.
 *
 * Por qué existe el formulario si ya está el botón de confirmar: porque el
 * orden real no es el que uno esperaría. A veces el pago aparece en el banco
 * antes de que el cliente se acuerde de reportarlo. Registrándolo aquí, cuando
 * el cliente por fin escriba su referencia el pedido se verifica solo, sin que
 * nadie vuelva a mirar.
 *
 * Lo que NO hace: entrar al banco. No hay claves bancarias en ningún lado y no
 * las va a haber. El dato entra por aquí o, si algún día el banco manda avisos
 * por correo, por lo que se automatice: el cruce ya está hecho y es el mismo.
 */
export function ConciliacionPagos({ pedidos }: { pedidos: PedidoPorCobrar[] }) {
  const router = useRouter()
  const [referencia, setReferencia] = useState("")
  const [monto, setMonto] = useState("")
  const [guardando, setGuardando] = useState(false)
  const [error, setError] = useState("")
  const [resultado, setResultado] = useState("")
  const [verificando, setVerificando] = useState<string | null>(null)
  const [confirmado, setConfirmado] = useState("")

  const digitos = referencia.replace(/\D/g, "")

  async function registrar() {
    if (digitos.length < 4) {
      setError("La referencia tiene que traer al menos 4 dígitos.")
      return
    }

    setGuardando(true)
    setError("")
    setResultado("")

    const { data, error: rpcError } = await createClient().rpc("record_payment", {
      p_reference: referencia.trim(),
      p_amount: monto.trim() ? Number(monto) : null,
      p_source: "panel",
    })

    setGuardando(false)

    if (rpcError) {
      setError(
        rpcError.message.includes("does not exist")
          ? "Falta correr la migración de conciliación en Supabase."
          : rpcError.message,
      )
      return
    }

    const r = data as { conciliado?: boolean; ya_estaba?: boolean } | null
    setReferencia("")
    setMonto("")

    if (r?.ya_estaba) setResultado("Ese pago ya estaba registrado y enganchado a un pedido.")
    else if (r?.conciliado)
      setResultado("Enganchado: el pedido quedó verificado y ya sale a buscar shopper.")
    else setResultado("Guardado. Cuando el cliente reporte esa referencia, se verifica solo.")

    router.refresh()
  }

  async function verificar(pedido: PedidoPorCobrar) {
    setVerificando(pedido.id)
    setError("")
    setConfirmado("")

    const { data, error: rpcError } = await createClient().rpc("verify_payment", {
      p_order_id: pedido.id,
      p_ok: true,
    })

    setVerificando(null)

    if (rpcError) {
      setError(
        rpcError.message.includes("does not exist")
          ? "Falta correr la migración 0037 en Supabase."
          : rpcError.message,
      )
      return
    }

    /**
     * Se repite en pantalla qué quedó confirmado. Confirmar un pago libera un
     * pedido que después nadie vuelve a mirar, así que el momento de darse
     * cuenta de que se tocó la tarjeta de al lado es este y no mañana.
     *
     * La 0037 hizo que la función devolviera esos datos; antes devolvía solo
     * verdadero, y si la base todavía está vieja se dice lo genérico.
     */
    const r = data as { code?: string; amount_ves?: number | null } | null
    setConfirmado(
      r?.code
        ? `Confirmado ${r.code}${
            r.amount_ves != null ? ` por Bs. ${formatBolivares(Number(r.amount_ves))}` : ""
          }. El pedido ya sale a buscar shopper.`
        : "Confirmado. El pedido ya sale a buscar shopper.",
    )
    router.refresh()
  }

  return (
    <div className="flex flex-col gap-4">
      <AvisoPagos />

      <section className="rounded-2xl border border-gray-200 bg-white p-3">
        <h3 className="text-sm font-semibold text-gray-900">Registrar un pago que viste</h3>
        <p className="mt-0.5 text-xs leading-relaxed text-gray-500">
          Cópialo de tu banco. Si algún cliente ya reportó esa referencia, su pedido queda
          verificado al instante; si todavía no, queda esperándolo.
        </p>

        <div className="mt-3 flex flex-wrap gap-2">
          <input
            value={referencia}
            onChange={(event) => {
              setReferencia(event.target.value)
              if (error) setError("")
            }}
            inputMode="numeric"
            placeholder="Referencia"
            aria-label="Referencia del pago"
            className="h-12 min-w-40 flex-1 rounded-xl border border-gray-200 bg-white px-3 text-base tabular-nums text-gray-900 outline-none placeholder:text-gray-400 focus:border-emerald-500"
          />
          <input
            value={monto}
            onChange={(event) => setMonto(event.target.value)}
            type="number"
            step="0.01"
            min="0"
            placeholder="Monto (opcional)"
            aria-label="Monto del pago"
            className="h-12 w-36 rounded-xl border border-gray-200 bg-white px-3 text-base tabular-nums text-gray-900 outline-none placeholder:text-gray-400 focus:border-emerald-500"
          />
          <button
            type="button"
            onClick={() => void registrar()}
            disabled={guardando || digitos.length < 4}
            className="flex h-12 items-center justify-center gap-2 rounded-xl bg-emerald-600 px-4 text-sm font-semibold text-white disabled:bg-gray-200 disabled:text-gray-400"
          >
            {guardando && <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />}
            Registrar
          </button>
        </div>

        {error && (
          <p role="alert" className="mt-2 text-sm text-rose-600">
            {error}
          </p>
        )}
        {resultado && <p className="mt-2 text-sm text-emerald-700">{resultado}</p>}
      </section>

      <section>
        <h3 className="mb-1 text-sm font-semibold text-gray-900">
          Esperando verificación ({pedidos.length})
        </h3>
        <p className="mb-2 text-xs leading-relaxed text-gray-500">
          Estos pedidos están detenidos. No le aparecen a ningún shopper hasta que confirmes.
        </p>

        {confirmado && (
          <p className="mb-2 rounded-xl bg-emerald-50 px-3 py-2 text-sm text-emerald-800">
            {confirmado}
          </p>
        )}

        {pedidos.length === 0 ? (
          <p className="text-sm leading-relaxed text-gray-500">
            Ningún cliente tiene un pago reportado sin verificar.
          </p>
        ) : (
          <ul className="flex flex-col gap-2">
            {pedidos.map((pedido) => (
              <TarjetaPago
                key={pedido.id}
                pedido={pedido}
                ocupado={verificando === pedido.id}
                onVerificar={() => void verificar(pedido)}
              />
            ))}
          </ul>
        )}

        <p className="mt-3 flex items-start gap-2 text-xs leading-relaxed text-gray-500">
          <Search className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden="true" />
          Busca cada referencia en tu banco antes de confirmar. La app no entra a tu cuenta: no
          tiene forma de saber sola si el dinero llegó.
        </p>
      </section>
    </div>
  )
}

/**
 * Un pago por verificar, con las dos cosas que hay que cotejar contra el banco
 * y nada más: el monto exacto y los últimos dígitos de la referencia.
 *
 * El monto va primero y grande porque es el dato fuerte: lo pone el sistema con
 * céntimos únicos, así que dos pedidos nunca deben lo mismo y el número por sí
 * solo identifica el pago. La referencia la copia el cliente a mano y se
 * equivoca; sirve para confirmar, no para decidir.
 */
function TarjetaPago({
  pedido,
  ocupado,
  onVerificar,
}: {
  pedido: PedidoPorCobrar
  ocupado: boolean
  onVerificar: () => void
}) {
  const ultimos = ultimosDigitos(pedido.payment_reference)
  const enBolivares = pedido.amount_ves != null
  const escrito = (pedido.payment_reference ?? "").replace(/\D/g, "")

  return (
    <li className="rounded-2xl border border-amber-200 bg-amber-50/60 p-3">
      <div className="flex items-center justify-between gap-2">
        <p className="font-mono text-sm font-semibold text-gray-900">{pedido.code}</p>
        <p className="flex items-center gap-1 text-xs text-amber-700">
          <Clock className="h-3.5 w-3.5" aria-hidden="true" />
          {pedido.payment_reported_at ? formatOrderDate(pedido.payment_reported_at) : "reportado"}
        </p>
      </div>

      <div className="mt-2 grid grid-cols-2 gap-2">
        <Evidencia
          etiqueta={enBolivares ? "Monto exacto" : "Total"}
          valor={
            enBolivares
              ? `Bs. ${formatBolivares(Number(pedido.amount_ves))}`
              : formatMoney(pedido.final_total ?? pedido.total)
          }
          nota={enBolivares ? formatMoney(pedido.final_total ?? pedido.total) : null}
        />
        <Evidencia
          etiqueta="Últimos 4"
          valor={ultimos || "—"}
          // Si escribió más dígitos de los cuatro que pedimos, se muestran:
          // buscar en el banco por seis es más rápido que por cuatro.
          nota={escrito.length > ultimos.length ? `escribió ${escrito}` : null}
        />
      </div>

      <button
        type="button"
        onClick={onVerificar}
        disabled={ocupado}
        className="mt-2 flex h-11 w-full items-center justify-center gap-1.5 rounded-xl bg-emerald-600 px-4 text-sm font-semibold text-white disabled:bg-gray-200 disabled:text-gray-400"
      >
        {ocupado ? (
          <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
        ) : (
          <BadgeCheck className="h-4 w-4" aria-hidden="true" />
        )}
        Lo vi, confirmar
      </button>

      {/* No hay botón de rechazar y es a propósito: no encontrar el pago en el
          banco casi nunca significa que no llegó, significa que todavía no
          aparece. Dejarlo aquí sin tocar es exactamente lo correcto. */}
    </li>
  )
}

function Evidencia({
  etiqueta,
  valor,
  nota,
}: {
  etiqueta: string
  valor: string
  nota: string | null
}) {
  return (
    <div className="rounded-xl bg-white px-3 py-2">
      <p className="text-[10px] font-semibold uppercase tracking-wide text-gray-500">{etiqueta}</p>
      <p className="truncate text-base font-bold tabular-nums text-gray-900">{valor}</p>
      {nota && <p className="truncate text-[11px] text-gray-500">{nota}</p>}
    </div>
  )
}
