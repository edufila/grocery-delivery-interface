"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Check, Loader2 } from "lucide-react"

import type { Settings } from "@/lib/admin"
import { formatOrderDate } from "@/lib/orders"
import { leerMonto } from "@/lib/pagos"
import { enlaceWhatsApp } from "@/lib/profile"
import { createClient } from "@/lib/supabase/client"

export function SettingsEditor({ settings }: { settings: Settings }) {
  const router = useRouter()
  const [serviceFee, setServiceFee] = useState(settings.service_fee)
  const [servicioTexto, setServicioTexto] = useState(String(settings.service_fee))
  // Como texto y no como número: así se puede escribir "832,49", que es como
  // se lee la tasa aquí. Con type="number" la coma no entraba.
  const [tasaTexto, setTasaTexto] = useState(
    settings.rate_ves ? String(settings.rate_ves).replace(".", ",") : "",
  )
  const [soporte, setSoporte] = useState(settings.soporte_whatsapp ?? "")
  const [busy, setBusy] = useState(false)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState("")

  const tasaNueva = tasaTexto.trim() ? leerMonto(tasaTexto) : null
  const tasaParaMostrar = tasaNueva ?? settings.rate_ves ?? 0

  async function save() {
    if (tasaTexto.trim() && tasaNueva == null) {
      setError("No entendimos la tasa. Escríbela como 832,49.")
      return
    }

    /**
     * La tasa se escribe solo si cambió.
     *
     * Antes, guardar la tarifa de servicio volvía a guardar también la tasa,
     * marcada "a mano" y con la hora de ese momento, aunque nadie la hubiera
     * tocado. Una tasa de hace cuatro días quedaba con cara de recién puesta, y
     * la alerta de tasa vieja (0041) dejaba de sonar justo cuando hacía falta.
     * Y con el campo vacío la borraba, y el Pago Móvil desaparecía para todos.
     *
     * Vaciar el campo ahora no borra nada: la deja como estaba.
     */
    const soporteEnlace = enlaceWhatsApp(soporte)
    if (soporte.trim() && !soporteEnlace) {
      setError("El WhatsApp de soporte no parece un número venezolano. Escríbelo como 0414-123.45.67.")
      return
    }
    // Se guarda como lo pide wa.me: 584141234567.
    const soporteDigitos = soporteEnlace ? soporteEnlace.replace("https://wa.me/", "") : null
    const cambioSoporte = soporteDigitos !== (settings.soporte_whatsapp ?? null)

    const cambioTasa = tasaNueva != null && tasaNueva !== Number(settings.rate_ves ?? 0)

    // El mismo freno que la corrida automática: un salto de más del doble casi
    // siempre es un dedo de más o de menos, no la economía.
    const anterior = Number(settings.rate_ves ?? 0)
    if (cambioTasa && anterior > 0 && (tasaNueva! > anterior * 2 || tasaNueva! < anterior / 2)) {
      setError(
        `Eso es más del doble o menos de la mitad de la tasa actual (Bs. ${anterior.toLocaleString("es-VE", { minimumFractionDigits: 2 })}). Revísala.`,
      )
      return
    }

    setBusy(true)
    setError("")
    setSaved(false)

    // Escribirla a mano queda marcada como tal: la corrida automática la va a
    // pisar de nuevo mañana, pero hasta entonces manda esta.
    const { error: saveError } = await createClient()
      .from("settings")
      .update({
        service_fee: serviceFee,
        ...(cambioTasa
          ? {
              rate_ves: tasaNueva,
              rate_ves_updated_at: new Date().toISOString(),
              rate_ves_source: "manual",
            }
          : {}),
      })
      .eq("id", "global")

    // Aparte: sin la 0050 la columna no existe y no debe tumbar lo demás.
    let errorSoporte = false
    if (!saveError && cambioSoporte) {
      const { error } = await createClient()
        .from("settings")
        .update({ soporte_whatsapp: soporteDigitos })
        .eq("id", "global")
      errorSoporte = !!error
    }

    setBusy(false)
    if (saveError) {
      setError("No pudimos guardar. ¿Tu rol sigue siendo admin o dev?")
      return
    }
    if (errorSoporte) {
      setError("Se guardó lo demás, pero no el WhatsApp de soporte: falta correr la migración 0050.")
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
          inputMode="decimal"
          value={servicioTexto}
          onChange={(event) => {
            setServicioTexto(event.target.value)
            setServiceFee(leerMonto(event.target.value) ?? 0)
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
          inputMode="decimal"
          value={tasaTexto}
          onChange={(event) => {
            setTasaTexto(event.target.value)
            setSaved(false)
            if (error) setError("")
          }}
          placeholder="Sin cargar"
          className="mt-1 h-12 w-full rounded-xl border border-gray-200 bg-white px-3 text-base tabular-nums text-gray-900 outline-none placeholder:text-gray-500 focus:border-emerald-500 sm:w-48"
        />
      </label>

      <p className="mt-2 text-xs leading-relaxed text-gray-500">
        Se revisa sola cada hora contra la tasa oficial del BCV, y entra el mismo día en que rige.
        Si escribes un número aquí, ese manda durante 12 horas; después la automática lo pisa. Sin tasa cargada, el
        pago móvil no se le ofrece al cliente: no habría con qué decirle cuántos bolívares pagar.
      </p>

      {settings.rate_ves_updated_at && (
        <p className="mt-1 text-xs leading-relaxed text-gray-500">
          Cargada {settings.rate_ves_source === "manual" ? "a mano" : "por el BCV"} el{" "}
          {formatOrderDate(settings.rate_ves_updated_at)}.
        </p>
      )}

      {tasaParaMostrar > 0 && (
        <p className="mt-2 text-xs leading-relaxed text-gray-500">
          Un pedido de $10 se cotizaría en{" "}
          <span className="font-semibold tabular-nums text-gray-700">
            Bs. {(10 * tasaParaMostrar).toLocaleString("es-VE", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </span>
          .
        </p>
      )}

      <label className="mt-5 block border-t border-gray-100 pt-4">
        <span className="block text-sm font-medium text-gray-700">WhatsApp de soporte</span>
        <input
          id="soporte-whatsapp"
          type="tel"
          inputMode="tel"
          autoComplete="off"
          value={soporte}
          onChange={(event) => {
            setSoporte(event.target.value)
            setSaved(false)
            if (error) setError("")
          }}
          placeholder="0414-123.45.67"
          className="mt-1 h-12 w-full rounded-xl border border-gray-200 bg-white px-3 text-base tabular-nums text-gray-900 outline-none placeholder:text-gray-500 focus:border-emerald-500 sm:w-48"
        />
      </label>
      <p className="mt-2 text-xs leading-relaxed text-gray-500">
        A dónde escribe un cliente con un problema, o para pedir que borren sus datos. Sale en
        Perfil, en el seguimiento del pedido y en Términos. Vacío, no sale en ningún lado.
      </p>

      {error && (
        <p role="alert" className="mt-3 text-sm text-rose-600">
          {error}
        </p>
      )}

      <button
        type="button"
        onClick={() => void save()}
        disabled={busy}
        className="mt-4 flex h-12 items-center justify-center gap-2 rounded-xl bg-emerald-600 px-6 text-sm font-semibold text-white transition active:scale-[0.99] disabled:bg-gray-200 disabled:text-gray-600"
      >
        {busy && <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />}
        {saved && !busy && <Check className="h-4 w-4" aria-hidden="true" />}
        {busy ? "Guardando..." : saved ? "Guardado" : "Guardar"}
      </button>
    </div>
  )
}
