"use client"

import { useEffect } from "react"
import Link from "next/link"
import { RotateCw, TriangleAlert } from "lucide-react"

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    // Queda en la consola del navegador y en los logs de Vercel.
    console.error(error)
  }, [error])

  return (
    <main className="flex min-h-dvh items-center bg-gray-50">
      <div className="mx-auto w-full max-w-md px-5 text-center">
        <span className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-white">
          <TriangleAlert className="h-7 w-7 text-amber-500" aria-hidden="true" />
        </span>
        <h1 className="mt-5 text-2xl font-semibold tracking-tight text-gray-900">
          Se nos rompió algo
        </h1>
        <p className="mt-2 text-sm leading-relaxed text-gray-500">
          No es culpa tuya. Probá de nuevo y, si sigue pasando, escribinos.
        </p>

        {error.digest && (
          <p className="mt-4 font-mono text-xs text-gray-400">Referencia: {error.digest}</p>
        )}

        <button
          type="button"
          onClick={reset}
          className="mt-6 flex h-14 w-full items-center justify-center gap-2 rounded-2xl bg-emerald-600 text-base font-semibold text-white transition active:scale-[0.99]"
        >
          <RotateCw className="h-5 w-5" aria-hidden="true" />
          Reintentar
        </button>
        <Link
          href="/"
          className="mt-3 flex h-14 w-full items-center justify-center rounded-2xl border border-gray-200 bg-white text-base font-semibold text-gray-700 transition active:scale-[0.99]"
        >
          Ir al inicio
        </Link>
      </div>
    </main>
  )
}
