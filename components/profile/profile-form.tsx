"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Check, Loader2 } from "lucide-react"

import { createClient } from "@/lib/supabase/client"
import type { Profile } from "@/lib/profile"

type Props = {
  userId: string
  profile: Profile | null
}

/** El más viejo razonable y el más joven admitido, para acotar el date picker. */
const MIN_BIRTH_DATE = "1920-01-01"
const MAX_BIRTH_DATE = new Date(Date.now() - 1000 * 60 * 60 * 24 * 365 * 13)
  .toISOString()
  .slice(0, 10)

export function ProfileForm({ userId, profile }: Props) {
  const router = useRouter()
  const supabase = createClient()

  const [fullName, setFullName] = useState(profile?.full_name ?? "")
  const [birthDate, setBirthDate] = useState(profile?.birth_date ?? "")
  const [phone, setPhone] = useState(profile?.phone ?? "")
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState("")

  const nameOk = fullName.trim().length >= 2
  const phoneDigits = phone.replace(/\D/g, "")
  const phoneOk = phoneDigits.length === 0 || phoneDigits.length >= 10
  const canSave = nameOk && phoneOk && !saving

  async function save(event: React.FormEvent) {
    event.preventDefault()
    if (!canSave) return

    setSaving(true)
    setError("")
    setSaved(false)

    const { error: saveError } = await supabase.from("profiles").upsert({
      id: userId,
      full_name: fullName.trim(),
      birth_date: birthDate || null,
      phone: phone.trim() || null,
    })

    setSaving(false)

    if (saveError) {
      setError(
        saveError.message.includes("relation") || saveError.message.includes("does not exist")
          ? "La tabla de perfiles todavía no existe en Supabase. Falta correr la migración."
          : "No pudimos guardar los cambios. Intentá de nuevo.",
      )
      return
    }

    setSaved(true)
    router.refresh()
  }

  return (
    <form onSubmit={save} className="space-y-4">
      <div>
        <label htmlFor="full_name" className="block text-sm font-medium text-gray-700">
          Nombre completo
        </label>
        <input
          id="full_name"
          value={fullName}
          onChange={(event) => {
            setFullName(event.target.value)
            setSaved(false)
          }}
          autoComplete="name"
          enterKeyHint="next"
          placeholder="María González"
          className="mt-2 h-14 w-full rounded-2xl border border-gray-200 bg-white px-4 text-base text-gray-900 outline-none transition placeholder:text-gray-400 focus:border-emerald-500 focus:ring-4 focus:ring-emerald-500/10"
        />
      </div>

      <div>
        <label htmlFor="birth_date" className="block text-sm font-medium text-gray-700">
          Fecha de nacimiento
        </label>
        <input
          id="birth_date"
          type="date"
          value={birthDate}
          min={MIN_BIRTH_DATE}
          max={MAX_BIRTH_DATE}
          onChange={(event) => {
            setBirthDate(event.target.value)
            setSaved(false)
          }}
          autoComplete="bday"
          className="mt-2 h-14 w-full rounded-2xl border border-gray-200 bg-white px-4 text-base text-gray-900 outline-none transition focus:border-emerald-500 focus:ring-4 focus:ring-emerald-500/10"
        />
      </div>

      <div>
        <label htmlFor="phone" className="block text-sm font-medium text-gray-700">
          Teléfono
        </label>
        <input
          id="phone"
          type="tel"
          inputMode="numeric"
          value={phone}
          onChange={(event) => {
            setPhone(event.target.value)
            setSaved(false)
          }}
          autoComplete="tel"
          enterKeyHint="done"
          placeholder="0414 123 4567"
          className="mt-2 h-14 w-full rounded-2xl border border-gray-200 bg-white px-4 text-base text-gray-900 outline-none transition placeholder:text-gray-400 focus:border-emerald-500 focus:ring-4 focus:ring-emerald-500/10"
        />
        {!phoneOk && (
          <p className="mt-2 text-sm text-rose-600">El teléfono parece incompleto.</p>
        )}
      </div>

      {error && (
        <p role="alert" className="text-sm text-rose-600">
          {error}
        </p>
      )}

      <button
        type="submit"
        disabled={!canSave}
        className="flex h-14 w-full items-center justify-center gap-2 rounded-2xl bg-emerald-600 text-base font-semibold text-white transition active:scale-[0.99] disabled:bg-gray-200 disabled:text-gray-400"
      >
        {saving && <Loader2 className="h-5 w-5 animate-spin" aria-hidden="true" />}
        {saved && !saving && <Check className="h-5 w-5" aria-hidden="true" />}
        {saving ? "Guardando..." : saved ? "Guardado" : "Guardar cambios"}
      </button>

      <p role="status" className="sr-only">
        {saved ? "Cambios guardados" : ""}
      </p>
    </form>
  )
}
