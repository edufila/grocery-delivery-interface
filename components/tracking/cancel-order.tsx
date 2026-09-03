"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Loader2, XCircle } from "lucide-react"

import { createClient } from "@/lib/supabase/client"

/**
 * Solo aparece mientras nadie tomó el pedido: una vez que el shopper salió a
 * comprar, cancelar deja mercadería pagada en la calle. Eso se resuelve
 * hablando por el chat, no con un botón.
 */
export function CancelOrder({ orderId }: { orderId: string }) {
  const router = useRouter()
  const [confirming, setConfirming] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState("")

  async function cancel() {
    setBusy(true)
    setError("")

    const { data, error: cancelError } = await createClient()
      .from("orders")
      .update({ status: "cancelado" })
      .eq("id", orderId)
      .select("id")

    setBusy(false)

    if (cancelError) {
      setError("No pudimos cancelarlo. Probá de nuevo.")
      return
    }
    if (!data || data.length === 0) {
      // La política deja de aplicar en cuanto alguien lo toma.
      setError("Un shopper ya lo tomó, así que no se puede cancelar. Escribile por el chat.")
      router.refresh()
      return
    }
    router.refresh()
  }

  if (!confirming) {
    return (
      <button
        type="button"
        onClick={() => setConfirming(true)}
        className="flex min-h-11 w-full items-center justify-center gap-2 text-sm font-medium text-gray-500"
      >
        <XCircle className="h-4 w-4" aria-hidden="true" />
        Cancelar pedido
      </button>
    )
  }

  return (
    <div className="rounded-2xl border border-rose-200 bg-rose-50 p-4">
      <p className="text-sm leading-relaxed text-rose-900">
        ¿Seguro? El pedido queda cancelado y no se puede reabrir. Si ya te asignaron shopper, mejor
        escribile por el chat.
      </p>

      {error && (
        <p role="alert" className="mt-2 text-sm font-medium text-rose-700">
          {error}
        </p>
      )}

      <div className="mt-3 flex gap-2">
        <button
          type="button"
          onClick={() => void cancel()}
          disabled={busy}
          className="flex h-12 flex-1 items-center justify-center gap-2 rounded-xl bg-rose-600 text-sm font-semibold text-white disabled:opacity-60"
        >
          {busy && <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />}
          Sí, cancelar
        </button>
        <button
          type="button"
          onClick={() => {
            setConfirming(false)
            setError("")
          }}
          className="h-12 rounded-xl border border-gray-200 bg-white px-4 text-sm font-semibold text-gray-600"
        >
          No
        </button>
      </div>
    </div>
  )
}
