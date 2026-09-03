"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { BadgeCheck, Check, Copy, Loader2 } from "lucide-react"

import { formatMoney } from "@/lib/orders"
import { createClient } from "@/lib/supabase/client"

/**
 * A dónde pagar y cómo avisar que se pagó.
 *
 * Antes el cliente elegía Pago Móvil en el checkout y ahí terminaba: nunca se
 * le decía a qué banco ni a nombre de quién, y no tenía forma de avisar que
 * había transferido. El pedido quedaba esperando un dinero que nadie sabía si
 * había llegado.
 */
export function PagarPedido({
  orderId,
  total,
  instrucciones,
  referencia,
  verificado,
}: {
  orderId: string
  total: number
  instrucciones: string
  referencia: string | null
  verificado: boolean
}) {
  const router = useRouter()
  const [texto, setTexto] = useState(referencia ?? "")
  const [guardando, setGuardando] = useState(false)
  const [error, setError] = useState("")
  const [copiado, setCopiado] = useState(false)

  async function copiar() {
    try {
      await navigator.clipboard.writeText(instrucciones)
      setCopiado(true)
      setTimeout(() => setCopiado(false), 2000)
    } catch {
      // Sin portapapeles queda el texto a la vista para copiarlo a mano.
    }
  }

  async function reportar() {
    const limpia = texto.trim()
    if (limpia.length < 4) {
      setError("Escribe al menos los últimos 4 dígitos de la referencia.")
      return
    }

    setGuardando(true)
    setError("")

    const { error: rpcError } = await createClient().rpc("report_payment", {
      p_order_id: orderId,
      p_reference: limpia,
    })

    setGuardando(false)

    if (rpcError) {
      setError(
        rpcError.message.includes("does not exist")
          ? "Falta correr la migración de pagos en Supabase."
          : rpcError.message,
      )
      return
    }
    router.refresh()
  }

  if (verificado) {
    return (
      <section className="flex items-center gap-3 rounded-2xl border border-emerald-100 bg-emerald-50 p-4">
        <BadgeCheck className="h-5 w-5 shrink-0 text-emerald-600" aria-hidden="true" />
        <div className="min-w-0">
          <p className="text-sm font-semibold text-emerald-900">Pago confirmado</p>
          {referencia && (
            <p className="truncate text-sm text-emerald-800">Referencia {referencia}</p>
          )}
        </div>
      </section>
    )
  }

  return (
    <section className="rounded-2xl border border-gray-100 bg-white p-5">
      <h2 className="text-base font-semibold text-gray-900">
        Paga {formatMoney(total)} para que salga tu pedido
      </h2>

      <div className="mt-3 rounded-xl bg-gray-50 p-3">
        <div className="flex items-start justify-between gap-2">
          <p className="whitespace-pre-line text-sm leading-relaxed text-gray-800">
            {instrucciones}
          </p>
          <button
            type="button"
            onClick={() => void copiar()}
            className="flex h-9 shrink-0 items-center gap-1.5 rounded-lg border border-gray-200 bg-white px-2.5 text-xs font-semibold text-gray-600 active:bg-gray-100"
            aria-label="Copiar los datos de pago"
          >
            {copiado ? (
              <Check className="h-3.5 w-3.5 text-emerald-600" aria-hidden="true" />
            ) : (
              <Copy className="h-3.5 w-3.5" aria-hidden="true" />
            )}
            {copiado ? "Copiado" : "Copiar"}
          </button>
        </div>
      </div>

      <label htmlFor="referencia" className="mt-4 block text-sm font-medium text-gray-700">
        {referencia ? "Tu referencia" : "Cuando pagues, escribe la referencia"}
      </label>
      <input
        id="referencia"
        value={texto}
        onChange={(event) => {
          setTexto(event.target.value)
          if (error) setError("")
        }}
        inputMode="numeric"
        maxLength={40}
        placeholder="Últimos dígitos de la transferencia"
        className="mt-1.5 h-12 w-full rounded-xl border border-gray-200 bg-white px-3 text-base text-gray-900 outline-none transition placeholder:text-gray-400 focus:border-emerald-500"
      />

      {error && (
        <p role="alert" className="mt-2 text-sm text-rose-600">
          {error}
        </p>
      )}

      {referencia && texto.trim() === referencia && (
        <p className="mt-2 text-sm leading-relaxed text-gray-500">
          Ya la reportaste. El abasto la verifica y el pedido sigue su curso. Si te equivocaste,
          corrígela aquí mismo.
        </p>
      )}

      <button
        type="button"
        onClick={() => void reportar()}
        disabled={guardando || texto.trim().length < 4 || texto.trim() === (referencia ?? "")}
        className="mt-3 flex h-12 w-full items-center justify-center gap-2 rounded-2xl bg-emerald-600 text-sm font-semibold text-white transition active:scale-[0.99] disabled:bg-gray-200 disabled:text-gray-400"
      >
        {guardando && <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />}
        {referencia ? "Corregir la referencia" : "Ya pagué"}
      </button>
    </section>
  )
}
