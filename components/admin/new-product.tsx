"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Loader2, Plus } from "lucide-react"

import { ImagePicker } from "@/components/admin/image-picker"
import { categories } from "@/lib/categories"
import { slugify } from "@/lib/slug"
import { createClient } from "@/lib/supabase/client"

export function NewProduct({
  stores,
  label = "Agregar producto",
}: {
  stores: { id: string; name: string }[]
  label?: string
}) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [storeId, setStoreId] = useState(stores[0]?.id ?? "girasol")
  const [name, setName] = useState("")
  const [unit, setUnit] = useState("")
  const [price, setPrice] = useState("")
  const [category, setCategory] = useState<string>("Granos")
  const [image, setImage] = useState("")
  const [wholesale, setWholesale] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState("")

  // El id lleva la tienda adelante: el mismo producto puede existir en dos
  // locales con precios distintos, y sin el prefijo el segundo chocaría.
  const id = name.trim() ? `${storeId}-${slugify(name)}` : ""
  const canSave =
    name.trim().length >= 3 && unit.trim().length >= 2 && Number(price) > 0 && !!image && !busy

  async function save(event: React.FormEvent) {
    event.preventDefault()
    if (!canSave) return

    setBusy(true)
    setError("")

    const { error: saveError } = await createClient().from("products").insert({
      id,
      store_id: storeId,
      name: name.trim(),
      unit: unit.trim(),
      price: Number(price),
      category,
      image,
      wholesale,
      active: true,
    })

    setBusy(false)

    if (saveError) {
      setError(
        saveError.code === "23505"
          ? `Ya existe un producto con el identificador "${id}". Cambiale el nombre.`
          : "No pudimos crearlo. ¿Tu rol sigue siendo admin o dev?",
      )
      return
    }

    setName("")
    setUnit("")
    setPrice("")
    setImage("")
    setWholesale(false)
    setOpen(false)
    router.refresh()
  }

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="flex h-12 w-full items-center justify-center gap-2 rounded-2xl border border-dashed border-gray-300 text-sm font-semibold text-gray-600 active:bg-gray-50"
      >
        <Plus className="h-4 w-4" aria-hidden="true" />
        {label}
      </button>
    )
  }

  return (
    <form onSubmit={save} className="rounded-2xl border border-gray-200 bg-white p-4">
      <h3 className="text-sm font-semibold text-gray-900">Producto nuevo</h3>

      <div className="mt-3 grid gap-3 sm:grid-cols-2">
        {/* Con una sola tienda el selector sobra: ya está decidida por dónde
            se está agregando. */}
        {stores.length > 1 && (
          <label className="block sm:col-span-2">
            <span className="block text-sm font-medium text-gray-700">Tienda</span>
            <select
              value={storeId}
              onChange={(event) => setStoreId(event.target.value)}
              className="mt-1 h-12 w-full rounded-xl border border-gray-200 bg-white px-3 text-base text-gray-900 outline-none focus:border-emerald-500"
            >
              {stores.map((store) => (
                <option key={store.id} value={store.id}>
                  {store.name}
                </option>
              ))}
            </select>
          </label>
        )}

        <label className="block sm:col-span-2">
          <span className="block text-sm font-medium text-gray-700">Nombre</span>
          <input
            value={name}
            onChange={(event) => setName(event.target.value)}
            placeholder="Harina de Maíz PAN"
            className="mt-1 h-12 w-full rounded-xl border border-gray-200 bg-white px-3 text-base text-gray-900 outline-none placeholder:text-gray-400 focus:border-emerald-500"
          />
          {id && <span className="mt-1 block font-mono text-xs text-gray-400">{id}</span>}
        </label>

        <label className="block">
          <span className="block text-sm font-medium text-gray-700">Presentación</span>
          <input
            value={unit}
            onChange={(event) => setUnit(event.target.value)}
            placeholder="Unidad · 1 kg"
            className="mt-1 h-12 w-full rounded-xl border border-gray-200 bg-white px-3 text-base text-gray-900 outline-none placeholder:text-gray-400 focus:border-emerald-500"
          />
        </label>

        <label className="block">
          <span className="block text-sm font-medium text-gray-700">Precio ($)</span>
          <input
            type="number"
            step="0.01"
            min="0"
            value={price}
            onChange={(event) => setPrice(event.target.value)}
            placeholder="1.85"
            className="mt-1 h-12 w-full rounded-xl border border-gray-200 bg-white px-3 text-base tabular-nums text-gray-900 outline-none placeholder:text-gray-400 focus:border-emerald-500"
          />
        </label>

        <label className="block">
          <span className="block text-sm font-medium text-gray-700">Categoría</span>
          <select
            value={category}
            onChange={(event) => setCategory(event.target.value)}
            className="mt-1 h-12 w-full rounded-xl border border-gray-200 bg-white px-3 text-base text-gray-900 outline-none focus:border-emerald-500"
          >
            {categories
              .filter((c) => c !== "Todos")
              .map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
          </select>
        </label>

        <label className="flex items-center gap-2 sm:mt-7">
          <input
            type="checkbox"
            checked={wholesale}
            onChange={(event) => setWholesale(event.target.checked)}
            className="h-4 w-4 accent-emerald-600"
          />
          <span className="text-sm text-gray-600">Es al mayor</span>
        </label>
      </div>

      <div className="mt-3">
        <span className="block text-sm font-medium text-gray-700">Foto</span>
        <div className="mt-1">
          <ImagePicker folder="productos" value={image} onChange={setImage} />
        </div>
      </div>

      {error && (
        <p role="alert" className="mt-3 text-sm text-rose-600">
          {error}
        </p>
      )}

      <div className="mt-4 flex gap-2">
        <button
          type="submit"
          disabled={!canSave}
          className="flex h-12 flex-1 items-center justify-center gap-2 rounded-xl bg-emerald-600 text-sm font-semibold text-white disabled:bg-gray-200 disabled:text-gray-400"
        >
          {busy && <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />}
          Crear producto
        </button>
        <button
          type="button"
          onClick={() => {
            setOpen(false)
            setError("")
          }}
          className="h-12 rounded-xl border border-gray-200 px-4 text-sm font-semibold text-gray-600"
        >
          Cancelar
        </button>
      </div>
    </form>
  )
}
