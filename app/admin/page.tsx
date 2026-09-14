import type { Metadata } from "next"
import Link from "next/link"
import { redirect } from "next/navigation"
import { ArrowLeft } from "lucide-react"

import { OrdersCleanup } from "@/components/admin/orders-cleanup"
import { SettingsEditor } from "@/components/admin/settings-editor"
import { StoreEditor } from "@/components/admin/store-editor"
import { StoreProducts } from "@/components/admin/store-products"
import { UserManager, type AdminUser } from "@/components/admin/user-manager"
import { ConciliacionPagos } from "@/components/admin/conciliacion-pagos"
import { PaymentEditor } from "@/components/admin/payment-editor"
import { pageTitle } from "@/lib/brand"
import { fetchMetodosPago } from "@/lib/pagos"
import type { AdminProduct, Settings, Store } from "@/lib/admin"
import type { Order, Role } from "@/lib/orders"
import { isSupabaseConfigured } from "@/lib/supabase/config"
import { createClient } from "@/lib/supabase/server"

export const metadata: Metadata = {
  title: pageTitle("Administración"),
}

const ADMIN_ROLES: Role[] = ["admin", "dev"]

type PedidoAdmin = Pick<
  Order,
  | "id"
  | "code"
  | "status"
  | "total"
  | "final_total"
  | "created_at"
  | "address_label"
  | "shopper_id"
  | "payment_method"
  | "payment_reference"
  | "payment_reported_at"
  | "payment_verified_at"
  | "amount_ves"
  | "payment_required"
>

