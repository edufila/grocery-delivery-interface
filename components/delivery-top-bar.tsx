"use client"

import Link from "next/link"
import { useEffect, useState } from "react"
import { Check, ChevronDown, MapPin, X } from "lucide-react"

const ADDRESS_KEY = "direccion-entrega"

const ADDRESSES = [
  { id: "casa", label: "Casa", detail: "Av. Las Delicias, Urb. El Bosque" },
  { id: "trabajo", label: "Trabajo", detail: "C.C. Sambil, Nivel Feria, Local 12" },
  { id: "mama", label: "Casa de mamá", detail: "Calle 5 con Av. Bolívar, Qta. Alba" },
]

export function DeliveryTopBar() {
  const [open, setOpen] = useState(false)
  const [selected, setSelected] = useState(ADDRESSES[0])

  useEffect(() => {
    try {
      const stored = localStorage.getItem(ADDRESS_KEY)
      const found = ADDRESSES.find((a) => a.id === stored)
      if (found) setSelected(found)
    } catch {
      // Storage bloqueado: se queda la dirección por defecto.
    }
  }, [])

  // Con la hoja abierta, el fondo no debe scrollear.
  useEffect(() => {
    if (!open) return
    const previous = document.body.style.overflow
    document.body.style.overflow = "hidden"
    return () => {
      document.body.style.overflow = previous
    }
  }, [open])

  useEffect(() => {
    if (!open) return
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false)
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [open])

  const choose = (address: (typeof ADDRESSES)[number]) => {
    setSelected(address)
    setOpen(false)
    try {
      localStorage.setItem(ADDRESS_KEY, address.id)
    } catch {
      // Si no se puede guardar, al menos vale para esta sesión.
    }
  }

  return (
    <>
      <header className="sticky top-0 z-30 border-b border-gray-100 bg-white/90 backdrop-blur-md">
        <div className="mx-auto flex max-w-md items-center justify-between px-4 py-3">
          <button
            type="button"
            onClick={() => setOpen(true)}
            className="flex min-w-0 items-center gap-2 text-left"
            aria-label="Cambiar dirección de entrega"
            aria-expanded={open}
          >
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-emerald-50">
              <MapPin className="h-4 w-4 text-emerald-600" aria-hidden="true" />
            </span>
            <span className="min-w-0">
              <span className="block text-[11px] font-medium uppercase tracking-wide text-gray-400">
                Entregar en
              </span>
              <span className="flex items-center gap-1 text-sm font-semibold text-gray-900">
                <span className="truncate">{selected.detail}</span>
                <ChevronDown className="h-4 w-4 shrink-0 text-gray-500" aria-hidden="true" />
              </span>
            </span>
          </button>
          <Link
            href="/perfil"
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-gray-100 text-sm font-semibold text-gray-700"
            aria-label="Perfil"
          >
            JD
          </Link>
        </div>
      </header>

      {open && (
        <div className="fixed inset-0 z-50 flex items-end" role="dialog" aria-modal="true" aria-label="Elegir dirección">
          <button
            type="button"
            className="absolute inset-0 bg-black/40"
            onClick={() => setOpen(false)}
            aria-label="Cerrar"
          />
          <div className="relative w-full rounded-t-3xl bg-white pb-[calc(env(safe-area-inset-bottom)+1rem)] pt-2">
            <div className="mx-auto h-1 w-10 rounded-full bg-gray-200" aria-hidden="true" />
            <div className="mx-auto flex max-w-md items-center justify-between px-5 pb-2 pt-4">
              <h2 className="text-base font-semibold text-gray-900">Entregar en</h2>
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="-mr-2 flex h-11 w-11 items-center justify-center rounded-full text-gray-500 active:bg-gray-100"
                aria-label="Cerrar"
              >
                <X className="h-5 w-5" aria-hidden="true" />
              </button>
            </div>

            <ul className="mx-auto max-w-md px-5 pb-2">
              {ADDRESSES.map((address) => {
                const isSelected = address.id === selected.id
                return (
                  <li key={address.id}>
                    <button
                      type="button"
                      onClick={() => choose(address)}
                      className="flex w-full items-center gap-3 rounded-2xl px-2 py-3 text-left active:bg-gray-50"
                    >
                      <span
                        className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full ${
                          isSelected ? "bg-emerald-50" : "bg-gray-100"
                        }`}
                      >
                        <MapPin
                          className={`h-5 w-5 ${isSelected ? "text-emerald-600" : "text-gray-400"}`}
                          aria-hidden="true"
                        />
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block text-sm font-semibold text-gray-900">
                          {address.label}
                        </span>
                        <span className="block truncate text-sm text-gray-500">
                          {address.detail}
                        </span>
                      </span>
                      {isSelected && (
                        <Check className="h-5 w-5 shrink-0 text-emerald-600" aria-hidden="true" />
                      )}
                    </button>
                  </li>
                )
              })}
            </ul>
          </div>
        </div>
      )}
    </>
  )
}
