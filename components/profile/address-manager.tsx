"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Check, Loader2, MapPin, Plus, Trash2 } from "lucide-react"

import { createClient } from "@/lib/supabase/client"
import type { Address } from "@/lib/orders"

export function AddressManager({ userId, addresses }: { userId: string; addresses: Address[] }) {
  const router = useRouter()
  const supabase = createClient()

  const [adding, setAdding] = useState(false)
  const [label, setLabel] = useState("")
  const [detail, setDetail] = useState("")
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState("")

  const canAdd = label.trim().length >= 2 && detail.trim().length >= 5 && !busy

  async function add(event: React.FormEvent) {
    event.preventDefault()
    if (!canAdd) return
    setBusy(true)
    setError("")

    const { error: insertError } = await supabase.from("addresses").insert({
      user_id: userId,
      label: label.trim(),
      detail: detail.trim(),
      // La primera que carga queda como la de siempre.
      is_default: addresses.length === 0,
    })

    setBusy(false)
    if (insertError) {
      setError(
        insertError.message.includes("does not exist")
          ? "Falta correr la migración de pedidos en Supabase."
          : "No pudimos guardar la dirección.",
      )
      return
    }

    setLabel("")
    setDetail("")
    setAdding(false)
    router.refresh()
  }

  async function makeDefault(id: string) {
    setBusy(true)
    // Primero bajamos la actual: hay un índice único que impide dos por defecto.
    await supabase.from("addresses").update({ is_default: false }).eq("user_id", userId)
    await supabase.from("addresses").update({ is_default: true }).eq("id", id)
    setBusy(false)
    router.refresh()
  }

  async function remove(id: string) {
    setBusy(true)
    await supabase.from("addresses").delete().eq("id", id)
    setBusy(false)
    router.refresh()
  }

  return (
    <div className="flex flex-col gap-3">
      {addresses.length === 0 && !adding && (
        <p className="text-sm leading-relaxed text-gray-500">
          Todavía no cargaste ninguna dirección. Hace falta al menos una para poder pedir.
        </p>
      )}

      {addresses.length > 0 && (
        <ul className="flex flex-col gap-2">
          {addresses.map((address) => (
            <li
              key={address.id}
              className={`flex items-start gap-3 rounded-2xl border p-3 ${
                address.is_default ? "border-emerald-500 bg-emerald-50/50" : "border-gray-200"
              }`}
            >
              <span
                className={`mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-full ${
                  address.is_default ? "bg-emerald-100" : "bg-gray-100"
                }`}
              >
                <MapPin
                  className={`h-4 w-4 ${address.is_default ? "text-emerald-600" : "text-gray-400"}`}
                  aria-hidden="true"
                />
              </span>

              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold text-gray-900">{address.label}</p>
                <p className="text-sm text-gray-500">{address.detail}</p>
                {!address.is_default && (
                  <button
                    type="button"
                    onClick={() => void makeDefault(address.id)}
                    disabled={busy}
                    className="mt-1 min-h-9 text-sm font-medium text-emerald-600 disabled:text-gray-400"
                  >
                    Usar como principal
                  </button>
                )}
                {address.is_default && (
                  <p className="mt-1 flex items-center gap-1 text-xs font-medium text-emerald-700">
                    <Check className="h-3.5 w-3.5" aria-hidden="true" /> Principal
                  </p>
                )}
              </div>

              <button
                type="button"
                onClick={() => void remove(address.id)}
                disabled={busy}
                className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-gray-400 active:bg-gray-100 disabled:opacity-50"
                aria-label={`Eliminar ${address.label}`}
              >
                <Trash2 className="h-4 w-4" aria-hidden="true" />
              </button>
            </li>
          ))}
        </ul>
      )}

      {adding ? (
        <form onSubmit={add} className="flex flex-col gap-3 rounded-2xl border border-gray-200 p-3">
          <div>
            <label htmlFor="addr_label" className="block text-sm font-medium text-gray-700">
              Nombre
            </label>
            <input
              id="addr_label"
              value={label}
              onChange={(event) => setLabel(event.target.value)}
              placeholder="Casa, Trabajo..."
              className="mt-1.5 h-12 w-full rounded-xl border border-gray-200 px-3 text-base outline-none focus:border-emerald-500"
            />
          </div>
          <div>
            <label htmlFor="addr_detail" className="block text-sm font-medium text-gray-700">
              Dirección
            </label>
            <input
              id="addr_detail"
              value={detail}
              onChange={(event) => setDetail(event.target.value)}
              placeholder="Av. Las Delicias, Urb. El Bosque"
              className="mt-1.5 h-12 w-full rounded-xl border border-gray-200 px-3 text-base outline-none focus:border-emerald-500"
            />
          </div>

          {error && (
            <p role="alert" className="text-sm text-rose-600">
              {error}
            </p>
          )}

          <div className="flex gap-2">
            <button
              type="submit"
              disabled={!canAdd}
              className="flex h-12 flex-1 items-center justify-center gap-2 rounded-xl bg-emerald-600 text-sm font-semibold text-white disabled:bg-gray-200 disabled:text-gray-400"
            >
              {busy && <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />}
              Guardar
            </button>
            <button
              type="button"
              onClick={() => {
                setAdding(false)
                setError("")
              }}
              className="h-12 rounded-xl border border-gray-200 px-4 text-sm font-semibold text-gray-600"
            >
              Cancelar
            </button>
          </div>
        </form>
      ) : (
        <button
          type="button"
          onClick={() => setAdding(true)}
          className="flex h-12 w-full items-center justify-center gap-2 rounded-2xl border border-dashed border-gray-300 text-sm font-semibold text-gray-600 active:bg-gray-50"
        >
          <Plus className="h-4 w-4" aria-hidden="true" />
          Agregar dirección
        </button>
      )}
    </div>
  )
}
