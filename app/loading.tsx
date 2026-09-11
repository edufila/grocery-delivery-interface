import { ShoppingBasket } from "lucide-react"

import { APP_NAME } from "@/lib/brand"

/**
 * Lo que se ve mientras una pantalla se arma en el servidor.
 *
 * Antes no había ninguno en la raíz, así que entrar a cualquier pantalla que no
 * tuviera el suyo dejaba la app en blanco. En un teléfono con datos lentos eso
 * puede durar un par de segundos, y una pantalla en blanco no se distingue de
 * una app rota: la gente toca otra vez, o se sale.
 *
 * Con la marca a la vista, esa misma espera se lee como "está cargando".
 *
 * Las pantallas que ya tienen el suyo -- perfil, pedidos -- siguen usándolo,
 * porque dibujan el esqueleto de lo que viene y eso es mejor todavía. Este es
 * el que atrapa todo lo demás.
 */
export default function Cargando() {
  return (
    <main className="flex min-h-dvh flex-col items-center justify-center gap-4 bg-gray-50 px-6">
      {/* Un latido y no un girador: girar dice "esto tarda", latir dice "esto
          viene". Y si la espera resulta ser de milésimas, un girador alcanza a
          parpadear una vez y eso se lee como un error. */}
      <div className="flex animate-pulse flex-col items-center gap-3">
        <span className="flex h-16 w-16 items-center justify-center rounded-3xl bg-emerald-100">
          <ShoppingBasket className="h-8 w-8 text-emerald-700" aria-hidden="true" />
        </span>
        <p className="text-lg font-semibold tracking-tight text-gray-900">{APP_NAME}</p>
      </div>

      {/* `polite`: se anuncia sin interrumpir lo que el lector esté diciendo. */}
      <p role="status" className="sr-only">
        Cargando
      </p>
    </main>
  )
}