export default async function AdminPage() {
  if (!isSupabaseConfigured) redirect("/login")

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) redirect("/login?next=/admin")

  /**
   * Todo de una vez, el rol incluido.
   *
   * Antes eran tres tandas: el rol, después los métodos de pago, después lo
   * demás. Esperar el rol para pedir los datos no protege nada -- a quien no es
   * admin la RLS no le da lo ajeno, y además la página no se lo muestra --, y
   * cada tanda era un viaje entero a Supabase en la pantalla donde se abre el
   * aviso de un pago que alguien está esperando.
   */
  const [
    { data: profile },
    metodos,
    { data: stores },
    { data: products },
    { data: settings },
    { data: orders },
    { data: users },
  ] = await Promise.all([
    supabase.from("profiles").select("role").eq("id", user.id).maybeSingle<{ role: Role }>(),
    fetchMetodosPago(supabase),
    supabase.from("stores").select("*").order("sort_order").returns<Store[]>(),
    supabase.from("products").select("*").order("name").returns<AdminProduct[]>(),
    supabase.from("settings").select("*").eq("id", "global").maybeSingle<Settings>(),
    supabase
      .from("orders")
      .select(
        "id, code, status, total, final_total, created_at, address_label, shopper_id, payment_method, payment_reference, payment_reported_at, payment_verified_at, amount_ves, payment_required",
      )
      .order("created_at", { ascending: false })
      .limit(100)
      .returns<PedidoAdmin[]>(),
    supabase
      .from("profiles")
      .select("id, email, full_name, avatar_url, handle, role")
      .order("role")
      .returns<AdminUser[]>(),
  ])

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

  const porVerificar = (orders ?? []).filter(
    (o) => o.payment_reported_at != null && o.payment_verified_at == null,
  )
  const sinPagar = (orders ?? []).filter(
    (o) =>
      o.payment_required !== false &&
      o.payment_reported_at == null &&
      o.payment_verified_at == null &&
      o.status !== "cancelado" &&
      o.status !== "entregado",
  )

  return (
    <main className="min-h-dvh bg-gray-50">
      {/* Cabecera y atajos pegados juntos: así la barra de estado del teléfono
          queda cubierta por la cabecera y no hace falta repetir su margen. */}
      <div className="sticky top-0 z-20">
        <header className="pt-barra-estado border-b border-gray-100 bg-white">
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
              <p className="text-sm text-gray-500">Entras como {profile.role}</p>
            </div>
          </div>
        </header>

        {/**
         * Atajos a cada sección. La página es larga -- el catálogo entero de cada
         * abasto está en medio -- y lo que se viene a hacer casi siempre es una
         * sola cosa. El número de pagos va a la vista para saber sin bajar si hay
         * alguien esperando.
         */}
        <nav
          aria-label="Secciones"
          className="border-b border-gray-100 bg-white/95 backdrop-blur-md"
        >
          <ul className="mx-auto flex max-w-3xl gap-2 overflow-x-auto px-4 py-2 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            {[
              { id: "pagos", nombre: "Pagos", cuenta: porVerificar.length },
              { id: "pedidos", nombre: "Pedidos", cuenta: 0 },
              { id: "usuarios", nombre: "Usuarios", cuenta: 0 },
              { id: "tiendas", nombre: "Tiendas", cuenta: 0 },
              { id: "productos", nombre: "Productos", cuenta: 0 },
              { id: "tarifas", nombre: "Tarifas", cuenta: 0 },
              { id: "cobros", nombre: "Cobros", cuenta: 0 },
            ].map(({ id, nombre, cuenta }) => (
              <li key={id}>
                <a
                  href={`#${id}`}
                  className="flex min-h-11 items-center gap-1.5 whitespace-nowrap rounded-full bg-gray-100 px-4 text-sm font-medium text-gray-700 active:bg-gray-200"
                >
                  {nombre}
                  {cuenta > 0 && (
                    <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-rose-600 px-1.5 text-xs font-bold tabular-nums text-white">
                      {cuenta}
                    </span>
                  )}
                </a>
              </li>
            ))}
          </ul>
        </nav>
      </div>

      <div className="mx-auto flex max-w-3xl flex-col gap-8 px-4 pb-16 pt-6">
        {/* Lo urgente primero: es a donde lleva el aviso de un pago reportado, y
            antes quedaba sexto, debajo del catálogo entero. */}
        <Section
          id="pagos"
          title="Pagos por verificar"
          hint="La app no entra a tu banco: nadie le puso tus claves y nadie se las va a poner. El cruce entre lo que reporta el cliente y lo que registras aquí sí es automático."
        >
          <ConciliacionPagos pedidos={porVerificar} sinPagar={sinPagar} />
        </Section>

        <Section
          id="pedidos"
          title="Pedidos"
          hint="Toca uno para ver qué pidió y a quién. Las casillas son para borrar los de prueba: se va el pedido con sus productos y su código."
        >
          <OrdersCleanup orders={orders ?? []} />
        </Section>

        <Section
          id="usuarios"
          title="Usuarios"
          hint={
            profile.role === "dev"
              ? "Quién puede entrar a dónde. El @ es el nombre con el que el cliente ve a su shopper, y el shopper no lo puede cambiar."
              : "Puedes dar y quitar el rol de shopper. Los roles de admin y dev los reparte un dev."
          }
        >
          <UserManager users={users ?? []} meId={user.id} soyDev={profile.role === "dev"} />
        </Section>

        <Section
          id="tiendas"
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
          id="productos"
          title="Productos"
          hint="Cada local tiene su propio catálogo y sus propios precios. Para cargar muchos de una sigue conviniendo el SQL."
        >
          <div className="flex flex-col gap-3">
            {(stores ?? []).map((store) => (
              <StoreProducts
                key={store.id}
                store={{ id: store.id, name: store.name }}
                products={(products ?? []).filter((p) => p.store_id === store.id)}
              />
            ))}
          </div>
        </Section>

        <Section id="tarifas" title="Tarifas" hint="Se aplican a los pedidos nuevos.">
          {settings ? (
            <SettingsEditor settings={settings} />
          ) : (
            <p className="text-sm text-gray-500">Falta correr la migración de ajustes.</p>
          )}
        </Section>

        <Section
          id="cobros"
          title="Cobros"
          hint="A dónde paga el cliente. Lo ve tal cual, con los saltos de línea. Sin datos cargados, el método no se le ofrece aunque esté activo."
        >
          <PaymentEditor metodos={metodos} tasaVes={settings?.rate_ves ?? null} />
        </Section>


      </div>
    </main>
  )
}

function Section({
  id,
  title,
  hint,
  children,
}: {
  id: string
  title: string
  hint: string
  children: React.ReactNode
}) {
  // El margen deja el título a la vista debajo de la cabecera y los atajos.
  return (
    <section id={id} className="scroll-mt-[calc(env(safe-area-inset-top)+8.5rem)]">
      <h2 className="text-base font-semibold text-gray-900">{title}</h2>
      <p className="mb-3 mt-0.5 text-sm leading-relaxed text-gray-500">{hint}</p>
      {children}
    </section>
  )
}
