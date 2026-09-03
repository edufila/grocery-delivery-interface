"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Loader2, TriangleAlert } from "lucide-react"

import { createClient } from "@/lib/supabase/client"

type Modo = null | "soltar" | "cancelar"

/**
 * Salida para cuando la compra no se puede hacer. Sin esto el shopper que tomó
 * un pedido y se encontró el abasto cerrado lo arrastraba para siempre.
 */
export function OrderProblem({ orderId }: { orderId: string }) {
  const router = useRouter()
  const [modo, setModo] = useState<Modo>(null)
  const [reason, setReason] = useState("")
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState("")

  async function release() {
    setBusy(true)
    setError("")
    const { data, error: rpcError } = await createClient().rpc("shopper_release_order", {
      p_order_id: orderId,
    })
    setBusy(false)

    if (rpcError || data !== true) {
      setError("No se pudo soltar. Si ya saliste a entregar, cancelalo con un motivo.")
      return
    }
    router.push("/shopper")
  }

  async function cancel() {
    if (reason.trim().length < 5) return
    setBusy(true)
    setError("")
    const { data, error: rpcError } = await createClient().rpc("shopper_cancel_order", {
      p_order_id: orderId,
      p_reason: reason.trim(),
    })
    setBusy(false)

    if (rpcError || data !== true) {
      setError(rpcError?.message ?? "No se pudo cancelar.")
      return
    }
    router.push("/shopper")
  }

  if (modo === null) {
    return (
      <button
        type="button"
        onClick={() => setModo("soltar")}
        className="flex min-h-11 w-full items-center justify-center gap-2 text-sm font-medium text-gray-500"
      >
        <TriangleAlert className="h-4 w-4" aria-hidden="true" />
        No puedo con este pedido
      </button>
    )
  }

  return (
    <section className="rounded-2xl border border-amber-200 bg-amber-50 p-4">
      {error && (
        <p role="alert" className="mb-3 text-sm font-medium text-rose-700">
          {error}
        </p>
      )}

      {modo === "soltar" ? (
        <>
          <h2 className="text-sm font-semibold text-amber-900">¿Qué pasó?</h2>
          <p className="mt-1 text-sm leading-relaxed text-amber-800">
            Si podés seguir pero no ahora, soltalo y vuelve a la lista para otro shopper. Si el
            pedido no se puede cumplir, cancelalo explicando por qué: el cliente lo va a leer.
          </p>

          <div className="mt-3 flex flex-col gap-2">
            <button
              type="button"
              onClick={() => void release()}
              disabled={busy}
              className="flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-amber-900 text-sm font-semibold text-white disabled:opacity-60"
            >
              {busy && <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />}
              Soltarlo para otro shopper
            </button>
            <button
              type="button"
              onClick={() => {
                setModo("cancelar")
                setError("")
              }}
              className="h-12 w-full rounded-xl border border-amber-300 text-sm font-semibold text-amber-900"
            >
              Cancelar el pedido
            </button>
            <button
              type="button"
              onClick={() => setModo(null)}
              className="min-h-11 text-sm font-medium text-amber-800"
            >
              Volver
            </button>
          </div>
        </>
      ) : (
        <>
          <h2 className="text-sm font-semibold text-amber-900">¿Por qué se cancela?</h2>
          <p className="mt-1 text-sm leading-relaxed text-amber-800">
            El cliente va a ver este motivo en su pedido.
          </p>
          <input
            value={reason}
            onChange={(event) => setReason(event.target.value)}
            placeholder="El abasto está cerrado"
            aria-label="Motivo de la cancelación"
            className="mt-3 h-12 w-full rounded-xl border border-amber-300 bg-white px-3 text-base text-gray-900 outline-none placeholder:text-gray-400 focus:border-amber-500"
          />

          <div className="mt-3 flex gap-2">
            <button
              type="button"
              onClick={() => void cancel()}
              disabled={busy || reason.trim().length < 5}
              className="flex h-12 flex-1 items-center justify-center gap-2 rounded-xl bg-rose-600 text-sm font-semibold text-white disabled:bg-gray-200 disabled:text-gray-400"
            >
              {busy && <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />}
              Cancelar el pedido
            </button>
            <button
              type="button"
              onClick={() => setModo("soltar")}
              className="h-12 rounded-xl border border-amber-300 px-4 text-sm font-semibold text-amber-900"
            >
              Volver
            </button>
          </div>
        </>
      )}
    </section>
  )
}
