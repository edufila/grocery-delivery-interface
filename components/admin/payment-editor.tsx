"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Check, Loader2 } from "lucide-react"

import { sePuedeOfrecer, type MetodoPago } from "@/lib/pagos"
import { createClient } from "@/lib/supabase/client"

/**
 * A dónde paga el cliente. Vive en la base y no en el código para poder
 * cambiarlo sin desplegar, y para que un número de cuenta no quede escrito en
 * el repositorio.
 */
export function PaymentEditor({
  metodos,
  tasaVes,
}: {
  metodos: MetodoPago[]
  /** Sin tasa cargada, los métodos que cobran en bolívares no se pueden ofrecer. */
  tasaVes: number | null
}) {
  const router = useRouter()
  const [filas, setFilas] = useState(metodos)
  const [busyId, setBusyId] = useState<string | null>(null)
  const [savedId, setSavedId] = useState<string | null>(null)
  const [error, setError] = useState("")

  function edit(id: string, patch: Partial<MetodoPago>) {
    setFilas((prev) => prev.map((m) => (m.id === id ? { ...m, ...patch } : m)))
    setSavedId(null)
  }

  async function save(metodo: MetodoPago) {
    setBusyId(metodo.id)
    setError("")

    const { error: saveError } = await createClient()
      .from("payment_methods")
      .update({
        instructions: metodo.instructions?.trim() || null,
        active: metodo.active,
      })
      .eq("id", metodo.id)

    setBusyId(null)
    if (saveError) {
      setError(
        saveError.message.includes("does not exist")
          ? "Falta correr la migración de pagos en Supabase."
          : "No pudimos guardar. ¿Tu rol sigue siendo admin o dev?",
      )
      return
    }
    setSavedId(metodo.id)
    router.refresh()
  }

  if (filas.length === 0) {
    return (
      <p className="text-sm leading-relaxed text-gray-500">
        No hay métodos cargados. Falta correr la migración de pagos en Supabase.
      </p>
    )
  }

  return (
    <div className="flex flex-col gap-2">
      {error && (
        <p role="alert" className="text-sm text-rose-600">
          {error}
        </p>
      )}

      {filas.map((metodo) => {
        const seOfrece = sePuedeOfrecer(metodo, tasaVes)
        const faltaTasa = metodo.active && metodo.currency === "VES" && !(tasaVes && tasaVes > 0)
        const faltanDatos =
          metodo.active &&
          metodo.needs_reference &&
          !seOfrece &&
          !faltaTasa &&
          !(metodo.instructions ?? "").trim()

        return (
          <article key={metodo.id} className="rounded-2xl border border-gray-200 bg-white p-3">
            <div className="flex items-center gap-3">
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold text-gray-900">{metodo.label}</p>
                <p className="text-xs text-gray-500">
                  {seOfrece ? "Se está ofreciendo" : "No se ofrece"}
                  {metodo.hint ? ` · ${metodo.hint}` : ""}
                </p>
              </div>

              <label className="flex min-h-11 items-center gap-2 text-sm text-gray-600">
                <input
                  type="checkbox"
                  checked={metodo.active}
                  onChange={(event) => edit(metodo.id, { active: event.target.checked })}
                  className="h-4 w-4 accent-emerald-600"
                />
                Activo
              </label>

              <button
                type="button"
                onClick={() => void save(metodo)}
                disabled={busyId === metodo.id}
                className="flex h-11 shrink-0 items-center justify-center gap-1.5 rounded-xl bg-emerald-600 px-4 text-sm font-semibold text-white disabled:bg-gray-200 disabled:text-gray-400"
              >
                {busyId === metodo.id ? (
                  <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                ) : savedId === metodo.id ? (
                  <Check className="h-4 w-4" aria-hidden="true" />
                ) : null}
                {savedId === metodo.id ? "Listo" : "Guardar"}
              </button>
            </div>

            {metodo.needs_reference ? (
              <>
                <label
                  htmlFor={`pago-${metodo.id}`}
                  className="mt-3 block text-sm font-medium text-gray-700"
                >
                  A dónde pagar
                </label>
                <textarea
                  id={`pago-${metodo.id}`}
                  value={metodo.instructions ?? ""}
                  onChange={(event) => edit(metodo.id, { instructions: event.target.value })}
                  rows={3}
                  placeholder={
                    metodo.id === "pago-movil"
                      ? "Banco de Venezuela — 0102\n0414-1234567\nC.I. 12.345.678"
                      : "Los datos que el cliente necesita para pagarte"
                  }
                  className="mt-1.5 w-full rounded-xl border border-gray-200 bg-white px-3 py-2.5 text-base leading-relaxed text-gray-900 outline-none transition placeholder:text-gray-400 focus:border-emerald-500"
                />
                <p className="mt-1 text-xs leading-relaxed text-gray-500">
                  Esto lo ve el cliente tal cual, con los saltos de línea. Sin datos, el método no
                  se le ofrece aunque esté activo.
                </p>
              </>
            ) : (
              <p className="mt-2 text-xs leading-relaxed text-gray-500">
                Se paga en la puerta, así que no hace falta cargar nada ni pedir referencia.
              </p>
            )}

            {faltanDatos && (
              <p className="mt-2 rounded-xl bg-amber-50 px-3 py-2 text-sm leading-relaxed text-amber-800">
                Está activo pero sin datos, así que no aparece en el checkout. Carga a dónde pagar
                para que se ofrezca.
              </p>
            )}

            {faltaTasa && (
              <p className="mt-2 rounded-xl bg-amber-50 px-3 py-2 text-sm leading-relaxed text-amber-800">
                Cobra en bolívares y no hay tasa del día cargada, así que no aparece en el
                checkout: no habría con qué decirle al cliente cuántos bolívares pagar. Se carga
                más abajo, en Tarifas.
              </p>
            )}
          </article>
        )
      })}
    </div>
  )
}
