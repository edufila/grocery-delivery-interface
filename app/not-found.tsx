import Link from "next/link"
import { SearchX } from "lucide-react"

export default function NotFound() {
  return (
    <main className="flex min-h-dvh items-center bg-gray-50">
      <div className="mx-auto w-full max-w-md px-5 text-center">
        <span className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-white">
          <SearchX className="h-7 w-7 text-gray-400" aria-hidden="true" />
        </span>
        <h1 className="mt-5 text-2xl font-semibold tracking-tight text-gray-900">
          No encontramos esta página
        </h1>
        <p className="mt-2 text-sm leading-relaxed text-gray-500">
          Puede que el enlace esté viejo, o que ese pedido no sea tuyo.
        </p>
        <Link
          href="/"
          className="mt-6 flex h-14 w-full items-center justify-center rounded-2xl bg-emerald-600 text-base font-semibold text-white transition active:scale-[0.99]"
        >
          Ir al inicio
        </Link>
        <Link
          href="/catalogo"
          className="mt-3 flex h-14 w-full items-center justify-center rounded-2xl border border-gray-200 bg-white text-base font-semibold text-gray-700 transition active:scale-[0.99]"
        >
          Ver el catálogo
        </Link>
      </div>
    </main>
  )
}
