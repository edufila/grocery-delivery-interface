"use client"

import Link from "next/link"
import { useCallback, useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { Check, ChevronDown, Loader2, MapPin, Plus, X } from "lucide-react"

import { ProfileAvatar } from "@/components/profile/profile-avatar"
import type { Address } from "@/lib/orders"
import { createClient } from "@/lib/supabase/client"
import { isSupabaseConfigured } from "@/lib/supabase/config"

export function DeliveryTopBar() {
  const router = useRouter()

  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(true)
  const [userId, setUserId] = useState<string | null>(null)
  const [addresses, setAddresses] = useState<Address[]>([])
  const [busy, setBusy] = useState(false)

  const [adding, setAdding] = useState(false)
  const [label, setLabel] = useState("")
  const [detail, setDetail] = useState("")
  const [error, setError] = useState("")

  const load = useCallback(async () => {
    if (!isSupabaseConfigured) {
      setLoading(false)
      return
    }

    const supabase = createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      setUserId(null)
      setAddresses([])
      setLoading(false)
      return
    }

    const { data } = await supabase
      .from("addresses")
      .select("id, label, detail, is_default")
      .eq("user_id", user.id)
      .order("is_default", { ascending: false })
      .order("created_at", { ascending: true })
      .returns<Address[]>()

    setUserId(user.id)
    setAddresses(data ?? [])
    setLoading(false)
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  // Con la hoja abierta, el fondo no debe scrollear.
  useEffect(() => {
    if (!open) return
    const previous = document.body.style.overflow
    document.body.style.overflow = "hidden"
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false)
    }
    window.addEventListener("keydown", onKey)
    return () => {
      document.body.style.overflow = previous
      window.removeEventListener("keydown", onKey)
    }
  }, [open])

  const selected = addresses.find((a) => a.is_default) ?? addresses[0] ?? null

  async function choose(address: Address) {
    if (!userId || address.is_default) {
      setOpen(false)
      return
    }
    setBusy(true)
    const supabase = createClient()
    // Hay un índice único de una sola principal: primero bajamos la actual.
    await supabase.from("addresses").update({ is_default: false }).eq("user_id", userId)
    await supabase.from("addresses").update({ is_default: true }).eq("id", address.id)
    await load()
    setBusy(false)
    setOpen(false)
    router.refresh()
  }

  async function addAddress(event: React.FormEvent) {
    event.preventDefault()
    if (!userId || label.trim().length < 2 || detail.trim().length < 5 || busy) return

    setBusy(true)
    setError("")
    const supabase = createClient()

    // La nueva queda como principal: si la estás agregando acá, es a dónde querés que llegue.
    await supabase.from("addresses").update({ is_default: false }).eq("user_id", userId)
    const { error: insertError } = await supabase.from("addresses").insert({
      user_id: userId,
      label: label.trim(),
      detail: detail.trim(),
      is_default: true,
    })

    if (insertError) {
      setBusy(false)
      setError("No pudimos guardar la dirección.")
      return
    }

    setLabel("")
    setDetail("")
    setAdding(false)
    await load()
    setBusy(false)
    router.refresh()
  }

  const buttonLabel = loading
    ? "Cargando..."
    : selected
      ? selected.detail
      : userId
        ? "Agregá tu dirección"
        : "Entrá para elegir dirección"

  return (
    <>
      <header className="border-b border-gray-100 bg-white/90 backdrop-blur-md">
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
                <span className="truncate">{buttonLabel}</span>
                <ChevronDown className="h-4 w-4 shrink-0 text-gray-500" aria-hidden="true" />
              </span>
            </span>
          </button>
          <ProfileAvatar />
        </div>
      </header>

      {open && (
        <div
          className="fixed inset-0 z-50 flex items-end"
          role="dialog"
          aria-modal="true"
          aria-label="Elegir dirección"
        >
          <button
            type="button"
            className="absolute inset-0 bg-black/40"
            onClick={() => setOpen(false)}
            aria-label="Cerrar"
          />

          {/* max-h + overflow en la lista: con muchas direcciones la hoja
              scrollea sola en vez de crecer fuera de la pantalla. */}
          <div className="relative flex max-h-[85dvh] w-full flex-col rounded-t-3xl bg-white pt-2">
            <div className="mx-auto h-1 w-10 shrink-0 rounded-full bg-gray-200" aria-hidden="true" />

            <div className="mx-auto flex w-full max-w-md shrink-0 items-center justify-between px-5 pb-2 pt-4">
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

            <div className="flex-1 overflow-y-auto overscroll-contain px-5 pb-[calc(env(safe-area-inset-bottom)+1.25rem)]">
              <div className="mx-auto w-full max-w-md">
                {!userId && !loading ? (
                  <div className="py-4">
                    <p className="text-sm leading-relaxed text-gray-500">
                      Entrá a tu cuenta para guardar tus direcciones y que te lleguen los pedidos.
                    </p>
                    <Link
                      href="/login"
                      className="mt-4 flex h-12 w-full items-center justify-center rounded-2xl bg-emerald-600 text-sm font-semibold text-white"
                    >
                      Iniciar sesión
                    </Link>
                  </div>
                ) : (
                  <>
                    {addresses.length === 0 && !loading && !adding && (
                      <p className="py-3 text-sm leading-relaxed text-gray-500">
                        Todavía no cargaste ninguna dirección.
                      </p>
                    )}

                    <ul className="flex flex-col">
                      {addresses.map((address) => {
                        const isSelected = selected?.id === address.id
                        return (
                          <li key={address.id}>
                            <button
                              type="button"
                              onClick={() => void choose(address)}
                              disabled={busy}
                              className="flex w-full items-center gap-3 rounded-2xl px-2 py-3 text-left active:bg-gray-50 disabled:opacity-60"
                            >
                              <span
                                className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full ${
                                  isSelected ? "bg-emerald-50" : "bg-gray-100"
                                }`}
                              >
                                <MapPin
                                  className={`h-5 w-5 ${
                                    isSelected ? "text-emerald-600" : "text-gray-400"
                                  }`}
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
                                <Check
                                  className="h-5 w-5 shrink-0 text-emerald-600"
                                  aria-hidden="true"
                                />
                              )}
                            </button>
                          </li>
                        )
                      })}
                    </ul>

                    {adding ? (
                      <form onSubmit={addAddress} className="mt-2 flex flex-col gap-3">
                        <input
                          value={label}
                          onChange={(event) => setLabel(event.target.value)}
                          placeholder="Nombre: Casa, Trabajo..."
                          aria-label="Nombre de la dirección"
                          className="h-12 w-full rounded-xl border border-gray-200 bg-white px-3 text-base text-gray-900 outline-none placeholder:text-gray-400 focus:border-emerald-500"
                        />
                        <input
                          value={detail}
                          onChange={(event) => setDetail(event.target.value)}
                          placeholder="Av. Las Delicias, Urb. El Bosque"
                          aria-label="Dirección"
                          className="h-12 w-full rounded-xl border border-gray-200 bg-white px-3 text-base text-gray-900 outline-none placeholder:text-gray-400 focus:border-emerald-500"
                        />
                        {error && (
                          <p role="alert" className="text-sm text-rose-600">
                            {error}
                          </p>
                        )}
                        <div className="flex gap-2">
                          <button
                            type="submit"
                            disabled={busy || label.trim().length < 2 || detail.trim().length < 5}
                            className="flex h-12 flex-1 items-center justify-center gap-2 rounded-xl bg-emerald-600 text-sm font-semibold text-white disabled:bg-gray-200 disabled:text-gray-400"
                          >
                            {busy && <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />}
                            Guardar y usar
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              setAdding(false)
                              setError("")
                            }}
                            className="h-12 rounded-xl border border-gray-200 px-4 text-sm font-semibold text-gray-600"
                          >
                            Cancelar
                          </button>
                        </div>
                      </form>
                    ) : (
                      <button
                        type="button"
                        onClick={() => setAdding(true)}
                        className="mt-2 flex h-12 w-full items-center justify-center gap-2 rounded-2xl border border-dashed border-gray-300 text-sm font-semibold text-gray-600 active:bg-gray-50"
                      >
                        <Plus className="h-4 w-4" aria-hidden="true" />
                        Agregar dirección
                      </button>
                    )}
                  </>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
