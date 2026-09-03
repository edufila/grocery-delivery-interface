/** Esqueleto mientras Supabase responde: evita el salto de página en blanco. */
export default function LoadingPedidos() {
  return (
    <main className="min-h-dvh bg-gray-50">
      <header className="border-b border-gray-100 bg-white">
        <div className="mx-auto max-w-md px-4 py-4">
          <h1 className="text-lg font-semibold text-gray-900">Tus pedidos</h1>
        </div>
      </header>

      <div className="mx-auto flex max-w-md flex-col gap-3 px-4 pb-28 pt-4">
        {[0, 1, 2].map((i) => (
          <div
            key={i}
            className="flex animate-pulse items-center gap-3 rounded-2xl border border-gray-100 bg-white p-4"
          >
            <div className="min-w-0 flex-1">
              <div className="h-4 w-24 rounded bg-gray-200" />
              <div className="mt-2 h-3 w-40 rounded bg-gray-100" />
            </div>
            <div className="h-5 w-16 rounded bg-gray-200" />
          </div>
        ))}
      </div>
    </main>
  )
}
