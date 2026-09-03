import type { Metadata } from "next"
import { WifiOff } from "lucide-react"

import { pageTitle } from "@/lib/brand"

export const metadata: Metadata = {
  title: pageTitle("Sin conexión"),
}

/**
 * La guarda el service worker al instalarse, y es lo único que muestra cuando
 * no hay red. Tiene que ser estática y no depender de nada: si necesitara datos
 * del servidor, justo cuando hace falta no podría cargarse.
 */
export default function SinConexionPage() {
  return (
    <main className="flex min-h-dvh items-center bg-white px-6">
      <div className="mx-auto w-full max-w-md text-center">
        <span className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-gray-100">
          <WifiOff className="h-6 w-6 text-gray-400" aria-hidden="true" />
        </span>

        <h1 className="mt-5 text-xl font-semibold text-gray-900">Te quedaste sin señal</h1>
        <p className="mt-2 text-sm leading-relaxed text-gray-500">
          No pudimos cargar la pantalla. Revisa tus datos o el wifi y vuelve a intentar.
        </p>

        <p className="mt-6 rounded-2xl bg-amber-50 px-4 py-3 text-sm leading-relaxed text-amber-800">
          Si ibas en camino con un pedido, tu ubicación no se está enviando mientras no haya
          señal. Se retoma sola al volver la conexión.
        </p>

        {/* Un enlace y no un botón: sin conexión, un onClick tampoco correría. */}
        <a
          href="/"
          className="mt-6 flex h-12 w-full items-center justify-center rounded-2xl bg-emerald-600 text-sm font-semibold text-white"
        >
          Reintentar
        </a>
      </div>
    </main>
  )
}
