"use client"

import { useState } from "react"
import { Loader2, RotateCw } from "lucide-react"

import { createClient } from "@/lib/supabase/client"

export function DeliveryCodeCard({
  orderId,
  initialCode,
  initialAttempts,
}: {
  orderId: string
  initialCode: string
  initialAttempts: number
}) {
  const [code, setCode] = useState(initialCode)
  const [attempts, setAttempts] = useState(initialAttempts)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState("")

  const blocked = attempts >= 5

  async function regenerate() {
    setBusy(true)
    setError("")
    const supabase = createClient()
    const { data, error: rpcError } = await supabase.rpc("reset_delivery_code", {
      p_order_id: orderId,
    })
    setBusy(false)

    if (rpcError || !data) {
      setError("No pudimos generar uno nuevo. Prueba de nuevo.")
      return
    }
    setCode(data as string)
    setAttempts(0)
  }

  return (
    <section className="rounded-2xl border border-gray-900 bg-gray-900 p-5 text-center">
      <p className="text-xs font-medium uppercase tracking-wide text-gray-400">
        Código de entrega
      </p>
      <p className="mt-2 font-mono text-4xl font-bold tracking-[0.3em] text-white">{code}</p>
      <p className="mt-3 text-sm leading-relaxed text-gray-400">
        Dáselo al shopper cuando te entregue el pedido. Solo tú lo ves: sirve para confirmar que la
        entrega fue a la persona correcta.
      </p>

      {attempts > 0 && !blocked && (
        <p className="mt-3 text-sm text-amber-300">
          {attempts === 1 ? "Hubo 1 intento fallido" : `Hubo ${attempts} intentos fallidos`}. Quedan{" "}
          {5 - attempts}.
        </p>
      )}

      {blocked && (
        <p className="mt-3 text-sm text-rose-300">
          Se agotaron los cinco intentos. Genera un código nuevo para que el shopper pueda cerrar la
          entrega.
        </p>
      )}

      {error && (
        <p role="alert" className="mt-3 text-sm text-rose-300">
          {error}
        </p>
      )}

      <button
        type="button"
        onClick={() => void regenerate()}
        disabled={busy}
        className="mt-4 flex h-12 w-full items-center justify-center gap-2 rounded-xl border border-gray-700 text-sm font-semibold text-gray-200 transition active:scale-[0.99] disabled:opacity-60"
      >
        {busy ? (
          <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
        ) : (
          <RotateCw className="h-4 w-4" aria-hidden="true" />
        )}
        Generar otro código
      </button>
    </section>
  )
}
