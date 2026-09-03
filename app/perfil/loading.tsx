export default function LoadingPerfil() {
  return (
    <main className="min-h-dvh bg-gray-50">
      <header className="border-b border-gray-100 bg-white">
        <div className="mx-auto max-w-md px-4 py-4">
          <h1 className="text-lg font-semibold text-gray-900">Perfil</h1>
        </div>
      </header>

      <div className="mx-auto flex max-w-md flex-col gap-4 px-4 pb-28 pt-6">
        <div className="flex animate-pulse items-center gap-4 rounded-3xl border border-gray-100 bg-white p-5">
          <div className="h-16 w-16 shrink-0 rounded-full bg-gray-200" />
          <div className="min-w-0 flex-1">
            <div className="h-4 w-32 rounded bg-gray-200" />
            <div className="mt-2 h-3 w-44 rounded bg-gray-100" />
          </div>
        </div>

        <div className="animate-pulse rounded-3xl border border-gray-100 bg-white p-5">
          <div className="h-4 w-24 rounded bg-gray-200" />
          <div className="mt-4 h-14 rounded-2xl bg-gray-100" />
          <div className="mt-3 h-14 rounded-2xl bg-gray-100" />
          <div className="mt-3 h-14 rounded-2xl bg-gray-100" />
        </div>
      </div>
    </main>
  )
}
