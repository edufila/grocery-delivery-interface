"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Check, Loader2 } from "lucide-react"

import type { Settings } from "@/lib/admin"
import { createClient } from "@/lib/supabase/client"

export function SettingsEditor({ settings }: { settings: Settings }) {
  const router = useRouter()
  const [serviceFee, setServiceFee] = useState(settings.service_fee)
  const [tasa, setTasa] = useState(settings.rate_ves ?? 0)
  const [busy, setBusy] = useState(false)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState("")

  async function save() {
    setBusy(true)
    setError("")
    setSaved(false)

    const { error: saveError } = await createClient()
      .from("settings")
      .update({ service_fee: serviceFee, rate_ves: tasa > 0 ? tasa : null })
      .eq("id", "global")

    setBusy(false)
    if (saveError) {
      setError("No pudimos guardar. ¿Tu rol sigue siendo admin o dev?")
      return
    }
    setSaved(true)
    router.refresh()
  }

  return (
    <div className="rounded-2xl border border-gray-200 bg-white p-4">
      <label className="block">
        <span className="block text-sm font-medium text-gray-700">Tarifa de servicio ($)</span>
        <input
          type="number"
          step="0.01"
          min="0"
          value={serviceFee}
          onChange={(event) => {
            setServiceFee(Number(event.target.value) || 0)
            setSaved(false)
          }}
          className="mt-1 h-12 w-full rounded-xl border border-gray-200 bg-white px-3 text-base tabular-nums text-gray-900 outline-none focus:border-emerald-500 sm:w-48"
        />
      </label>

      <p className="mt-2 text-xs leading-relaxed text-gray-500">
        Se aplica a los pedidos nuevos. Los ya hechos guardaron la tarifa que regía en su momento.
      </p>

      {/* Sin esto no se puede cobrar por pago móvil: los precios están en
          dólares y la transferencia llega en bolívares. Cada pedido congela la
          tasa con la que se cotizó, así que subirla no le cambia el monto a
          quien ya pidió. */}
      <label className="mt-5 block border-t border-gray-100 pt-4">
        <span className="block text-sm font-medium text-gray-700">
          Tasa del día (Bs. por dólar)
        </span>
        <input
          type="number"
          step="0.0001"
          min="0"
          value={tasa || ""}
          onChange={(event) => {
            setTasa(Number(event.target.value) || 0)
            setSaved(false)
          }}
          placeholder="Sin cargar"
          className="mt-1 h-12 w-full rounded-xl border border-gray-200 bg-white px-3 text-base tabular-nums text-gray-900 outline-none placeholder:text-gray-400 focus:border-emerald-500 sm:w-48"
        />
      </label>

      <p className="mt-2 text-xs leading-relaxed text-gray-500">
        De qué fuente la sacas es decisión tuya. Sin tasa cargada, el pago móvil no se le ofrece
        al cliente: no habría con qué decirle cuántos bolívares pagar.
      </p>

      {tasa > 0 && (
        <p className="mt-2 text-xs leading-relaxed text-gray-500">
          Un pedido de $10 se cotizaría en{" "}
          <span className="font-semibold tabular-nums text-gray-700">
            Bs. {(10 * tasa).toLocaleString("es-VE", { minimumFractionDigits: 2 })}
          </span>
          .
        </p>
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
        className="mt-4 flex h-12 items-center justify-center gap-2 rounded-xl bg-emerald-600 px-6 text-sm font-semibold text-white transition active:scale-[0.99] disabled:bg-gray-200 disabled:text-gray-400"
      >
        {busy && <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />}
        {saved && !busy && <Check className="h-4 w-4" aria-hidden="true" />}
        {busy ? "Guardando..." : saved ? "Guardado" : "Guardar"}
      </button>
    </div>
  )
}
