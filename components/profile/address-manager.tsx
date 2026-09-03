"use client"

import { useEffect, useRef, useState } from "react"
import { useRouter } from "next/navigation"
import { Check, Loader2, MapPin, MapPinOff, Pencil, Plus, Trash2 } from "lucide-react"

import { createClient } from "@/lib/supabase/client"
import type { Address } from "@/lib/orders"
import { UseMyLocation, type Coords } from "./use-my-location"

type Draft = { id: string | null; label: string; detail: string; coords: Coords }

const EMPTY: Draft = { id: null, label: "", detail: "", coords: null }

export function AddressManager({ userId, addresses }: { userId: string; addresses: Address[] }) {
  const router = useRouter()
  const supabase = createClient()

  const [draft, setDraft] = useState<Draft | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState("")
  const formRef = useRef<HTMLFormElement>(null)

  // El formulario aparece debajo de la lista: con varias direcciones cargadas
  // queda fuera de pantalla y parece que el botón no hizo nada.
  useEffect(() => {
    if (draft) formRef.current?.scrollIntoView({ behavior: "smooth", block: "center" })
  }, [draft?.id, draft === null])

  const editing = draft?.id != null
  // El pin es obligatorio: aquí la gente no maneja nombres de calles, y sin el
  // punto en el mapa el repartidor no tiene a dónde ir.
  const canSave =
    !!draft &&
    draft.label.trim().length >= 2 &&
    draft.detail.trim().length >= 5 &&
    !!draft.coords &&
    !busy

  function startAdd() {
    setDraft({ ...EMPTY, label: addresses.length === 0 ? "Casa" : "" })
    setError("")
  }

  function startEdit(address: Address) {
    setDraft({
      id: address.id,
      label: address.label,
      detail: address.detail,
      coords: address.lat != null && address.lng != null ? { lat: address.lat, lng: address.lng } : null,
    })
    setError("")
  }

  async function save(event: React.FormEvent) {
    event.preventDefault()
    if (!draft || !canSave) return

    setBusy(true)
    setError("")

    const values = {
      label: draft.label.trim(),
      detail: draft.detail.trim(),
      lat: draft.coords?.lat ?? null,
      lng: draft.coords?.lng ?? null,
    }

    const { error: saveError } = draft.id
      ? await supabase.from("addresses").update(values).eq("id", draft.id)
      : await supabase
          .from("addresses")
          .insert({ ...values, user_id: userId, is_default: addresses.length === 0 })

    setBusy(false)
    if (saveError) {
      setError(
        saveError.message.includes("does not exist")
          ? "Falta correr la migración de direcciones en Supabase."
          : "No pudimos guardar la dirección.",
      )
      return
    }

    setDraft(null)
    router.refresh()
  }

  async function makeDefault(id: string) {
    setBusy(true)
    await supabase.from("addresses").update({ is_default: false }).eq("user_id", userId)
    await supabase.from("addresses").update({ is_default: true }).eq("id", id)
    setBusy(false)
    router.refresh()
  }

  async function remove(id: string) {
    setBusy(true)
    await supabase.from("addresses").delete().eq("id", id)
    setBusy(false)
    if (draft?.id === id) setDraft(null)
    router.refresh()
  }

  return (
    <div className="flex flex-col gap-3">
      {addresses.length === 0 && !draft && (
        <p className="text-sm leading-relaxed text-gray-500">
          Todavía no cargaste ninguna dirección. Hace falta al menos una para poder pedir.
        </p>
      )}

      {addresses.length > 0 && (
        <ul className="flex flex-col gap-2">
          {addresses.map((address) => {
            const sinPin = address.lat == null || address.lng == null
            return (
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
                  {sinPin ? (
                    <MapPinOff className="h-4 w-4 text-amber-600" aria-hidden="true" />
                  ) : (
                    <MapPin
                      className={`h-4 w-4 ${address.is_default ? "text-emerald-600" : "text-gray-400"}`}
                      aria-hidden="true"
                    />
                  )}
                </span>

                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold text-gray-900">{address.label}</p>
                  <p className="text-sm text-gray-500">{address.detail}</p>

                  {sinPin && (
                    <p className="mt-1 text-xs leading-relaxed text-amber-700">
                      Sin punto en el mapa. Editala y marca dónde entregar, o el seguimiento no
                      puede dibujar el mapa.
                    </p>
                  )}

                  <div className="mt-1.5 flex flex-wrap items-center gap-x-4">
                    <button
                      type="button"
                      onClick={() => startEdit(address)}
                      disabled={busy}
                      className="flex min-h-9 items-center gap-1.5 text-sm font-medium text-emerald-600 disabled:text-gray-400"
                    >
                      <Pencil className="h-3.5 w-3.5" aria-hidden="true" />
                      Editar
                    </button>

                    {!address.is_default && (
                      <button
                        type="button"
                        onClick={() => void makeDefault(address.id)}
                        disabled={busy}
                        className="min-h-9 text-sm font-medium text-emerald-600 disabled:text-gray-400"
                      >
                        Usar como principal
                      </button>
                    )}
                    {address.is_default && (
                      <span className="flex min-h-9 items-center gap-1 text-xs font-medium text-emerald-700">
                        <Check className="h-3.5 w-3.5" aria-hidden="true" /> Principal
                      </span>
                    )}
                  </div>
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
            )
          })}
        </ul>
      )}

      {draft ? (
        <form
          ref={formRef}
          onSubmit={save}
          className="flex flex-col gap-3 rounded-2xl border border-gray-200 p-3"
        >
          <h3 className="text-sm font-semibold text-gray-900">
            {editing ? "Editar dirección" : "Nueva dirección"}
          </h3>

          <div>
            <label htmlFor="addr_label" className="block text-sm font-medium text-gray-700">
              Nombre
            </label>
            <input
              id="addr_label"
              value={draft.label}
              onChange={(event) => setDraft({ ...draft, label: event.target.value })}
              placeholder="Casa, Trabajo..."
              className="mt-1.5 h-12 w-full rounded-xl border border-gray-200 bg-white px-3 text-base text-gray-900 outline-none transition placeholder:text-gray-400 focus:border-emerald-500"
            />
          </div>

          <div>
            <label htmlFor="addr_detail" className="block text-sm font-medium text-gray-700">
              Dirección
            </label>
            <input
              id="addr_detail"
              value={draft.detail}
              onChange={(event) => setDraft({ ...draft, detail: event.target.value })}
              placeholder="Urb. La Zaragoza, casa 3"
              className="mt-1.5 h-12 w-full rounded-xl border border-gray-200 bg-white px-3 text-base text-gray-900 outline-none transition placeholder:text-gray-400 focus:border-emerald-500"
            />
          </div>

          {/* key: al pasar de agregar a editar el mapa se rearma en el punto
              correcto en vez de quedarse donde estaba. */}
          <UseMyLocation
            key={draft.id ?? "nueva"}
            coords={draft.coords}
            onCapture={(coords) => setDraft((d) => (d ? { ...d, coords } : d))}
          />

          {!draft.coords && (
            <p className="rounded-xl bg-amber-50 px-3 py-2.5 text-sm leading-relaxed text-amber-800">
              Marca el punto en el mapa para poder guardar. Sin eso no hay forma de llegar.
            </p>
          )}

          {error && (
            <p role="alert" className="text-sm text-rose-600">
              {error}
            </p>
          )}

          <div className="flex gap-2">
            <button
              type="submit"
              disabled={!canSave}
              className="flex h-12 flex-1 items-center justify-center gap-2 rounded-xl bg-emerald-600 text-sm font-semibold text-white disabled:bg-gray-200 disabled:text-gray-400"
            >
              {busy && <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />}
              Guardar
            </button>
            <button
              type="button"
              onClick={() => {
                setDraft(null)
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
          onClick={startAdd}
          className="flex h-12 w-full items-center justify-center gap-2 rounded-2xl border border-dashed border-gray-300 text-sm font-semibold text-gray-600 active:bg-gray-50"
        >
          <Plus className="h-4 w-4" aria-hidden="true" />
          Agregar dirección
        </button>
      )}
    </div>
  )
}
