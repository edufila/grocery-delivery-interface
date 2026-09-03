"use client"

import { useRef, useState } from "react"
import { useRouter } from "next/navigation"
import { Check, Keyboard, Loader2 } from "lucide-react"

import { NEXT_STATUS_ACTION, nextStatus, type Order } from "@/lib/orders"
import { createClient } from "@/lib/supabase/client"

export function ShopperActions({
  order,
  userId,
  sharing = false,
}: {
  order: Order
  userId: string
  /** Salir a entregar sin transmitir deja al cliente sin saber dónde estás. */
  sharing?: boolean
}) {
  const router = useRouter()
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState("")
  const [code, setCode] = useState("")
  const [blocked, setBlocked] = useState(false)
  // Numérico por defecto. Si la pantalla del teléfono está rota justo donde
  // caen las teclas, con el teclado normal se puede escribir igual.
  const [numericKeyboard, setNumericKeyboard] = useState(true)
  const codeRef = useRef<HTMLInputElement>(null)

  function toggleKeyboard() {
    setNumericKeyboard((v) => !v)
    // El teclado ya abierto no cambia solo: hay que soltar el foco y volver.
    const input = codeRef.current
    if (!input) return
    input.blur()
    setTimeout(() => input.focus(), 50)
  }

  const mine = order.shopper_id === userId
  const siguiente = nextStatus(order.status)
  // La entrega no se marca con un update: la base exige el código del cliente.
  const needsCode = mine && order.status === "en_camino"
  // Salir a entregar es el paso que el cliente sigue en el mapa.
  const bloqueadoPorUbicacion = mine && siguiente === "en_camino" && !sharing

  async function deliver() {
    if (code.length !== 4) return
    setBusy(true)
    setError("")

    const supabase = createClient()
    const { data, error: rpcError } = await supabase.rpc("deliver_order", {
      p_order_id: order.id,
      p_code: code,
    })

    setBusy(false)

    if (rpcError) {
      setError("No pudimos confirmar la entrega. Probá de nuevo.")
      return
    }

    const result = data as { ok: boolean; motivo?: string; restantes?: number } | null

    if (result?.ok) {
      router.refresh()
      return
    }

    setCode("")

    if (result?.motivo === "bloqueado") {
      setBlocked(true)
      setError("Se agotaron los intentos. Pedile al cliente que genere un código nuevo.")
      return
    }
    if (result?.motivo === "no_corresponde") {
      setError("Este pedido ya no está en camino. Refrescá la pantalla.")
      return
    }

    const quedan = result?.restantes ?? 0
    if (quedan <= 0) {
      setBlocked(true)
      setError("Se agotaron los intentos. Pedile al cliente que genere un código nuevo.")
      return
    }
    setError(
      `Ese código no coincide. Te ${quedan === 1 ? "queda 1 intento" : `quedan ${quedan} intentos`}.`,
    )
  }

  async function take() {
    setBusy(true)
    setError("")
    const supabase = createClient()
    // El .is() evita pisar un pedido que otro ya tomó. Pero entonces no
    // actualiza ninguna fila y Supabase no lo considera un error: hay que
    // mirar cuántas volvieron, o diríamos que salió bien sin haber hecho nada.
    const { data, error: updateError } = await supabase
      .from("orders")
      .update({ shopper_id: userId })
      .eq("id", order.id)
      .is("shopper_id", null)
      .select("id")

    setBusy(false)

    if (updateError) {
      setError("No pudimos tomarlo. Probá de nuevo.")
      return
    }
    if (!data || data.length === 0) {
      setError("Otro shopper se adelantó y ya lo tomó.")
      router.refresh()
      return
    }
    router.refresh()
  }

  async function advance() {
    if (!siguiente) return
    setBusy(true)
    setError("")
    const supabase = createClient()
    const { error: updateError } = await supabase
      .from("orders")
      .update({ status: siguiente, shopper_id: userId })
      .eq("id", order.id)

    setBusy(false)
    if (updateError) {
      setError("No pudimos actualizar el estado.")
      return
    }
    router.refresh()
  }

  return (
    <div className="flex flex-col gap-3">
      {error && (
        <p role="alert" className="text-sm text-rose-600">
          {error}
        </p>
      )}

      {needsCode ? (
        <section className="rounded-2xl border border-gray-100 bg-white p-5">
          <h2 className="text-base font-semibold text-gray-900">Código de entrega</h2>
          <p className="mt-1 text-sm leading-relaxed text-gray-500">
            Pedíselo al cliente al entregarle el pedido. Son 4 dígitos.
          </p>

          <input
            ref={codeRef}
            value={code}
            onChange={(event) => {
              setCode(event.target.value.replace(/\D/g, "").slice(0, 4))
              if (error) setError("")
            }}
            inputMode={numericKeyboard ? "numeric" : "text"}
            autoComplete="off"
            maxLength={4}
            disabled={blocked}
            placeholder="0000"
            aria-label="Código de entrega"
            className="mt-4 h-16 w-full rounded-2xl border border-gray-200 bg-white text-center font-mono text-3xl tracking-[0.4em] text-gray-900 outline-none transition placeholder:text-gray-300 focus:border-emerald-500 focus:ring-4 focus:ring-emerald-500/10 disabled:bg-gray-50 disabled:text-gray-400"
          />

          <button
            type="button"
            onClick={toggleKeyboard}
            className="mt-2 flex min-h-11 w-full items-center justify-center gap-2 text-sm font-medium text-emerald-600"
          >
            <Keyboard className="h-4 w-4" aria-hidden="true" />
            {numericKeyboard ? "Usar el teclado normal" : "Usar el teclado numérico"}
          </button>

          <button
            type="button"
            onClick={() => void deliver()}
            disabled={busy || code.length !== 4 || blocked}
            className="mt-2 flex h-14 w-full items-center justify-center gap-2 rounded-2xl bg-emerald-600 text-base font-semibold text-white transition active:scale-[0.99] disabled:bg-gray-200 disabled:text-gray-400"
          >
            {busy && <Loader2 className="h-5 w-5 animate-spin" aria-hidden="true" />}
            Confirmar entrega
          </button>
        </section>
      ) : !mine ? (
        <button
          type="button"
          onClick={() => void take()}
          disabled={busy}
          className="flex h-14 w-full items-center justify-center gap-2 rounded-2xl bg-emerald-600 text-base font-semibold text-white transition active:scale-[0.99] disabled:bg-gray-200 disabled:text-gray-400"
        >
          {busy && <Loader2 className="h-5 w-5 animate-spin" aria-hidden="true" />}
          Tomar este pedido
        </button>
      ) : siguiente ? (
        <>
          {bloqueadoPorUbicacion && (
            <p className="rounded-2xl bg-amber-50 px-4 py-3 text-sm leading-relaxed text-amber-800">
              Encendé <span className="font-semibold">Compartir mi ubicación</span> antes de salir.
              El cliente tiene que poder ver por dónde vas.
            </p>
          )}
          <button
            type="button"
            onClick={() => void advance()}
            disabled={busy || bloqueadoPorUbicacion}
            className="flex h-14 w-full items-center justify-center gap-2 rounded-2xl bg-emerald-600 text-base font-semibold text-white transition active:scale-[0.99] disabled:bg-gray-200 disabled:text-gray-400"
          >
            {busy && <Loader2 className="h-5 w-5 animate-spin" aria-hidden="true" />}
            {NEXT_STATUS_ACTION[siguiente] ?? "Avanzar"}
          </button>
        </>
      ) : (
        <p className="flex h-14 w-full items-center justify-center gap-2 rounded-2xl bg-emerald-50 text-base font-semibold text-emerald-700">
          <Check className="h-5 w-5" aria-hidden="true" />
          Pedido entregado
        </p>
      )}
    </div>
  )
}
