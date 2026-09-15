import { DeliveryTopBar } from "@/components/delivery-top-bar"
import { SearchBar } from "@/components/search-bar"
import { CategoryShortcuts } from "@/components/category-shortcuts"
import { SaludoInicio } from "@/components/saludo-inicio"
import { NearbyStores } from "@/components/nearby-stores"
import { PedidoEnCurso } from "@/components/pedido-en-curso"
import { UltimaCompra } from "@/components/ultima-compra"
import { BottomNav } from "@/components/bottom-nav"
import { InstalarApp } from "@/components/pwa/instalar-app"
import type { Store } from "@/lib/admin"
import { fetchSettings } from "@/lib/settings"
import { isSupabaseConfigured } from "@/lib/supabase/config"
import { crearClientePublico } from "@/lib/supabase/publico"

/**
 * El inicio se sirve hecho y se rehace cada minuto.
 *
 * Nada de lo que se arma aquí depende de quién mira: abastos, tarifas y tasa
 * son iguales para todos, y lo personal -- el pedido en curso, el saludo con
 * nombre, la dirección -- lo completa el teléfono. Antes se armaba de cero en
 * cada visita: medido en producción con 4G lenta, el servidor tardaba 1,1 s
 * en contestar, más de la mitad de lo que tardaba en verse la pantalla.
 *
 * Un minuto: si alguien cambia un abasto en el panel, se ve al rato.
 */
export const revalidate = 60

export default async function HomePage() {
  const supabase = isSupabaseConfigured ? crearClientePublico() : null

  /**
   * Las dos consultas a la vez, no una después de la otra.
   *
   * Cada una es un viaje de ida y vuelta a Supabase, y no dependen entre sí:
   * encadenarlas hacía esperar dos veces para nada. Es la primera pantalla que
   * carga cualquiera, con datos móviles, así que ese viaje de más se nota.
   *
   * Las tiendas salen de la base para poder editarlas sin desplegar.
   */
  const [stores, settings] = supabase
    ? await Promise.all([
        supabase
          .from("stores")
          .select("*")
          .eq("active", true)
          .order("sort_order")
          .returns<Store[]>()
          .then(({ data }) => data ?? []),
        fetchSettings(supabase),
      ])
    : [[] as Store[], null]

  return (
    <main className="min-h-dvh bg-gray-50">
      <div className="sticky top-0 z-30">
        <DeliveryTopBar />
        <div className="bg-white/90 backdrop-blur-md">
          <SearchBar />
        </div>
      </div>

      <SaludoInicio
        tasaVes={settings?.rate_ves ?? null}
        actualizada={settings?.rate_ves_updated_at ?? null}
      />

      {/* Estas son categorías de tipo de negocio (víveres, restaurante...),
          no de producto: esas siguen viviendo dentro del catálogo de cada
          abasto, y en Explorar para buscar en todos a la vez. */}
      <CategoryShortcuts />

      <div className="pb-28">
        {/* Quien espera un pedido abre la app justo por eso: va primero. */}
        <PedidoEnCurso />
        <UltimaCompra />
        <NearbyStores stores={stores} tasaVes={settings?.rate_ves ?? null} />
        {/* Después de los abastos y no antes: no le gana a lo que se viene a
            hacer. Se puede cerrar; en Perfil sigue estando. */}
        <div className="mx-auto max-w-md px-4 empty:hidden">
          <InstalarApp descartable />
        </div>
      </div>

      <BottomNav />
    </main>
  )
}
