"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Check, ChevronDown, Loader2, MapPin } from "lucide-react"

import { ImagePicker } from "@/components/admin/image-picker"
import { UseMyLocation, type Coords } from "@/components/profile/use-my-location"
import { STORE_TEXT_FIELDS, type Store } from "@/lib/admin"
import { createClient } from "@/lib/supabase/client"
import { leerMonto } from "@/lib/pagos"
import { estadoHorario, horaParaCampo } from "@/lib/horario"

export function StoreEditor({ store }: { store: Store }) {
  const router = useRouter()
  const [draft, setDraft] = useState<Store>(store)
  const [envioTexto, setEnvioTexto] = useState(String(store.delivery_fee))
  const [abre, setAbre] = useState(horaParaCampo(store.abre))
  const [cierra, setCierra] = useState(horaParaCampo(store.cierra))
  // Una sola de las dos no sirve: la base lo toma como abierto siempre.
  const horarioIncompleto = (abre === "") !== (cierra === "")
  const [coords, setCoords] = useState<Coords>(
    store.lat != null && store.lng != null ? { lat: store.lat, lng: store.lng } : null,
  )
  const [showMap, setShowMap] = useState(false)
  const [open, setOpen] = useState(false)
  const [busy, setBusy] = useState(false)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState("")

  async function save() {
    setBusy(true)
    setError("")
    setSaved(false)

    if (horarioIncompleto) {
      setBusy(false)
      setError("Pon la hora a la que abre y la hora a la que cierra, o deja las dos vacías.")
      return
    }

    const supabase = createClient()
    const valores = {
      name: draft.name,
      tag: draft.tag,
      eta: draft.eta,
      image: draft.image,
      delivery_fee: draft.delivery_fee,
      active: draft.active,
      lat: coords?.lat ?? null,
      lng: coords?.lng ?? null,
    }

    let { error: saveError } = await supabase
      .from("stores")
      .update({ ...valores, abre: abre || null, cierra: cierra || null })
      .eq("id", store.id)

    // Sin la 0049 las columnas del horario no existen y PostgREST rechaza todo:
    // se guarda lo demás y se avisa.
    let sinHorario = false
    if (saveError && /abre|cierra/.test(saveError.message)) {
      sinHorario = true
      ;({ error: saveError } = await supabase.from("stores").update(valores).eq("id", store.id))
    }

    setBusy(false)
    if (saveError) {
      setError("No pudimos guardar. ¿Tu rol sigue siendo admin o dev?")
      return
    }
    if (sinHorario) setError("Se guardó todo menos el horario: falta correr la migración 0049.")
    setSaved(true)
    router.refresh()
  }

  return (
    <article className="overflow-hidden rounded-2xl border border-gray-200 bg-white">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="flex w-full items-center gap-3 p-4 text-left active:bg-gray-50"
      >
        {draft.image && (
          <img
            src={draft.image}
            alt=""
            className="h-11 w-11 shrink-0 rounded-lg bg-gray-100 object-cover"
          />
        )}
        <span className="min-w-0 flex-1">
          <span className="block truncate text-sm font-semibold text-gray-900">{draft.name}</span>
          <span className="flex items-center gap-2 text-xs text-gray-500">
            <span className="font-mono">{store.id}</span>
            <span aria-hidden="true">·</span>
            <span className="tabular-nums">${Number(draft.delivery_fee).toFixed(2)}</span>
            {!coords && <span className="text-amber-600">sin ubicar</span>}
            {!draft.active && <span className="text-gray-500">oculta</span>}
            {store.abre && store.cierra && (
              <span className="tabular-nums">
                {horaParaCampo(store.abre)}–{horaParaCampo(store.cierra)}
              </span>
            )}
          </span>
        </span>
        <ChevronDown
          className={`h-5 w-5 shrink-0 text-gray-400 transition-transform ${open ? "rotate-180" : ""}`}
          aria-hidden="true"
        />
      </button>

      {!open ? null : (
        <div className="border-t border-gray-100 p-4">
      <label className="flex items-center gap-2 text-sm text-gray-600">
        <input
          type="checkbox"
          checked={draft.active}
          onChange={(event) => setDraft({ ...draft, active: event.target.checked })}
          className="h-4 w-4 accent-emerald-600"
        />
        Visible en el inicio
      </label>

      <div className="mt-3">
        <span className="block text-sm font-medium text-gray-700">Foto</span>
        <div className="mt-1">
          <ImagePicker
            folder="tiendas"
            value={draft.image ?? ""}
            onChange={(image) => setDraft({ ...draft, image })}
          />
        </div>
      </div>

      <div className="mt-3 grid gap-3 sm:grid-cols-2">
        {STORE_TEXT_FIELDS.filter((field) => field.key !== "image").map((field) => (
          <label key={field.key} className="block">
            <span className="block text-sm font-medium text-gray-700">{field.label}</span>
            <input
              value={(draft[field.key] as string | null) ?? ""}
              onChange={(event) => setDraft({ ...draft, [field.key]: event.target.value })}
              placeholder={"hint" in field ? field.hint : undefined}
              className="mt-1 h-12 w-full rounded-xl border border-gray-200 bg-white px-3 text-base text-gray-900 outline-none placeholder:text-gray-500 focus:border-emerald-500"
            />
          </label>
        ))}

        <label className="block">
          <span className="block text-sm font-medium text-gray-700">Costo de envío ($)</span>
          <input
            // Texto y no number, para aceptar coma. Se guarda el número leído;
            // lo que no se entiende queda en 0 como antes, que es envío gratis.
            inputMode="decimal"
            value={envioTexto}
            onChange={(event) => {
              setEnvioTexto(event.target.value)
              setDraft({ ...draft, delivery_fee: leerMonto(event.target.value) ?? 0 })
            }}
            className="mt-1 h-12 w-full rounded-xl border border-gray-200 bg-white px-3 text-base tabular-nums text-gray-900 outline-none focus:border-emerald-500"
          />
        </label>
      </div>

      <fieldset className="mt-4">
        <legend className="text-sm font-medium text-gray-700">Horario (hora de Venezuela)</legend>
        <p className="text-xs text-gray-500">
          Fuera de este horario no se puede pedir. Vacío = abierto siempre.
        </p>
        <div className="mt-2 grid grid-cols-2 gap-3">
          <label className="block">
            <span className="block text-xs text-gray-600">Abre</span>
            <input
              id={`abre-${store.id}`}
              type="time"
              value={abre}
              onChange={(event) => setAbre(event.target.value)}
              className="mt-1 h-12 w-full rounded-xl border border-gray-200 bg-white px-3 text-base tabular-nums text-gray-900 outline-none focus:border-emerald-500"
            />
          </label>
          <label className="block">
            <span className="block text-xs text-gray-600">Cierra</span>
            <input
              id={`cierra-${store.id}`}
              type="time"
              value={cierra}
              onChange={(event) => setCierra(event.target.value)}
              className="mt-1 h-12 w-full rounded-xl border border-gray-200 bg-white px-3 text-base tabular-nums text-gray-900 outline-none focus:border-emerald-500"
            />
          </label>
        </div>
        {horarioIncompleto ? (
          <p className="mt-1.5 text-xs text-amber-800">Falta la otra hora.</p>
        ) : (
          abre &&
          cierra && (
            <p className="mt-1.5 text-xs text-gray-600">
              Ahora mismo: {estadoHorario(abre, cierra).texto}
              {abre > cierra && " · cruza la medianoche"}
            </p>
          )
        )}
      </fieldset>

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
        className="mt-4 flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-emerald-600 text-sm font-semibold text-white transition active:scale-[0.99] disabled:bg-gray-200 disabled:text-gray-600"
      >
        {busy && <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />}
        {saved && !busy && <Check className="h-4 w-4" aria-hidden="true" />}
        {busy ? "Guardando..." : saved ? "Guardado" : "Guardar tienda"}
      </button>
        </div>
      )}
    </article>
  )
}
