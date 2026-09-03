"use client"

import { useState } from "react"
import { ChevronDown } from "lucide-react"

import { NewProduct } from "@/components/admin/new-product"
import { ProductEditor } from "@/components/admin/product-editor"
import type { AdminProduct } from "@/lib/admin"

/**
 * El catálogo de un local, plegado. Con dos tiendas y treinta productos, verlo
 * todo abierto obliga a recorrer la página entera para llegar a lo de abajo.
 */
export function StoreProducts({
  store,
  products,
}: {
  store: { id: string; name: string }
  products: AdminProduct[]
}) {
  const [open, setOpen] = useState(false)
  const activos = products.filter((p) => p.active).length
  const ocultos = products.length - activos

  return (
    <div className="overflow-hidden rounded-2xl border border-gray-200 bg-white">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="flex w-full items-center gap-3 p-4 text-left active:bg-gray-50"
      >
        <span className="min-w-0 flex-1">
          <span className="block truncate text-sm font-semibold text-gray-900">{store.name}</span>
          <span className="block text-xs text-gray-500">
            {products.length === 0
              ? "Sin productos: su catálogo sale vacío"
              : `${activos} ${activos === 1 ? "activo" : "activos"}${
                  ocultos > 0 ? ` · ${ocultos} ${ocultos === 1 ? "oculto" : "ocultos"}` : ""
                }`}
          </span>
        </span>
        <ChevronDown
          className={`h-5 w-5 shrink-0 text-gray-400 transition-transform ${open ? "rotate-180" : ""}`}
          aria-hidden="true"
        />
      </button>

      {open && (
        <div className="flex flex-col gap-3 border-t border-gray-100 p-4">
          {products.length > 0 && <ProductEditor products={products} />}
          <NewProduct
            stores={[store]}
            label={`Agregar producto a ${store.name}`}
          />
        </div>
      )}
    </div>
  )
}
