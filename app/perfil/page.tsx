import type { Metadata } from "next"
import Link from "next/link"
import { redirect } from "next/navigation"
import { ChevronRight, LogOut, Mail, PackageSearch, SlidersHorizontal } from "lucide-react"

import { BottomNav } from "@/components/bottom-nav"
import { AddressManager } from "@/components/profile/address-manager"
import { ProfileForm } from "@/components/profile/profile-form"
import { SHOPPER_ROLES, type Address, type Role } from "@/lib/orders"
import { isProfileComplete, type Profile } from "@/lib/profile"
import { isSupabaseConfigured } from "@/lib/supabase/config"
import { createClient } from "@/lib/supabase/server"

export const metadata: Metadata = {
  title: "Perfil · Gran Abasto Girasol",
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

  // El proxy ya redirige, pero no confiamos solo en él para datos de sesión.
  if (!user) redirect("/login?next=/perfil")

  // Si la migración todavía no corrió, `error` viene con la tabla faltante:
  // el formulario lo avisa en vez de romper la página.
  const { data: profile } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", user.id)
    .maybeSingle<Profile & { role?: Role }>()

  const esShopper = !!profile?.role && SHOPPER_ROLES.includes(profile.role)
  const esAdmin = profile?.role === "admin" || profile?.role === "dev"

  const { data: addresses } = await supabase
    .from("addresses")
    .select("id, label, detail, is_default, lat, lng")
    .eq("user_id", user.id)
    .order("is_default", { ascending: false })
    .order("created_at", { ascending: true })
    .returns<Address[]>()

  const displayName = profile?.full_name || user.email || "Mi cuenta"
  const avatarUrl = user.user_metadata?.avatar_url as string | undefined

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
            {user.email && (
              <p className="mt-0.5 flex items-center gap-1.5 text-sm text-gray-500">
                <Mail className="h-4 w-4 shrink-0 text-gray-400" aria-hidden="true" />
                <span className="truncate">{user.email}</span>
              </p>
            )}
          </div>
        </section>

        {!isProfileComplete(profile) && (
          <p className="mt-4 rounded-2xl bg-amber-50 px-4 py-3 text-sm leading-relaxed text-amber-800">
            Completá tu nombre y teléfono para que el shopper pueda ubicarte con tu pedido.
          </p>
        )}

        <section className="mt-4 rounded-3xl border border-gray-100 bg-white p-5 shadow-sm shadow-gray-100">
          <h2 className="mb-4 text-base font-semibold text-gray-900">Tus datos</h2>
          <ProfileForm
            userId={user.id}
            profile={profile}
            nameLocked={profile?.role === "shopper"}
          />
        </section>

        <section className="mt-4 rounded-3xl border border-gray-100 bg-white p-5 shadow-sm shadow-gray-100">
          <h2 className="mb-4 text-base font-semibold text-gray-900">Direcciones de entrega</h2>
          <AddressManager userId={user.id} addresses={addresses ?? []} />
        </section>

        {esAdmin && (
          <Link
            href="/admin"
            className="mt-4 flex items-center gap-3 rounded-3xl bg-gray-900 p-5 transition active:scale-[0.99]"
          >
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-white/10">
              <SlidersHorizontal className="h-5 w-5 text-white" aria-hidden="true" />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block text-sm font-semibold text-white">Administración</span>
              <span className="block text-sm text-gray-400">
                Tiendas, precios, tarifas y pedidos
              </span>
            </span>
            <ChevronRight className="h-5 w-5 shrink-0 text-gray-500" aria-hidden="true" />
          </Link>
        )}

        {esShopper && (
          <Link
            href="/shopper"
            className="mt-4 flex items-center gap-3 rounded-3xl border border-emerald-100 bg-emerald-50 p-5 transition active:scale-[0.99]"
          >
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-white">
              <PackageSearch className="h-5 w-5 text-emerald-600" aria-hidden="true" />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block text-sm font-semibold text-emerald-900">
                Panel del shopper
              </span>
              <span className="block text-sm text-emerald-800">
                Pedidos para preparar y entregar
              </span>
            </span>
            <ChevronRight className="h-5 w-5 shrink-0 text-emerald-600" aria-hidden="true" />
          </Link>
        )}

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

      <BottomNav />
    </main>
  )
}
