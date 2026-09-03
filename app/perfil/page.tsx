import type { Metadata } from "next"
import { redirect } from "next/navigation"
import { LogOut, Mail, Phone } from "lucide-react"

import { BottomNav } from "@/components/bottom-nav"
import { isSupabaseConfigured } from "@/lib/supabase/config"
import { createClient } from "@/lib/supabase/server"

export const metadata: Metadata = {
  title: "Perfil · Gran Abasto Girasol",
}

/** "584141234567" -> "+58 414 123 4567" */
function formatPhone(raw: string) {
  const local = raw.replace(/\D/g, "").replace(/^58/, "")
  if (local.length !== 10) return `+${raw.replace(/\D/g, "")}`
  return `+58 ${local.slice(0, 3)} ${local.slice(3, 6)} ${local.slice(6)}`
}

function initialsFrom(name: string) {
  const parts = name.trim().split(/\s+/).slice(0, 2)
  return parts.map((part) => part[0]?.toUpperCase() ?? "").join("") || "?"
}

export default async function PerfilPage() {
  if (!isSupabaseConfigured) redirect("/login")

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  // El middleware ya redirige, pero no confiamos solo en él para datos de sesión.
  if (!user) redirect("/login?next=/perfil")

  const fullName =
    (user.user_metadata?.full_name as string | undefined) ??
    (user.user_metadata?.name as string | undefined) ??
    ""
  const avatarUrl = user.user_metadata?.avatar_url as string | undefined
  const displayName = fullName || (user.phone ? formatPhone(user.phone) : user.email) || "Mi cuenta"

  return (
    <main className="min-h-dvh bg-gray-50">
      <header className="border-b border-gray-100 bg-white">
        <div className="mx-auto max-w-md px-4 py-4">
          <h1 className="text-lg font-semibold text-gray-900">Perfil</h1>
        </div>
      </header>

      <div className="mx-auto max-w-md px-4 pb-28 pt-6">
        <section className="flex items-center gap-4 rounded-3xl border border-gray-100 bg-white p-5 shadow-sm shadow-gray-100">
          {avatarUrl ? (
            <img
              src={avatarUrl}
              alt=""
              className="h-16 w-16 shrink-0 rounded-full object-cover"
            />
          ) : (
            <span className="flex h-16 w-16 shrink-0 items-center justify-center rounded-full bg-emerald-50 text-xl font-semibold text-emerald-700">
              {initialsFrom(displayName)}
            </span>
          )}
          <div className="min-w-0">
            <p className="truncate text-base font-semibold text-gray-900">{displayName}</p>
            <p className="mt-0.5 text-sm text-gray-500">Sesión iniciada</p>
          </div>
        </section>

        <section className="mt-4 overflow-hidden rounded-3xl border border-gray-100 bg-white shadow-sm shadow-gray-100">
          <h2 className="sr-only">Datos de contacto</h2>
          {user.phone && (
            <div className="flex items-center gap-3 border-b border-gray-50 px-5 py-4 last:border-b-0">
              <Phone className="h-5 w-5 shrink-0 text-gray-400" aria-hidden="true" />
              <div className="min-w-0">
                <p className="text-xs font-medium uppercase tracking-wide text-gray-400">Teléfono</p>
                <p className="truncate text-sm font-medium text-gray-900">{formatPhone(user.phone)}</p>
              </div>
            </div>
          )}
          {user.email && (
            <div className="flex items-center gap-3 px-5 py-4">
              <Mail className="h-5 w-5 shrink-0 text-gray-400" aria-hidden="true" />
              <div className="min-w-0">
                <p className="text-xs font-medium uppercase tracking-wide text-gray-400">Email</p>
                <p className="truncate text-sm font-medium text-gray-900">{user.email}</p>
              </div>
            </div>
          )}
        </section>

        <form action="/auth/sign-out" method="post" className="mt-6">
          <button
            type="submit"
            className="flex h-14 w-full items-center justify-center gap-2 rounded-2xl border border-gray-200 bg-white text-base font-semibold text-rose-600 transition active:scale-[0.99]"
          >
            <LogOut className="h-5 w-5" aria-hidden="true" />
            Cerrar sesión
          </button>
        </form>
      </div>

      <BottomNav initialActive="Perfil" />
    </main>
  )
}
