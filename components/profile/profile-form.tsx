"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Check, Loader2 } from "lucide-react"

import { createClient } from "@/lib/supabase/client"
import type { Profile } from "@/lib/profile"

type Props = {
  userId: string
  profile: Profile | null
  /** El nombre del shopper lo asigna la empresa: la base rechaza el cambio. */
  nameLocked?: boolean
}

const MESES = [
  "Enero",
  "Febrero",
  "Marzo",
  "Abril",
  "Mayo",
  "Junio",
  "Julio",
  "Agosto",
  "Septiembre",
  "Octubre",
  "Noviembre",
  "Diciembre",
]

const AÑO_MAXIMO = new Date().getFullYear() - 13
const AÑOS = Array.from({ length: AÑO_MAXIMO - 1920 + 1 }, (_, i) => AÑO_MAXIMO - i)
const DIAS = Array.from({ length: 31 }, (_, i) => i + 1)

const pad = (value: string) => value.padStart(2, "0")

/** Descarta combinaciones como 31 de febrero, que el calendario corre a marzo. */
function isRealDate(year: string, month: string, day: string) {
  const d = new Date(`${year}-${pad(month)}-${pad(day)}T00:00:00`)
  return (
    d.getFullYear() === Number(year) &&
    d.getMonth() + 1 === Number(month) &&
    d.getDate() === Number(day)
  )
}

export function ProfileForm({ userId, profile, nameLocked = false }: Props) {
  const router = useRouter()
  const supabase = createClient()

  const [year0, month0, day0] = (profile?.birth_date ?? "").split("-")

  const [fullName, setFullName] = useState(profile?.full_name ?? "")
  const [day, setDay] = useState(day0 ? String(Number(day0)) : "")
  const [month, setMonth] = useState(month0 ? String(Number(month0)) : "")
  const [year, setYear] = useState(year0 ?? "")
  const [phone, setPhone] = useState(profile?.phone ?? "")
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState("")

  const nameOk = fullName.trim().length >= 2
  const phoneDigits = phone.replace(/\D/g, "")
  const phoneOk = phoneDigits.length === 0 || phoneDigits.length >= 10

  const dateParts = [day, month, year]
  const dateEmpty = dateParts.every((p) => !p)
  const dateFilled = dateParts.every(Boolean)
  const dateOk = dateEmpty || (dateFilled && isRealDate(year, month, day))
  const birthDate = dateFilled && dateOk ? `${year}-${pad(month)}-${pad(day)}` : ""

  const canSave = nameOk && phoneOk && dateOk && !saving

  const onDateChange = (setter: (v: string) => void) => (value: string) => {
    setter(value)
    setSaved(false)
  }

  const selectClass =
    "h-14 w-full rounded-2xl border border-gray-200 bg-white px-3 text-base text-gray-900 outline-none transition focus:border-emerald-500 focus:ring-4 focus:ring-emerald-500/10"

  async function save(event: React.FormEvent) {
    event.preventDefault()
    if (!canSave) return

    setSaving(true)
    setError("")
    setSaved(false)

    // Si el nombre está bloqueado ni siquiera lo mandamos: la base lo rechaza
    // y el error se llevaría puesto el guardado del teléfono y la fecha.
    const { error: saveError } = await supabase
      .from("profiles")
      .update({
        ...(nameLocked ? {} : { full_name: fullName.trim() }),
        birth_date: birthDate || null,
        phone: phone.trim() || null,
      })
      .eq("id", userId)

    setSaving(false)

    if (saveError) {
      setError(
        saveError.message.includes("relation") || saveError.message.includes("does not exist")
          ? "La tabla de perfiles todavía no existe en Supabase. Falta correr la migración."
          : "No pudimos guardar los cambios. Intenta de nuevo.",
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
          disabled={nameLocked}
          className="mt-2 h-14 w-full rounded-2xl border border-gray-200 bg-white px-4 text-base text-gray-900 outline-none transition placeholder:text-gray-400 focus:border-emerald-500 focus:ring-4 focus:ring-emerald-500/10 disabled:bg-gray-50 disabled:text-gray-500"
        />
        {nameLocked && (
          <p className="mt-1.5 text-xs leading-relaxed text-gray-500">
            Tu nombre y tu foto los asigna el abasto: son los que ve el cliente cuando le llevas el
            pedido.
          </p>
        )}
      </div>

      <fieldset>
        <legend className="block text-sm font-medium text-gray-700">Fecha de nacimiento</legend>
        <div className="mt-2 grid grid-cols-[1fr_1.4fr_1fr] gap-2">
          <select
            value={day}
            onChange={(event) => onDateChange(setDay)(event.target.value)}
            aria-label="Día"
            className={selectClass}
          >
            <option value="">Día</option>
            {DIAS.map((d) => (
              <option key={d} value={d}>
                {d}
              </option>
            ))}
          </select>

          <select
            value={month}
            onChange={(event) => onDateChange(setMonth)(event.target.value)}
            aria-label="Mes"
            className={selectClass}
          >
            <option value="">Mes</option>
            {MESES.map((name, index) => (
              <option key={name} value={index + 1}>
                {name}
              </option>
            ))}
          </select>

          <select
            value={year}
            onChange={(event) => onDateChange(setYear)(event.target.value)}
            aria-label="Año"
            className={selectClass}
          >
            <option value="">Año</option>
            {AÑOS.map((y) => (
              <option key={y} value={y}>
                {y}
              </option>
            ))}
          </select>
        </div>
        {!dateOk && (
          <p className="mt-2 text-sm text-rose-600">
            {dateFilled ? "Esa fecha no existe." : "Completa los tres campos o déjalos vacíos."}
          </p>
        )}
      </fieldset>

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
