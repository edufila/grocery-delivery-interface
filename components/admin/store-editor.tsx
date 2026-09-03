"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Check, Loader2, MapPin } from "lucide-react"

import { UseMyLocation, type Coords } from "@/components/profile/use-my-location"
import { STORE_TEXT_FIELDS, type Store } from "@/lib/admin"
import { createClient } from "@/lib/supabase/client"

export function StoreEditor({ store }: { store: Store }) {
  const router = useRouter()
  const [draft, setDraft] = useState<Store>(store)
  const [coords, setCoords] = useState<Coords>(
    store.lat != null && store.lng != null ? { lat: store.lat, lng: store.lng } : null,
  )
  const [showMap, setShowMap] = useState(false)
  const [busy, setBusy] = useState(false)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState("")

  async function save() {
    setBusy(true)
    setError("")
    setSaved(false)

    const { error: saveError } = await createClient()
      .from("stores")
      .update({
        name: draft.name,
        tag: draft.tag,
        eta: draft.eta,
        image: draft.image,
        rating: draft.rating,
        reviews: draft.reviews,
        delivery_fee: draft.delivery_fee,
        active: draft.active,
        lat: coords?.lat ?? null,
        lng: coords?.lng ?? null,
      })
      .eq("id", store.id)

    setBusy(false)
    if (saveError) {
      setError("No pudimos guardar. ¿Tu rol sigue siendo admin o dev?")
      return
    }
    setSaved(true)
    router.refresh()
  }

  return (
    <article className="rounded-2xl border border-gray-200 bg-white p-4">
      <div className="flex items-center justify-between gap-3">
        <h3 className="font-mono text-sm font-semibold text-gray-900">{store.id}</h3>
        <label className="flex items-center gap-2 text-sm text-gray-600">
          <input
            type="checkbox"
            checked={draft.active}
            onChange={(event) => setDraft({ ...draft, active: event.target.checked })}
            className="h-4 w-4 accent-emerald-600"
          />
          Visible en el inicio
        </label>
      </div>

      <div className="mt-3 grid gap-3 sm:grid-cols-2">
        {STORE_TEXT_FIELDS.map((field) => (
          <label key={field.key} className="block">
            <span className="block text-sm font-medium text-gray-700">{field.label}</span>
            <input
              value={(draft[field.key] as string | null) ?? ""}
              onChange={(event) => setDraft({ ...draft, [field.key]: event.target.value })}
              placeholder={"hint" in field ? field.hint : undefined}
              className="mt-1 h-12 w-full rounded-xl border border-gray-200 bg-white px-3 text-base text-gray-900 outline-none placeholder:text-gray-400 focus:border-emerald-500"
            />
          </label>
        ))}

        <label className="block">
          <span className="block text-sm font-medium text-gray-700">Costo de envío ($)</span>
          <input
            type="number"
            step="0.01"
            min="0"
            value={draft.delivery_fee}
            onChange={(event) =>
              setDraft({ ...draft, delivery_fee: Number(event.target.value) || 0 })
            }
            className="mt-1 h-12 w-full rounded-xl border border-gray-200 bg-white px-3 text-base tabular-nums text-gray-900 outline-none focus:border-emerald-500"
          />
        </label>
      </div>

      <div className="mt-4 flex items-center gap-3">
        <MapPin
          className={`h-4 w-4 shrink-0 ${coords ? "text-emerald-600" : "text-amber-600"}`}
          aria-hidden="true"
        />
        <span className="flex-1 text-sm text-gray-600">
          {coords ? (
            <span className="font-mono text-xs">
              {coords.lat.toFixed(5)}, {coords.lng.toFixed(5)}
            </span>
          ) : (
            "Sin punto en el mapa: no se puede trazar la ruta del shopper."
          )}
        </span>
        <button
          type="button"
          onClick={() => setShowMap((v) => !v)}
          className="min-h-11 shrink-0 text-sm font-semibold text-emerald-600"
        >
          {showMap ? "Cerrar mapa" : "Ubicar"}
        </button>
      </div>

      {showMap && (
        <div className="mt-3">
          <UseMyLocation coords={coords} onCapture={setCoords} />
        </div>
      )}

      {error && (
        <p role="alert" className="mt-3 text-sm text-rose-600">
          {error}
        </p>
      )}

      <button
        type="button"
        onClick={() => void save()}
        disabled={busy}
        className="mt-4 flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-emerald-600 text-sm font-semibold text-white transition active:scale-[0.99] disabled:bg-gray-200 disabled:text-gray-400"
      >
        {busy && <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />}
        {saved && !busy && <Check className="h-4 w-4" aria-hidden="true" />}
        {busy ? "Guardando..." : saved ? "Guardado" : "Guardar tienda"}
      </button>
    </article>
  )
}
