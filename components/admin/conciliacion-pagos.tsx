"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { BadgeCheck, Loader2, Search } from "lucide-react"

import { formatMoney, formatOrderDate, type Order } from "@/lib/orders"
import { createClient } from "@/lib/supabase/client"

export type PedidoPorCobrar = Pick<
  Order,
  "id" | "code" | "total" | "final_total" | "payment_method" | "payment_reference" | "payment_reported_at"
>

/**
 * Los pedidos esperando que alguien confirme que el dinero llegó, y la forma
 * de meter un pago que se vio en el banco.
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
    else if (r?.conciliado) setResultado("Enganchado: el pedido quedó verificado.")
    else setResultado("Guardado. Cuando el cliente reporte esa referencia, se verifica solo.")

    router.refresh()
  }

  async function verificar(id: string) {
    setVerificando(id)
    setError("")
    const { error: rpcError } = await createClient().rpc("verify_payment", {
      p_order_id: id,
      p_ok: true,
    })
    setVerificando(null)
    if (rpcError) {
      setError(rpcError.message)
      return
    }
    router.refresh()
  }

  return (
    <div className="flex flex-col gap-4">
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
        <h3 className="mb-2 text-sm font-semibold text-gray-900">
          Esperando verificación ({pedidos.length})
        </h3>

        {pedidos.length === 0 ? (
          <p className="text-sm leading-relaxed text-gray-500">
            Ningún cliente tiene un pago reportado sin verificar.
          </p>
        ) : (
          <ul className="flex flex-col gap-2">
            {pedidos.map((pedido) => (
              <li
                key={pedido.id}
                className="flex flex-wrap items-center gap-3 rounded-2xl border border-amber-200 bg-amber-50/60 p-3"
              >
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold text-gray-900">
                    <span className="font-mono">{pedido.code}</span> ·{" "}
                    {formatMoney(pedido.final_total ?? pedido.total)}
                  </p>
                  <p className="truncate text-xs text-gray-600">
                    Ref.{" "}
                    <span className="font-mono font-semibold">{pedido.payment_reference}</span>
                    {pedido.payment_reported_at
                      ? ` · reportado ${formatOrderDate(pedido.payment_reported_at)}`
                      : ""}
                  </p>
                </div>

                <button
                  type="button"
                  onClick={() => void verificar(pedido.id)}
                  disabled={verificando === pedido.id}
                  className="flex h-11 shrink-0 items-center justify-center gap-1.5 rounded-xl bg-emerald-600 px-4 text-sm font-semibold text-white disabled:bg-gray-200 disabled:text-gray-400"
                >
                  {verificando === pedido.id ? (
                    <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                  ) : (
                    <BadgeCheck className="h-4 w-4" aria-hidden="true" />
                  )}
                  Lo vi, confirmar
                </button>
              </li>
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
