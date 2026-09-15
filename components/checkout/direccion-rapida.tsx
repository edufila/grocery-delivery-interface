"use client"

import { useState } from "react"
import { Loader2, MapPin } from "lucide-react"

import { UseMyLocation, type Coords } from "@/components/profile/use-my-location"
import type { Address } from "@/lib/orders"
import { createClient } from "@/lib/supabase/client"

/**
 * Cargar la dirección sin salir del carrito.
 *
 * Antes, quien llegaba al carrito sin dirección -- todo cliente nuevo, en su
 * primer pedido -- tenía que ir a Perfil, cargarla y volver. Es el peor momento
 * para mandar a alguien a otra pantalla: ya decidió comprar, y cada salto es
 * una oportunidad de dejarlo para después.
 *
 * Sirve para los dos casos que traban el pedido: no tener dirección, o tener
 * una sin el punto en el mapa. En el segundo solo pide el punto.
 */
export function DireccionRapida({
  userId,
  sinPunto,
  onLista,
}: {
  userId: string
  /** Si ya hay una dirección y solo le falta el punto, se completa esa. */
  sinPunto?: Address | null
  onLista: (address: Address) => void
}) {
  const [label, setLabel] = useState(sinPunto?.label ?? "Casa")
  const [detail, setDetail] = useState(sinPunto?.detail ?? "")
  const [coords, setCoords] = useState<Coords>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState("")

  // El pin es obligatorio: aquí la gente no maneja nombres de calles, y sin el
  // punto en el mapa el shopper no tiene a dónde ir.
  const puedeGuardar = label.trim().length >= 2 && detail.trim().length >= 5 && !!coords && !busy

  async function guardar() {
    if (!puedeGuardar || !coords) return
    setBusy(true)
    setError("")
    const supabase = createClient()

    const valores = {
      label: label.trim(),
      detail: detail.trim(),
      lat: coords.lat,
      lng: coords.lng,
    }

    const respuesta = sinPunto
      ? await supabase
          .from("addresses")
          .update(valores)
          .eq("id", sinPunto.id)
          .select("id, label, detail, is_default, lat, lng")
          .single<Address>()
      : await (async () => {
          // La nueva queda como principal: es a donde se va a llevar este pedido.
          await supabase.from("addresses").update({ is_default: false }).eq("user_id", userId)
          return supabase
            .from("addresses")
            .insert({ ...valores, user_id: userId, is_default: true })
            .select("id, label, detail, is_default, lat, lng")
            .single<Address>()
        })()

    setBusy(false)
    if (respuesta.error || !respuesta.data) {
      setError("No pudimos guardar la dirección. Prueba de nuevo.")
      return
    }
    onLista(respuesta.data)
  }

  return (
    <section className="rounded-2xl border border-amber-200 bg-amber-50 p-4">
      <h2 className="flex items-center gap-2 text-sm font-semibold text-amber-900">
        <MapPin className="h-4 w-4" aria-hidden="true" />
        {sinPunto ? `Marca dónde queda "${sinPunto.label}"` : "¿A dónde te lo llevamos?"}
      </h2>
      <p className="mt-1 text-sm leading-relaxed text-amber-800">
        {sinPunto
          ? "Falta el punto en el mapa: sin él, el shopper no tiene a dónde ir."
          : "Se guarda para tus próximos pedidos."}
      </p>

      <div className="mt-3 flex flex-col gap-2">
        {!sinPunto && (
          <>
            <label className="sr-only" htmlFor="dir-nombre">
              Nombre de la dirección
            </label>
            <input
              id="dir-nombre"
              value={label}
              onChange={(event) => setLabel(event.target.value)}
              placeholder="Casa, Trabajo..."
              className="h-12 w-full rounded-xl border border-gray-200 bg-white px-3 text-base text-gray-900 outline-none placeholder:text-gray-500 focus:border-emerald-500"
            />
            <label className="sr-only" htmlFor="dir-detalle">
              Dirección
            </label>
            <input
              id="dir-detalle"
              value={detail}
              onChange={(event) => setDetail(event.target.value)}
              placeholder="Urb. La Zaragoza, calle 3, casa 12"
              autoComplete="street-address"
              className="h-12 w-full rounded-xl border border-gray-200 bg-white px-3 text-base text-gray-900 outline-none placeholder:text-gray-500 focus:border-emerald-500"
            />
          </>
        )}

        <div className="rounded-xl bg-white p-2">
          <UseMyLocation coords={coords} onCapture={setCoords} />
        </div>

        {error && (
          <p role="alert" className="text-sm text-rose-700">
            {error}
          </p>
        )}

        <button
          type="button"
          onClick={() => void guardar()}
          disabled={!puedeGuardar}
          className="flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-emerald-600 text-sm font-semibold text-white transition active:scale-[0.99] disabled:bg-gray-200 disabled:text-gray-600"
        >
          {busy && <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />}
          {!coords ? "Marca el punto en el mapa" : "Guardar y seguir"}
        </button>
      </div>
    </section>
  )
}
