import type { Metadata } from "next"
import Link from "next/link"
import { redirect } from "next/navigation"
import { ArrowLeft } from "lucide-react"

import { OrdersCleanup } from "@/components/admin/orders-cleanup"
import { ProductEditor } from "@/components/admin/product-editor"
import { SettingsEditor } from "@/components/admin/settings-editor"
import { StoreEditor } from "@/components/admin/store-editor"
import type { AdminProduct, Settings, Store } from "@/lib/admin"
import type { Order, Role } from "@/lib/orders"
import { isSupabaseConfigured } from "@/lib/supabase/config"
import { createClient } from "@/lib/supabase/server"

export const metadata: Metadata = {
  title: "Administración · Gran Abasto Girasol",
}

const ADMIN_ROLES: Role[] = ["admin", "dev"]

export default async function AdminPage() {
  if (!isSupabaseConfigured) redirect("/login")

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) redirect("/login?next=/admin")

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .maybeSingle<{ role: Role }>()

  if (!profile || !ADMIN_ROLES.includes(profile.role)) {
    return (
      <main className="flex min-h-dvh items-center bg-gray-50">
        <div className="mx-auto w-full max-w-md px-5 text-center">
          <h1 className="text-xl font-semibold text-gray-900">Zona de administración</h1>
          <p className="mt-3 text-sm leading-relaxed text-gray-600">
            Tu cuenta figura como <span className="font-semibold">{profile?.role ?? "cliente"}</span>.
            Hace falta admin o dev.
          </p>
          <Link
            href="/"
            className="mt-6 flex h-14 w-full items-center justify-center rounded-2xl bg-emerald-600 text-base font-semibold text-white"
          >
            Ir al inicio
          </Link>
        </div>
      </main>
    )
  }

  const [{ data: stores }, { data: products }, { data: settings }, { data: orders }] =
    await Promise.all([
      supabase.from("stores").select("*").order("sort_order").returns<Store[]>(),
      supabase.from("products").select("*").order("name").returns<AdminProduct[]>(),
      supabase.from("settings").select("*").eq("id", "global").maybeSingle<Settings>(),
      supabase
        .from("orders")
        .select("id, code, status, total, created_at, address_label, shopper_id")
        .order("created_at", { ascending: false })
        .limit(100)
        .returns<
          Pick<
            Order,
            "id" | "code" | "status" | "total" | "created_at" | "address_label" | "shopper_id"
          >[]
        >(),
    ])

  return (
    <main className="min-h-dvh bg-gray-50">
      <header className="border-b border-gray-100 bg-white">
        <div className="mx-auto flex max-w-3xl items-center gap-2 px-4 py-4">
          <Link
            href="/perfil"
            aria-label="Volver al perfil"
            className="-ml-2 flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-gray-600 active:bg-gray-100"
          >
            <ArrowLeft className="h-5 w-5" aria-hidden="true" />
          </Link>
          <div>
            <h1 className="text-lg font-semibold text-gray-900">Administración</h1>
            <p className="text-sm text-gray-500">Entrás como {profile.role}</p>
          </div>
        </div>
      </header>

      <div className="mx-auto flex max-w-3xl flex-col gap-8 px-4 pb-16 pt-6">
        <Section
          title="Tiendas"
          hint="Lo que se ve en el inicio, y el punto al que se le traza la ruta al shopper."
        >
          <div className="flex flex-col gap-3">
            {(stores ?? []).map((store) => (
              <StoreEditor key={store.id} store={store} />
            ))}
          </div>
        </Section>

        <Section
          title="Productos"
          hint="Precio y disponibilidad. Dar de alta productos nuevos sigue siendo por SQL: van veinte de una."
        >
          <ProductEditor products={products ?? []} />
        </Section>

        <Section title="Tarifas" hint="Se aplican a los pedidos nuevos.">
          {settings ? (
            <SettingsEditor settings={settings} />
          ) : (
            <p className="text-sm text-gray-500">Falta correr la migración de ajustes.</p>
          )}
        </Section>

        <Section
          title="Pedidos"
          hint="Para limpiar los de prueba. Se borra el pedido con sus productos y su código."
        >
          <OrdersCleanup orders={orders ?? []} />
        </Section>
      </div>
    </main>
  )
}

function Section({
  title,
  hint,
  children,
}: {
  title: string
  hint: string
  children: React.ReactNode
}) {
  return (
    <section>
      <h2 className="text-base font-semibold text-gray-900">{title}</h2>
      <p className="mb-3 mt-0.5 text-sm leading-relaxed text-gray-500">{hint}</p>
      {children}
    </section>
  )
}
