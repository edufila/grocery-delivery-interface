"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Check, Loader2 } from "lucide-react"

import { ImagePicker } from "@/components/admin/image-picker"
import type { AdminProduct } from "@/lib/admin"
import { createClient } from "@/lib/supabase/client"

/**
 * Precio y disponibilidad, que es lo que cambia a diario. El alta de productos
 * nuevos sigue siendo por SQL: es más rápido cargar veinte de una que uno a uno.
 */
export function ProductEditor({ products }: { products: AdminProduct[] }) {
  const router = useRouter()
  const [rows, setRows] = useState(products)
  const [busyId, setBusyId] = useState<string | null>(null)
  const [savedId, setSavedId] = useState<string | null>(null)
  const [error, setError] = useState("")

  function edit(id: string, patch: Partial<AdminProduct>) {
    setRows((prev) => prev.map((p) => (p.id === id ? { ...p, ...patch } : p)))
    setSavedId(null)
  }

  async function save(product: AdminProduct) {
    setBusyId(product.id)
    setError("")

    const { error: saveError } = await createClient()
      .from("products")
      .update({
        price: product.price,
        active: product.active,
        in_stock: product.in_stock,
        image: product.image,
      })
      .eq("id", product.id)

    setBusyId(null)
    if (saveError) {
      setError("No pudimos guardar. ¿Tu rol sigue siendo admin o dev?")
      return
    }
    setSavedId(product.id)
    router.refresh()
  }

  return (
    <div className="flex flex-col gap-2">
      {error && (
        <p role="alert" className="text-sm text-rose-600">
          {error}
        </p>
      )}

      {rows.map((product) => (
        <article
          key={product.id}
          className={`rounded-2xl border p-3 ${
            product.active ? "border-gray-200 bg-white" : "border-gray-200 bg-gray-50"
          }`}
        >
          <div className="flex flex-wrap items-center gap-3">
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-semibold text-gray-900">{product.name}</p>
            <p className="truncate text-xs text-gray-500">{product.unit}</p>
          </div>

          <label className="flex items-center gap-1.5">
            <span className="text-sm text-gray-500">$</span>
            <input
              type="number"
              step="0.01"
              min="0"
              value={product.price}
              onChange={(event) =>
                edit(product.id, { price: Number(event.target.value) || 0 })
              }
              aria-label={`Precio de ${product.name}`}
              className="h-11 w-24 rounded-xl border border-gray-200 bg-white px-2 text-base tabular-nums text-gray-900 outline-none focus:border-emerald-500"
            />
          </label>

          {/* Dos cosas distintas, y conviene no confundirlas: "en el catálogo"
              es si el abasto lo vende; "hay existencia" es si hoy le queda.
              Antes solo estaba la primera, así que para marcar un faltante
              había que sacarlo del catálogo y acordarse de reponerlo. */}
          <label className="flex min-h-11 items-center gap-2 text-sm text-gray-600">
            <input
              type="checkbox"
              checked={product.active}
              onChange={(event) => edit(product.id, { active: event.target.checked })}
              className="h-4 w-4 accent-emerald-600"
            />
            En el catálogo
          </label>

          <label className="flex min-h-11 items-center gap-2 text-sm text-gray-600">
            <input
              type="checkbox"
              checked={product.in_stock}
              onChange={(event) => edit(product.id, { in_stock: event.target.checked })}
              className="h-4 w-4 accent-emerald-600"
            />
            Hay existencia
          </label>

          <button
            type="button"
            onClick={() => void save(product)}
            disabled={busyId === product.id}
            className="flex h-11 shrink-0 items-center justify-center gap-1.5 rounded-xl bg-emerald-600 px-4 text-sm font-semibold text-white transition active:scale-[0.99] disabled:bg-gray-200 disabled:text-gray-400"
          >
            {busyId === product.id ? (
              <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
            ) : savedId === product.id ? (
              <Check className="h-4 w-4" aria-hidden="true" />
            ) : null}
            {savedId === product.id ? "Listo" : "Guardar"}
          </button>
          </div>

          <div className="mt-2">
            <ImagePicker
              folder="productos"
              value={product.image}
              onChange={(image) => edit(product.id, { image })}
            />
          </div>
        </article>
      ))}
    </div>
  )
}
