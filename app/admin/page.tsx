import type { Metadata } from "next"
import Link from "next/link"
import { redirect } from "next/navigation"
import { AlertTriangle, ArrowLeft } from "lucide-react"

import { ExportarPedidos } from "@/components/admin/exportar-pedidos"
import { OrdersCleanup } from "@/components/admin/orders-cleanup"
import { PagoSemanal } from "@/components/admin/pago-semanal"
import { SettingsEditor } from "@/components/admin/settings-editor"
import { StoreEditor } from "@/components/admin/store-editor"
import { StoreProducts } from "@/components/admin/store-products"
import { UserManager, type AdminUser } from "@/components/admin/user-manager"
import { ConciliacionPagos } from "@/components/admin/conciliacion-pagos"
import { PaymentEditor } from "@/components/admin/payment-editor"
import { pageTitle } from "@/lib/brand"
import { fetchMetodosPago } from "@/lib/pagos"
import type { AdminProduct, Settings, Store } from "@/lib/admin"
import { diaEnVenezuela, formatMoney, haceCuanto, type Order, type Role } from "@/lib/orders"
import { lunesEnVenezuela, resumenPorShopper, type PedidoDeSemana } from "@/lib/semana"
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
    { data: deLaSemana },
  ] = await Promise.all([
    supabase.from("profiles").select("role").eq("id", user.id).maybeSingle<{ role: Role }>(),
    fetchMetodosPago(supabase),
    supabase.from("stores").select("*").order("sort_order").returns<Store[]>(),
    supabase.from("products").select("*").order("name").returns<AdminProduct[]>(),
    supabase.from("settings").select("*").eq("id", "global").maybeSingle<Settings>(),
    supabase
      .from("orders")
      // Con * y no con la lista de columnas: así la de devoluciones (0048) llega
      // si existe y no rompe la consulta entera si todavía no se corrió.
      .select("*")
      .order("created_at", { ascending: false })
      .limit(100)
      .returns<PedidoAdmin[]>(),
    supabase
      .from("profiles")
      .select("id, email, full_name, avatar_url, handle, role")
      .order("role")
      .returns<AdminUser[]>(),
    // Aparte de los cien de arriba: una semana puede traer más, y aquí solo
    // hacen falta cinco columnas de lo entregado.
    supabase
      .from("orders")
      .select("shopper_id, status, created_at, total, final_total, delivery_fee")
      .eq("status", "entregado")
      .gte("created_at", lunesEnVenezuela(new Date()).toISOString())
      .limit(5000)
      .returns<PedidoDeSemana[]>(),
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

  /**
   * El día de hoy de un vistazo, arriba de todo.
   *
   * Sale de los últimos cien pedidos que ya se traen para las listas: no cuesta
   * otra consulta. Con más de cien pedidos en un día el número se queda corto,
   * y para ese momento hará falta contarlo en la base.
   */
  const hoy = diaEnVenezuela(new Date())
  const deHoy = (orders ?? []).filter(
    (o) => diaEnVenezuela(o.created_at) === hoy && o.status !== "cancelado",
  )
  const vendidoHoy = deHoy
    .filter((o) => o.status === "entregado")
    .reduce((suma, o) => suma + Number(o.final_total ?? o.total ?? 0), 0)
  const enCursoHoy = (orders ?? []).filter((o) =>
    ["confirmado", "preparando", "en_camino"].includes(o.status),
  ).length

  const porVerificar = (orders ?? []).filter(
    (o) => o.payment_reported_at != null && o.payment_verified_at == null && o.status !== "cancelado",
  )
  /**
   * Cancelados con un pago encima: hay que devolverlo.
   *
   * Un cliente puede cancelar mientras nadie tomó el pedido, aunque ya haya
   * pagado. Antes ese pedido salía de todas las listas -- "por verificar" es de
   * pedidos vivos -- y el dinero quedaba en la cuenta sin que nadie se acordara
   * de que no era de nadie.
   */
  const aDevolver = (orders ?? []).filter(
    (o) =>
      o.status === "cancelado" &&
      (o.payment_reported_at != null || o.payment_verified_at != null) &&
      // Viene con select("*"): antes de la 0048 la columna no existe y queda
      // undefined, que aquí cuenta como "sin devolver".
      !(o as { payment_refunded_at?: string | null }).payment_refunded_at,
  )
  /**
   * Pagados (o en efectivo) y sin shopper hace más de quince minutos.
   *
   * Es el pedido que se enfría sin que nadie lo note: el cliente ya pagó, el
   * panel de pagos está limpio, y ningún shopper lo tomó. Se cuenta desde que
   * quedó libre -- la verificación del pago si la hubo --, no desde que se pidió.
   */
  const ahora = Date.now()
  const esperandoShopper = (orders ?? [])
    .filter(
      (o) =>
        o.status === "confirmado" &&
        !o.shopper_id &&
        (o.payment_required === false || o.payment_verified_at != null),
    )
    .map((o) => ({ ...o, libreDesde: o.payment_verified_at ?? o.created_at }))
    .filter((o) => ahora - new Date(o.libreDesde).getTime() > 15 * 60 * 1000)

  const nombres = Object.fromEntries(
    (users ?? []).map((u) => [u.id, u.full_name || (u.handle ? `@${u.handle}` : u.email) || "Sin nombre"]),
  )
  const semana = resumenPorShopper(deLaSemana ?? [], lunesEnVenezuela(new Date()))
  const nombresAbasto = Object.fromEntries((stores ?? []).map((s) => [s.id, s.name]))

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
              { id: "pagos", nombre: "Pagos", cuenta: porVerificar.length + aDevolver.length },
              { id: "pedidos", nombre: "Pedidos", cuenta: 0 },
              { id: "semana", nombre: "Semana", cuenta: 0 },
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
        <section className="grid grid-cols-3 gap-2" aria-label="Resumen de hoy">
          {[
            { valor: String(deHoy.length), etiqueta: "pedidos hoy" },
            { valor: formatMoney(vendidoHoy), etiqueta: "entregado hoy" },
            { valor: String(enCursoHoy), etiqueta: "en curso" },
          ].map(({ valor, etiqueta }) => (
            <div
              key={etiqueta}
              className="rounded-2xl border border-gray-100 bg-white px-3 py-3 text-center shadow-sm shadow-gray-900/[0.06]"
            >
              <p className="text-lg font-bold tabular-nums text-gray-900">{valor}</p>
              <p className="mt-0.5 text-xs leading-tight text-gray-500">{etiqueta}</p>
            </div>
          ))}
        </section>

        {esperandoShopper.length > 0 && (
          <section
            aria-labelledby="esperando-shopper"
            className="rounded-2xl border border-amber-200 bg-amber-50 p-4"
          >
            <h2 id="esperando-shopper" className="flex items-center gap-2 text-sm font-semibold text-amber-900">
              <AlertTriangle className="h-4 w-4" aria-hidden="true" />
              {esperandoShopper.length === 1
                ? "Un pedido listo lleva rato sin shopper"
                : `${esperandoShopper.length} pedidos listos llevan rato sin shopper`}
            </h2>
            <ul className="mt-2 flex flex-col gap-1 text-sm text-amber-900">
              {esperandoShopper.map((o) => (
                <li key={o.id} className="flex justify-between gap-3">
                  <span className="font-mono">{o.code}</span>
                  <span className="tabular-nums">libre {haceCuanto(o.libreDesde)}</span>
                </li>
              ))}
            </ul>
            <p className="mt-2 text-xs leading-relaxed text-amber-800">
              Ya está pagado y ningún shopper lo tomó. Avísale a alguien del equipo.
            </p>
          </section>
        )}

        {/* Lo urgente primero: es a donde lleva el aviso de un pago reportado, y
            antes quedaba sexto, debajo del catálogo entero. */}
        <Section
          id="pagos"
          title="Pagos por verificar"
          hint="La app no entra a tu banco: nadie le puso tus claves y nadie se las va a poner. El cruce entre lo que reporta el cliente y lo que registras aquí sí es automático."
        >
          <ConciliacionPagos pedidos={porVerificar} sinPagar={sinPagar} aDevolver={aDevolver} />
        </Section>

        <Section
          id="pedidos"
          title="Pedidos"
          hint="Toca uno para ver qué pidió y a quién. Las casillas son para borrar los de prueba: se va el pedido con sus productos y su código."
        >
          <OrdersCleanup orders={orders ?? []} />
        </Section>

        <Section
          id="semana"
          title="Esta semana"
          hint="Lo entregado desde el lunes, por shopper. Para cerrar un período o cuadrar con el banco, descarga los pedidos y ábrelos en Excel."
        >
          <div className="flex flex-col gap-3">
            <PagoSemanal filas={semana} nombres={nombres} />
            <ExportarPedidos nombresAbasto={nombresAbasto} />
          </div>
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
