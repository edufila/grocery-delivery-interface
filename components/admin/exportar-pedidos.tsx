"use client"

import { useState } from "react"
import { Download, Loader2 } from "lucide-react"

import { pedidosACsv, type PedidoExportable } from "@/lib/exportar"
import { diaEnVenezuela } from "@/lib/orders"
import { lunesEnVenezuela } from "@/lib/semana"
import { createClient } from "@/lib/supabase/client"

type Rango = "semana" | "mes" | "90"

const RANGOS: { id: Rango; nombre: string }[] = [
  { id: "semana", nombre: "Esta semana" },
  { id: "mes", nombre: "Este mes" },
  { id: "90", nombre: "Últimos 90 días" },
]

/** Desde cuándo, en hora de Venezuela. */
function desdeDe(rango: Rango, ahora = new Date()): Date {
  if (rango === "semana") return lunesEnVenezuela(ahora)
  if (rango === "mes") {
    const [anio, mes] = diaEnVenezuela(ahora).split("-")
    return new Date(`${anio}-${mes}-01T00:00:00-04:00`)
  }
  return new Date(ahora.getTime() - 90 * 24 * 60 * 60 * 1000)
}

/**
 * Descargar los pedidos en una hoja de cálculo.
 *
 * El panel muestra los últimos cien; para cerrar la semana o el mes, o para
 * cuadrar con el banco, hacía falta todo el período. Se pide al tocar, no al
 * abrir el panel: casi nunca se usa y serían miles de filas en cada visita.
 */
export function ExportarPedidos({ nombresAbasto }: { nombresAbasto: Record<string, string> }) {
  const [rango, setRango] = useState<Rango>("mes")
  const [busy, setBusy] = useState(false)
  const [mensaje, setMensaje] = useState("")

  async function descargar() {
    setBusy(true)
    setMensaje("")
    const desde = desdeDe(rango)

    const { data, error } = await createClient()
      .from("orders")
      .select("*")
      .gte("created_at", desde.toISOString())
      .order("created_at", { ascending: true })
      .limit(10000)
      .returns<PedidoExportable[]>()

    setBusy(false)
    if (error) {
      setMensaje("No pudimos traer los pedidos. Revisa tu conexión y vuelve a intentar.")
      return
    }
    if (!data?.length) {
      setMensaje("No hay pedidos en ese período.")
      return
    }

    // La marca BOM al principio: sin ella Excel lee los acentos como basura.
    const blob = new Blob(["﻿" + pedidosACsv(data, nombresAbasto)], { type: "text/csv;charset=utf-8" })
    const url = URL.createObjectURL(blob)
    const enlace = document.createElement("a")
    enlace.href = url
    enlace.download = `pedidos-${rango}-${diaEnVenezuela(new Date())}.csv`
    document.body.appendChild(enlace)
    enlace.click()
    enlace.remove()
    setTimeout(() => URL.revokeObjectURL(url), 1000)

    setMensaje(`${data.length} ${data.length === 1 ? "pedido descargado" : "pedidos descargados"}.`)
  }

  return (
    <div className="rounded-2xl border border-gray-200 bg-white p-4">
      <fieldset>
        <legend className="text-sm font-medium text-gray-700">Período</legend>
        <div className="mt-2 flex flex-wrap gap-2">
          {RANGOS.map(({ id, nombre }) => (
            <label
              key={id}
              className={`flex min-h-11 cursor-pointer items-center rounded-full border px-4 text-sm font-medium has-[:focus-visible]:outline has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-emerald-600 ${
                rango === id
                  ? "border-emerald-600 bg-emerald-50 text-emerald-800"
                  : "border-gray-200 bg-white text-gray-700"
              }`}
            >
              <input
                type="radio"
                name="rango-exportar"
                value={id}
                checked={rango === id}
                onChange={() => setRango(id)}
                className="sr-only"
              />
              {nombre}
            </label>
          ))}
        </div>
      </fieldset>

      <button
        type="button"
        onClick={() => void descargar()}
        disabled={busy}
        className="mt-4 flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-emerald-600 text-sm font-semibold text-white transition active:scale-[0.99] disabled:bg-gray-200 disabled:text-gray-600 sm:w-auto sm:px-6"
      >
        {busy ? (
          <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
        ) : (
          <Download className="h-4 w-4" aria-hidden="true" />
        )}
        Descargar para Excel
      </button>

      {mensaje && (
        <p role="status" className="mt-2 text-sm text-gray-600">
          {mensaje}
        </p>
      )}
    </div>
  )
}
