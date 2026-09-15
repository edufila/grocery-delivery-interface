/**
 * Esqueleto del panel del shopper, que se abre decenas de veces por turno.
 * Con la forma de las listas, al volver de un pedido no parpadea el logo.
 */
export default function LoadingShopper() {
  return (
    <main className="min-h-dvh bg-gray-50">
      <header className="pt-barra-estado border-b border-gray-100 bg-white">
        <div className="mx-auto flex max-w-md items-center gap-2 px-4 py-4">
          <div className="h-11 w-11 shrink-0" />
          <div className="animate-pulse">
            <div className="h-5 w-40 rounded bg-gray-200" />
            <div className="mt-1.5 h-3.5 w-24 rounded bg-gray-100" />
          </div>
        </div>
      </header>

      <div className="mx-auto flex max-w-md flex-col gap-6 px-4 pb-16 pt-5">
        {["En curso", "Disponibles"].map((titulo) => (
          <section key={titulo}>
            <p className="mb-2 text-sm font-semibold uppercase tracking-wide text-gray-500">
              {titulo}
            </p>
            <div className="flex flex-col gap-2">
              {[0, 1].map((i) => (
                <div
                  key={i}
                  className="flex animate-pulse items-center gap-3 rounded-2xl border border-gray-100 bg-white p-4"
                >
                  <div className="h-10 w-10 rounded-full bg-gray-100" />
                  <div className="flex-1">
                    <div className="h-4 w-24 rounded bg-gray-200" />
                    <div className="mt-2 h-3 w-40 rounded bg-gray-100" />
                  </div>
                  <div className="h-4 w-12 rounded bg-gray-200" />
                </div>
              ))}
            </div>
          </section>
        ))}
      </div>

      <p role="status" className="sr-only">
        Cargando pedidos
      </p>
    </main>
  )
}
